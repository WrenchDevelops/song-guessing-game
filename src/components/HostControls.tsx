"use client";

import { CATEGORIES, DURATIONS, ROUNDS, type Settings } from "@/lib/types";

interface HostControlsProps {
  settings: Settings;
  disabled: boolean;
  onChange: (settings: Settings) => void;
  onStart: () => void;
}

export function HostControls({ settings, disabled, onChange, onStart }: HostControlsProps) {
  const playlist = settings.category === "PLAYLIST";
  return (
    <div className="host">
      <fieldset disabled={disabled || playlist}>
        <legend>ROUNDS</legend>
        {playlist ? (
          <p className="hint">EVERY SONG ON THE PLAYLIST</p>
        ) : (
          <div className="choices">
            {ROUNDS.map((rounds) => (
              <button
                key={rounds}
                type="button"
                className={settings.rounds === rounds ? "on" : ""}
                onClick={() => onChange({ ...settings, rounds })}
              >
                {rounds}
              </button>
            ))}
          </div>
        )}
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>SONG CATEGORY</legend>
        <div className="choices">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={settings.category === category ? "on" : ""}
              onClick={() => onChange({ ...settings, category })}
            >
              {category}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>ANSWER</legend>
        <div className="choices">
          <button
            type="button"
            className={settings.answer === "type" ? "on" : ""}
            onClick={() => onChange({ ...settings, answer: "type" })}
          >
            TYPE
          </button>
          <button
            type="button"
            className={settings.answer === "choice" ? "on" : ""}
            onClick={() => onChange({ ...settings, answer: "choice" })}
          >
            4 CHOICE
          </button>
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>ROUND DURATION</legend>
        <div className="choices">
          {DURATIONS.map((durationSec) => (
            <button
              key={durationSec}
              type="button"
              className={settings.durationSec === durationSec ? "on" : ""}
              onClick={() => onChange({ ...settings, durationSec })}
            >
              {durationSec} SEC
            </button>
          ))}
        </div>
      </fieldset>
      <button type="button" className="start" onClick={onStart} disabled={disabled}>
        {disabled ? "LOADING SONGS..." : "START GAME"}
      </button>
    </div>
  );
}
