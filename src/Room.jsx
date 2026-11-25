import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
    CLIENT_ID,
    getName,
    pushRecent,
    removeRecent,
    formatSize,
} from "./store";
import { signUpload, signView, putWithProgress, removeObject } from "./api";

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const rateLabel = (r) => (r === 1 ? "Normal" : `${r}x`);

export default function Room({ code, onLeave }) {
    const [room, setRoom] = useState(null);
    const [state, setState] = useState("loading");
    const [pin, setPin] = useState("");
    const [pinError, setPinError] = useState("");

    useEffect(() => {
        let alive = true;
        supabase
            .from("rooms")
            .select("*")
            .eq("code", code)
            .maybeSingle()
            .then(({ data, error }) => {
                if (!alive) return;
                if (error || !data) {
                    removeRecent(code);
                    return setState("missing");
                }
                setRoom(data);
                pushRecent(data);
                setState(data.is_private ? "locked" : "ready");
            });
        return () => {
            alive = false;
        };
    }, [code]);

    if (state === "loading")
        return (
            <main
                className="room-skeleton"
                role="status"
                aria-label="Loading room"
            >
                <span className="sr-only">Loading room...</span>
                <header className="room-skeleton-head" aria-hidden="true">
                    <span className="skeleton skeleton-title" />
                    <span className="skeleton skeleton-button" />
                </header>
                <div className="room-skeleton-main" aria-hidden="true">
                    <section>
                        <span className="skeleton skeleton-stage" />
                        <span className="skeleton skeleton-text skeleton-text-wide" />
                        <span className="skeleton skeleton-text skeleton-text-short" />
                        <div className="room-skeleton-chips">
                            <span className="skeleton skeleton-chip" />
                            <span className="skeleton skeleton-chip" />
                            <span className="skeleton skeleton-chip" />
                        </div>
                    </section>
                    <aside className="room-skeleton-library">
                        <span className="skeleton skeleton-library-title" />
                        <span className="skeleton skeleton-library-row" />
                        <span className="skeleton skeleton-library-row" />
                        <span className="skeleton skeleton-library-row" />
                        <span className="skeleton skeleton-library-title skeleton-library-subtitle" />
                        <span className="skeleton skeleton-library-row" />
                    </aside>
                </div>
            </main>
        );

    if (state === "missing")
        return (
            <div className="center">
                <h2>Room not found</h2>
                <p className="muted">
                    It may have been deleted, or the code is wrong.
                </p>
                <button className="btn" onClick={onLeave}>
                    Back to dashboard
                </button>
            </div>
        );

    if (state === "locked")
        return (
            <form
                className="center room-pin-gate"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (pin === room.pin) {
                        setPinError("");
                        setState("ready");
                    } else {
                        setPinError("That PIN is incorrect. Try again.");
                    }
                }}
            >
                <h2>Private room</h2>
                <p className="muted">Enter the 4-digit PIN to join.</p>
                <div className="field">
                    <label htmlFor="entry-pin">Room PIN</label>
                    <input
                        id="entry-pin"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={4}
                        pattern="[0-9]{4}"
                        value={pin}
                        required
                        onChange={(event) =>
                            setPin(event.target.value.replace(/\D/g, ""))
                        }
                    />
                </div>
                {pinError && <p className="error">{pinError}</p>}
                <button className="btn primary">Enter room</button>
                <button className="btn" type="button" onClick={onLeave}>
                    Back to dashboard
                </button>
            </form>
        );

    return <RoomView room={room} onLeave={onLeave} />;
}

