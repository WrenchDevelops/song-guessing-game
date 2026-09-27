"use client";

import { useEffect, useState } from "react";

interface LandingProps {
  error: string | null;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
}

export function Landing({ error, onCreate, onJoin }: LandingProps) {
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get("room");
    if (!room) return;
    setCode(room.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4));
    setMode("join");
  }, []);

  const shown = localError || error;

  return (
    <main className="stage">
      <h1>GUESS THE SONG</h1>
      {mode === "home" && (
        <div className="actions">
          <button type="button" onClick={() => { setLocalError(null); setMode("create"); }}>
            CREATE GAME
          </button>
          <button type="button" onClick={() => { setLocalError(null); setMode("join"); }}>
            JOIN GAME
          </button>
        </div>
      )}
      {mode === "create" && (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            const nextName = String(new FormData(event.currentTarget).get("name") ?? "").trim();
            if (!nextName) {
              setLocalError("ENTER A NAME");
              return;
            }
            setLocalError(null);
            onCreate(nextName);
          }}
        >
          <input
            className="field"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="NAME"
            aria-label="Name"
            maxLength={16}
            autoComplete="off"
            autoFocus
          />
          <div className="actions">
            <button type="submit">CREATE GAME</button>
            <button type="button" onClick={() => setMode("home")}>BACK</button>
          </div>
        </form>
      )}
      {mode === "join" && (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const nextCode = String(data.get("code") ?? "").trim();
            const nextName = String(data.get("name") ?? "").trim();
            if (nextCode.length < 4) {
              setLocalError("ENTER A ROOM CODE");
              return;
            }
            if (!nextName) {
              setLocalError("ENTER A NAME");
              return;
            }
            setLocalError(null);
            onJoin(nextCode, nextName);
          }}
        >
          <input
            className="field code-input"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
            placeholder="ROOM CODE"
            aria-label="Room code"
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
          />
          <input
            className="field"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="NAME"
            aria-label="Name"
            maxLength={16}
            autoComplete="off"
          />
          <div className="actions">
            <button type="submit">JOIN GAME</button>
            <button type="button" onClick={() => setMode("home")}>BACK</button>
          </div>
        </form>
      )}
      {shown && <p className="hint">{shown}</p>}
    </main>
  );
}
