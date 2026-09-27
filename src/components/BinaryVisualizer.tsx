"use client";

import { useEffect, useRef } from "react";

const WORDS = ["SEARCHING", "ARTIST", "TRACK", "MATCH", "UNKNOWN", "AUDIO", "DATABASE", "QUERY"];
const GLYPHS = ["0", "1", "0", "1", "0", "1", ".", ".", "·", " "];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MATCH = "MATCH FOUND\n\n████████████████\nTRACK IDENTIFIED\n████████████████";

interface Cell {
  ch: string;
  tone: 0 | 1 | 2;
}

interface Line {
  cells: Cell[];
  hold: number;
}

function glyph(energy: number): Cell {
  const roll = Math.random();
  if (roll < 0.05 + energy * 0.08) {
    return { ch: LETTERS[Math.floor(Math.random() * LETTERS.length)] ?? "A", tone: energy > 0.45 ? 2 : 1 };
  }
  const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "0";
  if (ch === "." || ch === "·" || ch === " ") return { ch, tone: 0 };
  return { ch, tone: Math.random() < energy * 0.85 ? 2 : 1 };
}

function makeLine(columns: number, energy: number, withWord: boolean): Line {
  const cells = Array.from({ length: columns }, () => glyph(energy));
  if (!withWord) return { cells, hold: 0 };
  const word = WORDS[Math.floor(Math.random() * WORDS.length)] ?? "SEARCHING";
  if (word.length + 2 >= columns) return { cells, hold: 0 };
  const start = 1 + Math.floor(Math.random() * (columns - word.length - 1));
  for (let index = 0; index < word.length; index += 1) {
    cells[start + index] = { ch: word[index] ?? " ", tone: 2 };
  }
  return { cells, hold: Math.max(4, 14 - Math.floor(energy * 8)) };
}

function paint(element: HTMLElement, lines: Line[]) {
  element.replaceChildren();
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) element.append("\n");
    for (const cell of line.cells) {
      const span = document.createElement("span");
      span.className = `t${cell.tone}`;
      span.textContent = cell.ch;
      element.append(span);
    }
  });
}

interface BinaryVisualizerProps {
  analyser: AnalyserNode | null;
  resolved: boolean;
}

export function BinaryVisualizer({ analyser, resolved }: BinaryVisualizerProps) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (resolved) {
      element.textContent = MATCH;
      return;
    }

    const columns = Math.max(18, Math.min(42, Math.floor(element.clientWidth / 13) || 28));
    const rows = element.clientWidth < 560 ? 5 : 7;
    let lines = Array.from({ length: rows }, () => makeLine(columns, 0.2, false));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const time = analyser ? new Uint8Array(analyser.fftSize) : null;
    const freq = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let frame = 0;
    let last = 0;
    let raf = 0;

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      if (document.hidden) return;
      if (reduce && now - last < 480) return;
      frame += 1;
      if (!reduce && frame % 2) return;
      last = now;

      let energy = 0.16 + Math.abs(Math.sin(now / 320)) * 0.08;
      if (analyser && time && freq) {
        analyser.getByteTimeDomainData(time);
        let squares = 0;
        for (let index = 0; index < time.length; index += 1) {
          const sample = ((time[index] ?? 128) - 128) / 128;
          squares += sample * sample;
        }
        analyser.getByteFrequencyData(freq);
        let total = 0;
        for (let index = 0; index < freq.length; index += 1) total += freq[index] ?? 0;
        const rms = Math.sqrt(squares / time.length);
        const average = total / (freq.length * 255);
        energy = Math.min(1, 0.12 + rms * 5.5 + average * 1.6);
      }

      lines = lines.map((line) => {
        if (line.hold > 0) return { ...line, hold: line.hold - 1 };
        if (Math.random() < 0.004 + energy * 0.03) return makeLine(columns, energy, true);
        if (energy > 0.62 && Math.random() < energy * 0.18) return makeLine(columns, energy, Math.random() < 0.45);
        const next = line.cells.slice();
        const flips = Math.max(1, Math.floor(columns * (0.08 + energy * 0.62)));
        for (let flip = 0; flip < flips; flip += 1) {
          const index = Math.floor(Math.random() * columns);
          next[index] = glyph(energy);
        }
        return { cells: next, hold: 0 };
      });
      paint(element, lines);
    };

    paint(element, lines);
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [analyser, resolved]);

  return <pre ref={ref} className={resolved ? "viz found" : "viz"} aria-hidden="true" />;
}
