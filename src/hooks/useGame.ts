"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { unlockAudio } from "@/lib/audio";
import type { ClientMessage, GameSnapshot, ServerMessage, Settings, Solver } from "@/lib/types";

const SESSION_KEY = "gts-session";

interface Session {
  roomCode: string;
  playerId: string;
}

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.roomCode || !parsed.playerId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(snapshot: GameSnapshot) {
  const session: Session = { roomCode: snapshot.roomCode, playerId: snapshot.playerId };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const url = new URL(window.location.href);
  url.searchParams.set("room", snapshot.roomCode);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function useGame() {
  const [ready, setReady] = useState(true);
  const [booting, setBooting] = useState(false);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [youSolved, setYouSolved] = useState(false);
  const [solvers, setSolvers] = useState<Solver[]>([]);
  const [rejectNonce, setRejectNonce] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);
  const playerIdRef = useRef("");

  const ensureSocket = useCallback(() => {
    const current = wsRef.current;
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
      return current;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      const queued = queueRef.current.splice(0, queueRef.current.length);
      for (const raw of queued) ws.send(raw);
    };

    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === "error") {
        setError(message.message);
        setStarting(false);
        setBooting(false);
        if (message.message === "ROOM NOT FOUND" || message.message === "GAME ALREADY STARTED") {
          sessionStorage.removeItem(SESSION_KEY);
        }
        return;
      }

      if (message.type === "snapshot") {
        playerIdRef.current = message.snapshot.playerId;
        setSnapshot(message.snapshot);
        setClockOffset(message.snapshot.serverNow - Date.now());
        setError(null);
        setStarting(false);
        setBooting(false);
        writeSession(message.snapshot);
        return;
      }

      if (message.type === "guess_result") {
        if (!message.correct) {
          if (message.playerId === playerIdRef.current) setRejectNonce((value) => value + 1);
          return;
        }
        setSolvers((current) =>
          current.some((solver) => solver.id === message.playerId)
            ? current
            : [...current, { id: message.playerId, name: message.playerName }],
        );
        if (message.playerId === playerIdRef.current) setYouSolved(true);
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      setStarting(false);
      setBooting(false);
    };

    return ws;
  }, []);

  const send = useCallback(
    (message: ClientMessage) => {
      const raw = JSON.stringify(message);
      const ws = ensureSocket();
      if (ws.readyState === WebSocket.OPEN) ws.send(raw);
      else queueRef.current.push(raw);
    },
    [ensureSocket],
  );

  useEffect(() => {
    setReady(true);
    const saved = readSession();
    if (!saved) return;
    setBooting(true);
    send({ type: "rejoin", code: saved.roomCode, playerId: saved.playerId });
  }, [send]);

  useEffect(() => {
    const arm = () => unlockAudio();
    window.addEventListener("pointerdown", arm);
    return () => window.removeEventListener("pointerdown", arm);
  }, []);

  const roundKey = snapshot ? `${snapshot.phase}:${snapshot.round}:${snapshot.startedAt}` : "";
  const [trackedRound, setTrackedRound] = useState(roundKey);
  if (trackedRound !== roundKey) {
    setTrackedRound(roundKey);
    setYouSolved(snapshot?.youSolved ?? false);
    setSolvers(snapshot?.solvers ?? []);
  } else if (snapshot?.youSolved && !youSolved) {
    setYouSolved(true);
    setSolvers(snapshot.solvers);
  }

  const create = useCallback(
    (name: string) => {
      unlockAudio();
      setError(null);
      send({ type: "create", name });
    },
    [send],
  );

  const join = useCallback(
    (code: string, name: string) => {
      unlockAudio();
      setError(null);
      send({ type: "join", code, name });
    },
    [send],
  );

  const setSettings = useCallback(
    (settings: Settings) => {
      send({ type: "settings", settings });
    },
    [send],
  );

  const start = useCallback(() => {
    unlockAudio();
    setError(null);
    setStarting(true);
    send({ type: "start" });
  }, [send]);

  const guess = useCallback(
    (text: string) => {
      send({ type: "guess", text });
    },
    [send],
  );

  const lobbyAgain = useCallback(() => {
    send({ type: "lobby_again" });
  }, [send]);

  return {
    ready,
    booting,
    snapshot,
    error,
    starting,
    youSolved,
    solvers,
    rejectNonce,
    clockOffset,
    create,
    join,
    setSettings,
    start,
    guess,
    lobbyAgain,
  };
}
