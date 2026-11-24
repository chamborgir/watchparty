import { useState } from "react";
import { supabase } from "./supabase";
import { getName, setName, getRecent, removeRecent, makeCode } from "./store";

export default function Dashboard({ onEnter }) {
    const [name, setNameState] = useState(getName());
    const [roomName, setRoomName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [recent, setRecent] = useState(getRecent());

    const saveName = (v) => {
        setNameState(v);
        setName(v);
    };

    const forget = (code) => {
        removeRecent(code);
        setRecent(getRecent());
    };

    const createRoom = async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        const code = makeCode();
        const { error: err } = await supabase
            .from("rooms")
            .insert({ code, name: roomName.trim() || "Untitled room" });
        setBusy(false);
        if (err) return setError(`Could not create the room: ${err.message}`);
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
        if (!code) return;

        setBusy(true);
        const { data } = await supabase
            .from("rooms")
            .select("code")
            .eq("code", code)
            .maybeSingle();
        setBusy(false);
        if (!data)
            return setError(
                "No room found with that code. Check it and try again.",
            );
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

            <div className="panels">
                <form className="panel create" onSubmit={createRoom}>
                    <h2>Create a room</h2>
                    <p>Start a room and send the link to your friends.</p>
                    <div className="field">
                        <label htmlFor="rname">Room name</label>
                        <input
                            id="rname"
                            value={roomName}
                            maxLength={40}
                            placeholder="Friday movie night"
                            onChange={(e) => setRoomName(e.target.value)}
                        />
                    </div>
                    <button className="btn primary" disabled={busy}>
                        Create room
                    </button>
                </form>

                <form className="panel join" onSubmit={joinRoom}>
                    <h2>Join a room</h2>
                    <p>Use a room code, or paste an invite link.</p>
                    <div className="field">
                        <label htmlFor="code">Room code</label>
                        <input
                            id="code"
                            value={joinCode}
                            placeholder="a1b2c3"
                            onChange={(e) => setJoinCode(e.target.value)}
                        />
                    </div>
                    <button className="btn primary" disabled={busy}>
                        Join room
                    </button>
                </form>
            </div>

            {error && <p className="error">{error}</p>}

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
        </div>
    );
}
