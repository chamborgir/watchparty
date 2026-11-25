import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { getName, setName, getRecent, removeRecent, makeCode } from "./store";

export default function Dashboard({ onEnter }) {
    const [name, setNameState] = useState(getName());
    const [roomName, setRoomName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [pin, setPin] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [recent, setRecent] = useState(getRecent());
    const [modalOpen, setModalOpen] = useState(false);
    const [modalView, setModalView] = useState("create");

    useEffect(() => {
        if (!modalOpen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === "Escape" && !busy) setModalOpen(false);
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [modalOpen, busy]);

    const saveName = (v) => {
        setNameState(v);
        setName(v);
    };

    const forget = (code) => {
        removeRecent(code);
        setRecent(getRecent());
    };

    const openModal = (view) => {
        setError("");
        setModalView(view);
        setModalOpen(true);
    };

    const createRoom = async (e) => {
        e.preventDefault();
        setError("");
        if (isPrivate && !/^\d{4}$/.test(pin)) {
            setError("Enter a 4-digit PIN for this private room.");
            return;
        }

        setBusy(true);
        const code = makeCode();
        const { error: err } = await supabase.from("rooms").insert({
            code,
            name: roomName.trim() || "Untitled room",
            is_private: isPrivate,
            pin: isPrivate ? pin : null,
        });
        setBusy(false);
        if (err) return setError(`Could not create the room: ${err.message}`);
        setModalOpen(false);
        onEnter(code);
    };

    const joinRoom = async (e) => {
        e.preventDefault();
        setError("");
        let code = joinCode.trim();
        try {
            // allow pasting a full invite link
            const fromUrl = new URL(code).searchParams.get("room");
            if (fromUrl) code = fromUrl;
        } catch {
            /* plain code */
        }
        code = code.toLowerCase();
        if (!code) return setError("Enter a room code or invite link.");

        setBusy(true);
        const { data, error: err } = await supabase
            .from("rooms")
            .select("code")
            .eq("code", code)
            .maybeSingle();
        setBusy(false);
        if (err) return setError(`Could not find the room: ${err.message}`);
        if (!data)
            return setError(
                "No room found with that code. Check it and try again.",
            );
        setModalOpen(false);
        onEnter(code);
    };

    return (
        <div className="dash">
            <header className="dash-head">
                <h1>
                    Watch
                    <br />
                    Party
                </h1>
                <p className="lede">
                    Make a room, send the link, and press play together.
                </p>
            </header>

            <div className="bars" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={i} style={{ "--i": i }} />
                ))}
            </div>

            <div className="field name-field">
                <label htmlFor="name">Your name</label>
                <input
                    id="name"
                    value={name}
                    maxLength={24}
                    placeholder="What your friends will see"
                    onChange={(e) => saveName(e.target.value)}
                />
            </div>

            <div className="dashboard-actions">
                <button
                    className="btn dashboard-action create-action"
                    onClick={() => openModal("create")}
                >
                    <span>Create a room</span>
                    <span className="action-description">
                        Start a watch party
                    </span>
                </button>
                <button
                    className="btn dashboard-action join-action"
                    onClick={() => openModal("join")}
                >
                    <span>Join a room</span>
                    <span className="action-description">
                        Enter a room code or link
                    </span>
                </button>
            </div>

            {error && !modalOpen && <p className="error">{error}</p>}

            {recent.length > 0 && (
                <section className="recent">
                    <h3>Recent rooms</h3>
                    <ul>
                        {recent.map((r) => (
                            <li key={r.code}>
                                <button
                                    className="row-open"
                                    onClick={() => onEnter(r.code)}
                                >
                                    <span className="dot" />
                                    <span className="row-name">{r.name}</span>
                                    <span className="code-pill">{r.code}</span>
                                </button>
                                <button
                                    className="link"
                                    onClick={() => forget(r.code)}
                                >
                                    Forget
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {modalOpen && (
                <div
                    className="modal-backdrop"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !busy)
                            setModalOpen(false);
                    }}
                >
                    <section
                        className={`room-dialog ${modalView}-dialog`}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="room-dialog-title"
                    >
                        <button
                            className="dialog-close"
                            aria-label="Close"
                            disabled={busy}
                            onClick={() => setModalOpen(false)}
                        >
                            ×
                        </button>

                        {modalView === "create" ? (
                            <form className="dialog-form" onSubmit={createRoom}>
                                <h2 id="room-dialog-title">Create a room</h2>
                                <p>
                                    Start a room and send the link to your
                                    friends.
                                </p>
                                <div className="field">
                                    <label htmlFor="rname">Room name</label>
                                    <input
                                        id="rname"
                                        value={roomName}
                                        maxLength={40}
                                        placeholder="Friday movie night"
                                        onChange={(e) =>
                                            setRoomName(e.target.value)
                                        }
                                    />
                                </div>
                                <fieldset className="privacy-options">
                                    <legend>Room visibility</legend>
                                    <label>
                                        <input
                                            type="radio"
                                            name="visibility"
                                            checked={!isPrivate}
                                            onChange={() => setIsPrivate(false)}
                                        />
                                        Public
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="visibility"
                                            checked={isPrivate}
                                            onChange={() => setIsPrivate(true)}
                                        />
                                        Private (PIN required)
                                    </label>
                                </fieldset>
                                {isPrivate && (
                                    <div className="field">
                                        <label htmlFor="room-pin">
                                            4-digit PIN
                                        </label>
                                        <input
                                            id="room-pin"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            maxLength={4}
                                            pattern="[0-9]{4}"
                                            value={pin}
                                            placeholder="••••"
                                            required
                                            onChange={(e) =>
                                                setPin(
                                                    e.target.value.replace(
                                                        /\D/g,
                                                        "",
                                                    ),
                                                )
                                            }
                                        />
                                    </div>
                                )}
                                {error && <p className="error">{error}</p>}
                                <button
                                    className="btn primary"
                                    disabled={busy}
                                >
                                    {busy ? "Creating..." : "Create room"}
                                </button>
                            </form>
                        ) : (
                            <form className="dialog-form" onSubmit={joinRoom}>
                                <h2 id="room-dialog-title">Join a room</h2>
                                <p>Use a room code, or paste an invite link.</p>
                                <div className="field">
                                    <label htmlFor="code">
                                        Room code or invite link
                                    </label>
                                    <input
                                        id="code"
                                        value={joinCode}
                                        placeholder="a1b2c3"
                                        onChange={(e) =>
                                            setJoinCode(e.target.value)
                                        }
                                    />
                                </div>
                                {error && <p className="error">{error}</p>}
                                <button
                                    className="btn primary"
                                    disabled={busy}
                                >
                                    {busy ? "Joining..." : "Join room"}
                                </button>
                            </form>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
