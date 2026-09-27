"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  kind: "song" | "artist";
  label: string;
  detail: string;
  artworkUrl: string;
}

interface GuessInputProps {
  rejectNonce: number;
  onSubmit: (text: string) => void;
}

export function GuessInput({ rejectNonce, onSubmit }: GuessInputProps) {
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);
  const [songs, setSongs] = useState<Suggestion[]>([]);
  const [artists, setArtists] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  const results = [...songs, ...artists];

  useEffect(() => {
    if (!rejectNonce) return;
    setBad(true);
    const timeout = window.setTimeout(() => setBad(false), 700);
    return () => window.clearTimeout(timeout);
  }, [rejectNonce]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setSongs([]);
      setArtists([]);
      setOpen(false);
      setActive(-1);
      return;
    }

    const id = ++requestId.current;
    const timeout = window.setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(query)}`)
        .then((response) => (response.ok ? response.json() : { songs: [], artists: [] }))
        .then((data: { songs?: Suggestion[]; artists?: Suggestion[] }) => {
          if (id !== requestId.current) return;
          setSongs(Array.isArray(data.songs) ? data.songs : []);
          setArtists(Array.isArray(data.artists) ? data.artists : []);
          setOpen(true);
          setActive(-1);
        })
        .catch(() => {
          if (id !== requestId.current) return;
          setSongs([]);
          setArtists([]);
        });
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [value]);

  function choose(text: string) {
    const guess = text.trim();
    if (!guess) return;
    onSubmit(guess);
    setValue("");
    setSongs([]);
    setArtists([]);
    setOpen(false);
    setActive(-1);
  }

  return (
    <form
      className="guess-form"
      onSubmit={(event) => {
        event.preventDefault();
        const picked = active >= 0 ? results[active] : undefined;
        if (picked) {
          choose(picked.label);
          return;
        }
        const input = event.currentTarget.querySelector("input");
        choose(input?.value ?? "");
      }}
    >
      <input
        className={bad ? "guess bad" : "guess"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (!open || results.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % results.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index <= 0 ? results.length - 1 : index - 1));
          } else if (event.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder="TYPE SONG NAME..."
        aria-label="Song or artist"
        aria-expanded={open && results.length > 0}
        aria-autocomplete="list"
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={80}
        enterKeyHint="search"
      />
      {open && results.length > 0 && (
        <div className="suggest" role="listbox">
          {songs.length > 0 && <p className="suggest-label">SONGS</p>}
          {songs.map((item, index) => (
            <button
              key={`song-${item.label}-${item.detail}`}
              type="button"
              role="option"
              aria-selected={active === index}
              className={active === index ? "suggest-row on" : "suggest-row"}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item.label)}
            >
              {item.artworkUrl ? <img src={item.artworkUrl} alt="" width={36} height={36} /> : <span className="suggest-mark" />}
              <span>
                <span className="suggest-name">{item.label}</span>
                <span className="suggest-detail">{item.detail}</span>
              </span>
            </button>
          ))}
          {artists.length > 0 && <p className="suggest-label">ARTISTS</p>}
          {artists.map((item, index) => {
            const row = songs.length + index;
            return (
              <button
                key={`artist-${item.label}`}
                type="button"
                role="option"
                aria-selected={active === row}
                className={active === row ? "suggest-row on" : "suggest-row"}
                onMouseEnter={() => setActive(row)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item.label)}
              >
                <span className="suggest-mark">A</span>
                <span>
                  <span className="suggest-name">{item.label}</span>
                  <span className="suggest-detail">ARTIST</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="hint nomatch" role="status">
        {bad ? "NO MATCH" : ""}
      </p>
    </form>
  );
}
