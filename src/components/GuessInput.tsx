"use client";

import { useEffect, useState } from "react";

interface GuessInputProps {
  rejectNonce: number;
  onSubmit: (text: string) => void;
}

export function GuessInput({ rejectNonce, onSubmit }: GuessInputProps) {
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);

  useEffect(() => {
    if (!rejectNonce) return;
    setBad(true);
    const timeout = window.setTimeout(() => setBad(false), 700);
    return () => window.clearTimeout(timeout);
  }, [rejectNonce]);

  return (
    <form
      className="guess-form"
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.querySelector("input");
        const text = input?.value.trim() ?? "";
        if (!text) return;
        onSubmit(text);
        setValue("");
      }}
    >
      <input
        className={bad ? "guess bad" : "guess"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="TYPE SONG NAME..."
        aria-label="Song or artist"
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={80}
        enterKeyHint="done"
      />
      <p className="hint nomatch" role="status">
        {bad ? "NO MATCH" : ""}
      </p>
    </form>
  );
}