function RoomView({ room, onLeave }) {
    const ROOM = room.code;

    const videoRef = useRef(null);
    const channelRef = useRef(null);
    const handlerRef = useRef(() => {});
    const roomMenuRef = useRef(null);

    // shared playback state lives in refs so event handlers always see fresh values
    const intentPlaying = useRef(false); // what the room wants: playing or paused
    const localBuffering = useRef(false);
    const bufferingPeers = useRef(new Map());
    const suppressUntil = useRef(0); // ignore native events caused by our own code
    const pending = useRef(null); // { time } applied once metadata loads
    const currentRef = useRef(null);
    const rateRef = useRef(1);

    const [videos, setVideos] = useState([]);
    const [current, setCurrent] = useState(null);
    const [src, setSrc] = useState(""); // temporary signed link for the current video
    const [rate, setRate] = useState(1);
    const [people, setPeople] = useState([]);
    const [status, setStatus] = useState("");
    const [playError, setPlayError] = useState("");
    const [upload, setUpload] = useState(null); // { name, pct }
    const [needsTap, setNeedsTap] = useState(false);
    const [copied, setCopied] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [notice, setNotice] = useState(null);

    currentRef.current = current;

    // ---------- helpers ----------
    const send = (payload) =>
        channelRef.current?.send({
            type: "broadcast",
            event: "cmd",
            payload: { ...payload, from: CLIENT_ID },
        });
    const sendBuffer = (on) =>
        send({ type: "buffer", on, name: getName() || "Guest" });
    const showNotice = (title, message, leave = false, onConfirm = null) =>
        setNotice({ title, message, leave, onConfirm });
    const closeNotice = () => {
        const leave = notice?.leave;
        setNotice(null);
        if (leave) onLeave();
    };
    const confirmNotice = () => {
        const onConfirm = notice?.onConfirm;
        setNotice(null);
        onConfirm?.();
    };

    const quiet = () => (suppressUntil.current = Date.now() + 400);
    const isQuiet = () => Date.now() < suppressUntil.current;

    // Make the real <video> match "room intent and nobody is buffering"
    const reconcile = () => {
        const v = videoRef.current;
        const waiting =
            localBuffering.current || bufferingPeers.current.size > 0;

        if (localBuffering.current) {
            setStatus("Loading video...");
        } else if (bufferingPeers.current.size > 0) {
            const names = [...new Set(bufferingPeers.current.values())];
            setStatus(
                names.length === 1
                    ? `${names[0]} is loading the video...`
                    : `${names.join(", ")} are loading the video...`,
            );
        } else {
            setStatus("");
        }

        if (!v) return;
        const shouldPlay = intentPlaying.current && !waiting;
        if (shouldPlay && v.paused) {
            v.play().catch(() => setNeedsTap(true)); // browser blocked autoplay
        } else if (!shouldPlay && !v.paused) {
            quiet();
            v.pause();
        }
    };

    // Apply a playback speed locally (used for our own change and for remote changes)
    const applyRate = (r) => {
        rateRef.current = r;
        setRate(r);
        const v = videoRef.current;
        if (v && v.playbackRate !== r) {
            quiet();
            v.playbackRate = r;
        }
    };

    const changeRate = (r) => {
        applyRate(r);
        send({ type: "rate", rate: r });
    };

    const loadVideos = async () => {
        const { data } = await supabase
            .from("videos")
            .select("*")
            .eq("room_id", ROOM)
            .order("created_at", { ascending: false });
        setVideos(data || []);
    };

    const startVideo = (video, time = 0, playing = false) => {
        intentPlaying.current = playing;
        pending.current = { time };
        localBuffering.current = true; // cleared on canplay
        setPlayError("");
        setSrc("");
        setCurrent(video);
        setStatus("Loading video...");
        sendBuffer(true);

        // the bucket is private, so each person asks the server for their own temporary link
        signView(video.key)
            .then((url) => {
                if (currentRef.current?.id === video.id) setSrc(url);
            })
            .catch((err) => {
                setPlayError(err.message);
                localBuffering.current = false;
                sendBuffer(false);
            });
    };

    const clearCurrent = () => {
        intentPlaying.current = false;
        if (localBuffering.current) sendBuffer(false);
        localBuffering.current = false;
        bufferingPeers.current.clear();
        setStatus("");
        setSrc("");
        setCurrent(null);
    };

    // ---------- incoming messages ----------
    handlerRef.current = (msg) => {
        const v = videoRef.current;
        switch (msg.type) {
            case "select":
                startVideo(msg.video, 0, false);
                break;

            case "play":
                intentPlaying.current = true;
                if (v && Math.abs(v.currentTime - msg.time) > 0.5) {
                    quiet();
                    v.currentTime = msg.time;
                }
                reconcile();
                break;

            case "pause":
                intentPlaying.current = false;
                if (v) {
                    quiet();
                    v.currentTime = msg.time;
                }
                reconcile();
                break;

            case "seek":
                if (v) {
                    quiet();
                    v.currentTime = msg.time;
                }
                break;

            case "rate":
                applyRate(msg.rate);
                break;

            case "buffer":
                if (msg.on)
                    bufferingPeers.current.set(
                        msg.from,
                        msg.name ||
                            people.find((person) => person.key === msg.from)
                                ?.name ||
                            "A watcher",
                    );
                else bufferingPeers.current.delete(msg.from);
                reconcile();
                break;

            case "videos-changed":
                if (msg.removedId && currentRef.current?.id === msg.removedId)
                    clearCurrent();
                loadVideos();
                break;

            case "room-deleted":
                removeRecent(ROOM);
                showNotice(
                    "Room deleted",
                    "This room was deleted by another watcher.",
                    true,
                );
                break;

            case "sync-request":
                // someone joined: tell them what we are watching, where we are, and how fast
                if (currentRef.current && v) {
                    const buffering = [...bufferingPeers.current.entries()];
                    if (localBuffering.current)
                        buffering.push([CLIENT_ID, getName() || "Guest"]);
                    send({
                        type: "sync-state",
                        video: currentRef.current,
                        time: v.currentTime,
                        playing: intentPlaying.current,
                        rate: rateRef.current,
                        buffering,
                    });
                }
                break;

            case "sync-state":
                if (!currentRef.current) {
                    if (msg.rate) applyRate(msg.rate);
                    startVideo(msg.video, msg.time, msg.playing);
                }
                for (const [key, name] of msg.buffering || []) {
                    if (key !== CLIENT_ID)
                        bufferingPeers.current.set(key, name);
                }
                reconcile();
                break;

            default:
        }
    };

    // ---------- realtime channel ----------
    useEffect(() => {
        loadVideos();

        const channel = supabase.channel(`room:${ROOM}`, {
            config: {
                broadcast: { self: false },
                presence: { key: CLIENT_ID },
            },
        });
        channelRef.current = channel;

        channel.on("broadcast", { event: "cmd" }, ({ payload }) => {
            if (payload.from !== CLIENT_ID) handlerRef.current(payload);
        });

        channel.on("presence", { event: "sync" }, () => {
            const st = channel.presenceState();
            setPeople(
                Object.entries(st).map(([key, metas]) => ({
                    key,
                    name: metas[0]?.name || "Guest",
                })),
            );
        });

        // if someone disconnects while buffering, do not wait for them forever
        channel.on("presence", { event: "leave" }, ({ key }) => {
            bufferingPeers.current.delete(key);
            reconcile();
        });

        channel.subscribe(async (s) => {
            if (s === "SUBSCRIBED") {
                await channel.track({ name: getName() || "Guest" });
                send({ type: "sync-request" });
            }
        });

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line
    }, []);

    // ---------- native <video> events (user actions) ----------
    const onPlay = () => {
        if (isQuiet()) return;
        intentPlaying.current = true;
        send({ type: "play", time: videoRef.current.currentTime });
        reconcile();
    };

    const onPause = () => {
        if (isQuiet()) return;
        const v = videoRef.current;
        if (v.ended) return;
        intentPlaying.current = false;
        send({ type: "pause", time: v.currentTime });
    };

    const onSeeked = () => {
        if (isQuiet()) return;
        send({ type: "seek", time: videoRef.current.currentTime });
    };

    // covers the speed menu inside the browser's own video controls
    const onRateChange = () => {
        if (isQuiet()) return;
        const r = videoRef.current.playbackRate;
        if (r !== rateRef.current) {
            rateRef.current = r;
            setRate(r);
            send({ type: "rate", rate: r });
        }
    };

    const onWaiting = () => {
        if (localBuffering.current) return;
        localBuffering.current = true;
        sendBuffer(true);
        reconcile();
    };

    const onReady = () => {
        if (!localBuffering.current) return;
        localBuffering.current = false;
        sendBuffer(false);
        reconcile();
    };

    const onLoadedMetadata = () => {
        const v = videoRef.current;
        quiet();
        v.playbackRate = rateRef.current;
        if (pending.current) {
            v.currentTime = pending.current.time;
            pending.current = null;
        }
    };

    const onVideoError = (e) => {
        const code = e.currentTarget.error?.code;
        const reasons = {
            1: "Loading was aborted.",
            2: "Network error while loading the video.",
            3: "This video could not be decoded. Convert it to H.264 / AAC MP4.",
            4: "This video format is not supported, or the video address is unreachable.",
        };
        // stop everyone from waiting on a video that can never load
        if (localBuffering.current) {
            localBuffering.current = false;
            sendBuffer(false);
        }
        setPlayError(reasons[code] || "Could not play this video.");
    };

    // ---------- actions ----------
    const pickVideo = (video) => {
        startVideo(video, 0, false);
        send({ type: "select", video });
    };

    const uploadVideo = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setUpload({ name: file.name, pct: 0 });
        try {
            const { uploadUrl, key, publicUrl } = await signUpload(ROOM, file);
            await putWithProgress(uploadUrl, file, (p) =>
                setUpload({ name: file.name, pct: p }),
            );

            const { error } = await supabase.from("videos").insert({
                room_id: ROOM,
                name: file.name,
                url: publicUrl,
                key,
                size: file.size,
            });
            if (error) throw error;

            await loadVideos();
            send({ type: "videos-changed" });
        } catch (err) {
            showNotice("Upload failed", err.message);
        } finally {
            setUpload(null);
        }
    };

    const removeVideo = (video) => {
        showNotice(
            "Remove video?",
            `Remove "${video.name}" from this room?`,
            false,
            () => performRemoveVideo(video),
        );
    };

    const performRemoveVideo = async (video) => {
        try {
            await removeObject(video.key);
            await supabase.from("videos").delete().eq("id", video.id);
            if (currentRef.current?.id === video.id) clearCurrent();
            await loadVideos();
            send({ type: "videos-changed", removedId: video.id });
        } catch (err) {
            showNotice("Could not remove video", err.message);
        }
    };

    const deleteRoom = () => {
        if (roomMenuRef.current) roomMenuRef.current.open = false;
        showNotice(
            "Delete room?",
            `Delete "${room.name}" for everyone? Its videos are removed for good.`,
            false,
            performDeleteRoom,
        );
    };

    const performDeleteRoom = async () => {
        setDeleting(true);
        try {
            const { data: vids, error: vErr } = await supabase
                .from("videos")
                .select("id, key")
                .eq("room_id", ROOM);
            if (vErr) throw vErr;

            // delete the room row first: this also proves we are allowed to
            const { data: gone, error: rErr } = await supabase
                .from("rooms")
                .delete()
                .eq("code", ROOM)
                .select();
            if (rErr) throw rErr;
            if (!gone?.length) {
                throw new Error(
                    'Not allowed. Run the "rooms delete" policy from supabase.sql in Supabase first.',
                );
            }

            const results = await Promise.allSettled(
                (vids || []).map((v) => removeObject(v.key)),
            );
            const failed = results.filter(
                (r) => r.status === "rejected",
            ).length;
            await supabase.from("videos").delete().eq("room_id", ROOM);

            await send({ type: "room-deleted" }); // tell everyone else in the room
            removeRecent(ROOM);
            if (failed) {
                showNotice(
                    "Room deleted",
                    `The room is deleted, but ${failed} video file(s) could not be removed from storage.`,
                    true,
                );
            } else {
                onLeave();
            }
        } catch (err) {
            showNotice("Could not delete the room", err.message);
            setDeleting(false);
        }
    };

    const copyLink = async () => {
        const link = `${window.location.origin}${window.location.pathname}?room=${ROOM}`;
        await navigator.clipboard.writeText(link);
        setCopied(true);
        if (roomMenuRef.current) roomMenuRef.current.open = false;
        setTimeout(() => setCopied(false), 1500);
    };

    const tapToJoin = () => {
        setNeedsTap(false);
        reconcile();
    };

    return (
        <div className="room">
            <header className="room-head">
                <nav className="room-navbar" aria-label="Room navigation">
                    <div className="room-title">
                        <button className="link" onClick={onLeave}>
                            Dashboard
                        </button>
                        <strong>{room.name}</strong>
                        <span className="code-pill">{ROOM}</span>
                    </div>
                    <div className="room-actions">
                        <span className="muted">
                            {people.length}{" "}
                            {people.length === 1 ? "person" : "people"} here
                        </span>
                        <button className="btn small" onClick={copyLink}>
                            {copied ? "Link copied" : "Copy invite link"}
                        </button>
                        <button
                            className="btn small danger"
                            onClick={deleteRoom}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting" : "Delete room"}
                        </button>
                        <details className="room-menu" ref={roomMenuRef}>
                            <summary aria-label="Room options">
                                <span aria-hidden="true">•••</span>
                            </summary>
                            <div className="room-menu-popover">
                                {room.is_private && (
                                    <p className="room-menu-pin">
                                        <span>Room PIN</span>
                                        <strong>{room.pin}</strong>
                                    </p>
                                )}
                                <button
                                    className="btn small"
                                    onClick={copyLink}
                                >
                                    {copied
                                        ? "Link copied"
                                        : "Copy invite link"}
                                </button>
                                <button
                                    className="btn small danger"
                                    onClick={deleteRoom}
                                    disabled={deleting}
                                >
                                    {deleting ? "Deleting" : "Delete room"}
                                </button>
                            </div>
                        </details>
                    </div>
                </nav>
            </header>

            <main className="room-main">
                <section>
                    <div className="stage">
                        {current ? (
                            <>
                                {src && (
                                    <video
                                        key={current.id}
                                        ref={videoRef}
                                        src={src}
                                        controls
                                        playsInline
                                        preload="auto"
                                        onPlay={onPlay}
                                        onPause={onPause}
                                        onSeeked={onSeeked}
                                        onRateChange={onRateChange}
                                        onWaiting={onWaiting}
                                        onCanPlay={onReady}
                                        onPlaying={onReady}
                                        onLoadedMetadata={onLoadedMetadata}
                                        onError={onVideoError}
                                    />
                                )}
                                {!src && !status && !playError && (
                                    <div className="overlay">
                                        Loading video...
                                    </div>
                                )}
                                {status && !playError && (
                                    <div className="overlay">{status}</div>
                                )}
                                {playError && (
                                    <div className="overlay error-overlay">
                                        {playError}
                                    </div>
                                )}
                                {needsTap && !playError && (
                                    <button
                                        className="overlay tap"
                                        onClick={tapToJoin}
                                    >
                                        Click to join playback
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="empty">
                                <div className="plaque">
                                    <h2>Nothing playing</h2>
                                    <p>
                                        Upload a video or pick one from the
                                        library.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    {current && (
                        <div className="now-row">
                            <p className="now muted">
                                Now playing, {current.name}
                            </p>
                            <details className="mobile-speed-menu">
                                <summary>Speed: {rateLabel(rate)}</summary>
                                <div
                                    className="mobile-speed-options"
                                    role="group"
                                    aria-label="Playback speed for everyone"
                                >
                                    {RATES.map((r) => (
                                        <button
                                            key={r}
                                            className={`chip ${rate === r ? "on" : ""}`}
                                            aria-pressed={rate === r}
                                            onClick={() => changeRate(r)}
                                        >
                                            {rateLabel(r)}
                                        </button>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}

                    <div className="speed">
                        <span className="speed-label">Speed for everyone</span>
                        <div
                            className="chips"
                            role="group"
                            aria-label="Playback speed for everyone"
                        >
                            {RATES.map((r) => (
                                <button
                                    key={r}
                                    className={`chip ${rate === r ? "on" : ""}`}
                                    aria-pressed={rate === r}
                                    onClick={() => changeRate(r)}
                                >
                                    {rateLabel(r)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ul className="people">
                        {people.map((p) => (
                            <li key={p.key}>
                                {p.name}
                                {p.key === CLIENT_ID ? " (you)" : ""}
                            </li>
                        ))}
                    </ul>
                </section>

                <aside className="library">
                    <label
                        className={`btn primary block ${upload ? "disabled" : ""}`}
                    >
                        {upload ? "Uploading" : "Upload video"}
                        <input
                            type="file"
                            accept="video/*"
                            onChange={uploadVideo}
                            disabled={!!upload}
                            hidden
                        />
                    </label>

                    {upload && (
                        <div className="progress">
                            <div className="track">
                                <div
                                    className="bar"
                                    style={{
                                        width: `${Math.round(upload.pct * 100)}%`,
                                    }}
                                />
                            </div>
                            <span className="muted">
                                {upload.name} {Math.round(upload.pct * 100)}%
                            </span>
                        </div>
                    )}

                    <h3>Library</h3>
                    <ul>
                        {videos.map((v) => (
                            <li
                                key={v.id}
                                className={current?.id === v.id ? "active" : ""}
                                onClick={() => pickVideo(v)}
                            >
                                <div className="v-info">
                                    <span className="v-name">{v.name}</span>
                                    <span className="muted v-size">
                                        {formatSize(v.size)}
                                    </span>
                                </div>
                                <button
                                    className="link danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeVideo(v);
                                    }}
                                >
                                    Remove
                                </button>
                            </li>
                        ))}
                        {!videos.length && (
                            <li className="muted static">No videos yet</li>
                        )}
                    </ul>
                </aside>
            </main>
            {notice && (
                <div className="notice-backdrop">
                    <section
                        className="notice-dialog"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="notice-title"
                        aria-describedby="notice-message"
                    >
                        <h2 id="notice-title">{notice.title}</h2>
                        <p id="notice-message">{notice.message}</p>
                        <div className="notice-actions">
                            {notice.onConfirm ? (
                                <>
                                    <button
                                        className="btn notice-cancel"
                                        autoFocus
                                        onClick={() => setNotice(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn danger"
                                        onClick={confirmNotice}
                                    >
                                        Delete
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn primary"
                                    autoFocus
                                    onClick={closeNotice}
                                >
                                    {notice.leave ? "Back to dashboard" : "OK"}
                                </button>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
