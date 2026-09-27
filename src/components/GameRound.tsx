"use client";

import { useEffect, useRef, useState } from "react";
import { unlockAudio } from "@/lib/audio";
import { formatClock } from "@/lib/format";
import type { Choice, Solver } from "@/lib/types";
import { BinaryVisualizer } from "./BinaryVisualizer";
import { GuessInput } from "./GuessInput";

interface GameRoundProps {
  round: number;
  totalRounds: number;
  durationMs: number;
  startedAt: number;
  clockOffset: number;
  previewToken: string | null;
  youSolved: boolean;
  solvers: Solver[];
  youId: string;
  rejectNonce: number;
  choices: Choice[] | null;
  yourPick: string | null;
  onGuess: (text: string) => void;
}

export function GameRound({
  round,
  totalRounds,
  durationMs,
  startedAt,
  clockOffset,
  previewToken,
  youSolved,
  solvers,
  youId,
  rejectNonce,
  choices,
  yourPick,
  onGuess,
}: GameRoundProps) {
  const offsetRef = useRef(clockOffset);
  offsetRef.current = clockOffset;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [clock, setClock] = useState(() => formatClock(durationMs));
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [mode, setMode] = useState<"search" | "match" | "correct">(youSolved ? "correct" : "search");
  const [flash, setFlash] = useState(false);
  const [arm, setArm] = useState(false);

  useEffect(() => {
    if (!youSolved) {
      setMode("search");
      return;
    }
    setMode("match");
    const matchTimer = window.setTimeout(() => {
      setMode("correct");
      setFlash(true);
    }, 500);
    const flashTimer = window.setTimeout(() => setFlash(false), 1000);
    return () => {
      window.clearTimeout(matchTimer);
      window.clearTimeout(flashTimer);
    };
  }, [youSolved, startedAt]);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() + offsetRef.current - startedAt;
      const remain = elapsed < 0 ? durationMs : durationMs - elapsed;
      setClock(formatClock(remain));
      if (remain <= 0 && audioRef.current && !audioRef.current.paused) audioRef.current.pause();
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [durationMs, startedAt]);

  useEffect(() => {
    if (!previewToken) return;
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.src = `/api/preview?token=${encodeURIComponent(previewToken)}`;
    audioRef.current = audio;

    const ctx = unlockAudio();
    let source: MediaElementAudioSourceNode | null = null;
    let node: AnalyserNode | null = null;
    if (ctx) {
      try {
        source = ctx.createMediaElementSource(audio);
        node = ctx.createAnalyser();
        node.fftSize = 256;
        node.smoothingTimeConstant = 0.72;
        source.connect(node);
        node.connect(ctx.destination);
        setAnalyser(node);
      } catch {
        setAnalyser(null);
      }
    }

    let cancelled = false;
    let wait = 0;
    const begin = () => {
      if (cancelled) return;
      const elapsed = Math.max(0, (Date.now() + offsetRef.current - startedAt) / 1000);
      if (Number.isFinite(audio.duration) && elapsed > 0.05 && elapsed < audio.duration - 0.05) {
        audio.currentTime = elapsed;
      }
      audio.play().then(() => setArm(false)).catch(() => setArm(true));
    };
    const start = () => {
      if (audio.readyState >= 1) begin();
      else audio.addEventListener("loadedmetadata", begin, { once: true });
    };
    const delay = Math.max(0, startedAt - (Date.now() + offsetRef.current));
    wait = window.setTimeout(start, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(wait);
      audio.pause();
      audio.src = "";
      source?.disconnect();
      node?.disconnect();
      audioRef.current = null;
      setAnalyser(null);
    };
  }, [previewToken, startedAt]);

  const others = solvers.filter((solver) => solver.id !== youId);

  return (
    <main className="stage round">
      <div className={flash ? "flash show" : "flash"} />
      <p className="kicker">ROUND {round} / {totalRounds}</p>
      <p className="timer">{clock}</p>
      {mode !== "correct" && <p className="now">NOW PLAYING...</p>}
      {mode !== "correct" && <BinaryVisualizer analyser={analyser} resolved={mode === "match"} />}
      {mode === "correct" && (
        <p className="correct" role="status">
          CORRECT
        </p>
      )}
      {choices && choices.length > 0 ? (
        <ChoiceSquares
          choices={choices}
          yourPick={yourPick}
          youSolved={youSolved}
          rejectNonce={rejectNonce}
          onGuess={onGuess}
        />
      ) : (
        mode === "search" && <GuessInput rejectNonce={rejectNonce} onSubmit={onGuess} />
      )}
      {arm && mode === "search" && (
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            void audioRef.current?.play().then(() => setArm(false)).catch(() => setArm(true));
          }}
        >
          PRESS TO LISTEN
        </button>
      )}
      {others.map((solver) => (
        <p key={solver.id} className="hint">
          {solver.name} SOLVED
        </p>
      ))}
    </main>
  );
}

function ChoiceSquares({
  choices,
  yourPick,
  youSolved,
  rejectNonce,
  onGuess,
}: {
  choices: Choice[];
  yourPick: string | null;
  youSolved: boolean;
  rejectNonce: number;
  onGuess: (text: string) => void;
}) {
  const [sent, setSent] = useState<string | null>(null);
  const picked = yourPick || sent;
  const missed = Boolean(picked) && !youSolved && rejectNonce > 0;

  return (
    <div className="squares">
      {choices.map((choice) => {
        const selected = picked === choice.title;
        const className = ["square", selected && !missed ? "on" : "", selected && missed ? "miss" : ""].filter(Boolean).join(" ");
        return (
          <button
            key={choice.title}
            type="button"
            className={className}
            disabled={Boolean(picked)}
            onClick={() => {
              if (picked) return;
              setSent(choice.title);
              onGuess(choice.title);
            }}
          >
            <span className="square-title">{choice.title}</span>
            <span className="square-artist">{choice.artist}</span>
          </button>
        );
      })}
    </div>
  );
}
