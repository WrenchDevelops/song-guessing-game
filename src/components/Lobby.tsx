"use client";

import { useState } from "react";
import type { PublicPlayer, Settings } from "@/lib/types";
import { HostControls } from "./HostControls";

interface LobbyProps {
  code: string;
  players: PublicPlayer[];
  settings: Settings;
  youAreHost: boolean;
  starting: boolean;
  error: string | null;
  onSettings: (settings: Settings) => void;
  onStart: () => void;
}

export function Lobby({ code, players, settings, youAreHost, starting, error, onSettings, onStart }: LobbyProps) {
  const [copied, setCopied] = useState(false);

  return (
    <main className="stage">
      <div>
        <p className="kicker">ROOM</p>
        <button
          type="button"
          className="room-code"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {code}
        </button>
        <p className="hint">{copied ? "COPIED" : "CLICK TO COPY"}</p>
      </div>
      <div>
        <p className="kicker">PLAYERS</p>
        <ul className="players">
          {players.map((player) => (
            <li key={player.id}>
              {player.name}
              {player.isHost && <span className="tag">HOST</span>}
            </li>
          ))}
        </ul>
      </div>
      {youAreHost ? (
        <HostControls settings={settings} disabled={starting} onChange={onSettings} onStart={onStart} />
      ) : (
        <div>
          <p className="hint">
            {settings.rounds} ROUNDS · {settings.category} · {settings.durationSec} SEC
          </p>
          <p className="wait">WAITING FOR HOST...</p>
        </div>
      )}
      {error && <p className="hint">{error}</p>}
    </main>
  );
}
