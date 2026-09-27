import { randomBytes } from "node:crypto";
import { WebSocket } from "ws";
import { isCorrectGuess } from "../src/lib/normalize";
import { pointsForGuess } from "../src/lib/scoring";
import {
  CATEGORIES,
  DEFAULT_SETTINGS,
  DURATIONS,
  ROUNDS,
  type Category,
  type ClientMessage,
  type DurationSec,
  type GameSnapshot,
  type LeaderboardEntry,
  type Rounds,
  type ServerMessage,
  type Settings,
} from "../src/lib/types";
import { issuePreview } from "./preview";
import { loadSongs, type Song } from "./songs";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_PLAYERS = 8;
const LEAVE_MS = 15_000;
const REVEAL_MS = 6_000;
const ARM_MS = 500;
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .'_-]{0,15}$/u;

interface Player {
  id: string;
  name: string;
  score: number;
  ws: WebSocket | null;
  solved: boolean;
  roundPoints: number;
  leaveTimer: ReturnType<typeof setTimeout> | null;
}

interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  settings: Settings;
  phase: GameSnapshot["phase"];
  songs: Song[];
  roundIndex: number;
  startedAt: number;
  durationMs: number;
  timer: ReturnType<typeof setTimeout> | null;
  current: Song | null;
  previewToken: string | null;
  starting: boolean;
}

const rooms = new Map<string, Room>();
const sockets = new Map<WebSocket, { code: string; playerId: string }>();

function send(ws: WebSocket | null, message: ServerMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(message));
}

function fail(ws: WebSocket, message: string) {
  send(ws, { type: "error", message });
}

function cleanName(input: string): string | null {
  const name = input.replace(/\s+/g, " ").trim();
  if (!NAME_PATTERN.test(name)) return null;
  return name;
}

function uniqueName(room: Room, name: string): string {
  const taken = new Set([...room.players.values()].map((player) => player.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  let suffix = 2;
  let next = name;
  while (taken.has(next.toLowerCase())) {
    const ending = ` ${suffix}`;
    next = `${name.slice(0, 16 - ending.length)}${ending}`;
    suffix += 1;
  }
  return next;
}

function makeCode(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = "";
    for (let index = 0; index < 4; index += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
}

function clearTimer(room: Room) {
  if (!room.timer) return;
  clearTimeout(room.timer);
  room.timer = null;
}

function leaderboardFor(room: Room): LeaderboardEntry[] {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((player, index) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      rank: index + 1,
    }));
}

function snapshotFor(room: Room, player: Player, leaderboard: LeaderboardEntry[]): GameSnapshot {
  const playing = room.phase === "playing";
  const revealing = room.phase === "reveal" && room.current;
  return {
    phase: room.phase,
    roomCode: room.code,
    playerId: player.id,
    hostId: room.hostId,
    players: [...room.players.values()].map((entry) => ({
      id: entry.id,
      name: entry.name,
      score: entry.score,
      isHost: entry.id === room.hostId,
    })),
    settings: room.settings,
    round: room.phase === "lobby" ? 0 : room.roundIndex + 1,
    totalRounds: room.songs.length || room.settings.rounds,
    durationMs: room.durationMs,
    startedAt: room.startedAt,
    serverNow: Date.now(),
    previewToken: playing ? room.previewToken : null,
    youSolved: player.solved,
    solvers: [...room.players.values()]
      .filter((entry) => entry.solved)
      .map((entry) => ({ id: entry.id, name: entry.name })),
    reveal: revealing
      ? {
          title: room.current!.title,
          artist: room.current!.artist,
          artworkUrl: room.current!.artworkUrl,
          genre: room.current!.genre,
          year: room.current!.year,
          yourPoints: player.roundPoints,
        }
      : null,
    leaderboard,
  };
}

function broadcast(room: Room) {
  const leaderboard = leaderboardFor(room);
  for (const player of room.players.values()) {
    send(player.ws, { type: "snapshot", snapshot: snapshotFor(room, player, leaderboard) });
  }
}

function resetRoundFlags(room: Room) {
  for (const player of room.players.values()) {
    player.solved = false;
    player.roundPoints = 0;
  }
}

function beginRound(room: Room) {
  const song = room.songs[room.roundIndex];
  if (!song) {
    room.phase = "final";
    room.current = null;
    room.previewToken = null;
    broadcast(room);
    return;
  }

  resetRoundFlags(room);
  room.current = song;
  room.previewToken = issuePreview(song.previewUrl);
  room.startedAt = Date.now() + ARM_MS;
  room.phase = "playing";
  clearTimer(room);
  room.timer = setTimeout(() => endRound(room), room.startedAt + room.durationMs - Date.now());
  broadcast(room);
}

function endRound(room: Room) {
  if (room.phase !== "playing") return;
  room.phase = "reveal";
  room.previewToken = null;
  clearTimer(room);
  broadcast(room);
  room.timer = setTimeout(() => advance(room), REVEAL_MS);
}

function advance(room: Room) {
  if (room.phase !== "reveal") return;
  if (room.roundIndex + 1 >= room.songs.length) {
    room.phase = "final";
    room.current = null;
    room.previewToken = null;
    clearTimer(room);
    broadcast(room);
    return;
  }
  room.roundIndex += 1;
  beginRound(room);
}

function removePlayer(room: Room, playerId: string) {
  const player = room.players.get(playerId);
  if (!player) return;
  if (player.leaveTimer) clearTimeout(player.leaveTimer);
  room.players.delete(playerId);
  if (room.players.size === 0) {
    clearTimer(room);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === playerId) {
    const next = room.players.values().next().value;
    if (next) room.hostId = next.id;
  }
  broadcast(room);
}

function createPlayer(name: string): Player {
  return {
    id: randomBytes(8).toString("hex"),
    name,
    score: 0,
    ws: null,
    solved: false,
    roundPoints: 0,
    leaveTimer: null,
  };
}

function attach(room: Room, player: Player, ws: WebSocket) {
  if (player.leaveTimer) {
    clearTimeout(player.leaveTimer);
    player.leaveTimer = null;
  }
  const previous = player.ws;
  player.ws = ws;
  sockets.set(ws, { code: room.code, playerId: player.id });
  if (previous && previous !== ws) {
    sockets.delete(previous);
    previous.close();
  }
}

function parseSettings(value: unknown): Settings | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Settings;
  if (!(ROUNDS as readonly number[]).includes(raw.rounds)) return null;
  if (!(DURATIONS as readonly number[]).includes(raw.durationSec)) return null;
  if (!(CATEGORIES as readonly string[]).includes(raw.category)) return null;
  return {
    rounds: raw.rounds as Rounds,
    durationSec: raw.durationSec as DurationSec,
    category: raw.category as Category,
  };
}

function readMessage(raw: unknown): ClientMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const message = raw as { type?: unknown; name?: unknown; code?: unknown; playerId?: unknown; text?: unknown; settings?: unknown };
  if (message.type === "create" && typeof message.name === "string") return { type: "create", name: message.name };
  if (message.type === "join" && typeof message.code === "string" && typeof message.name === "string") {
    return { type: "join", code: message.code, name: message.name };
  }
  if (message.type === "rejoin" && typeof message.code === "string" && typeof message.playerId === "string") {
    return { type: "rejoin", code: message.code, playerId: message.playerId };
  }
  if (message.type === "settings") {
    const settings = parseSettings(message.settings);
    if (!settings) return null;
    return { type: "settings", settings };
  }
  if (message.type === "start") return { type: "start" };
  if (message.type === "guess" && typeof message.text === "string") return { type: "guess", text: message.text };
  if (message.type === "lobby_again") return { type: "lobby_again" };
  return null;
}

function roomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function requireHost(room: Room, player: Player, ws: WebSocket): boolean {
  if (player.id === room.hostId) return true;
  fail(ws, "ONLY THE HOST CAN DO THAT");
  return false;
}

async function startGame(room: Room, ws: WebSocket) {
  if (room.phase !== "lobby") {
    fail(ws, "GAME ALREADY STARTED");
    return;
  }
  if (room.starting) return;
  room.starting = true;
  try {
    const songs = await loadSongs(room.settings.category, room.settings.rounds);
    if (!rooms.has(room.code) || room.phase !== "lobby") return;
    room.songs = songs;
    room.roundIndex = 0;
    room.durationMs = room.settings.durationSec * 1000;
    beginRound(room);
  } catch (error) {
    console.error(error);
    fail(ws, "COULD NOT LOAD SONGS");
  } finally {
    room.starting = false;
  }
}

function guess(room: Room, player: Player, text: string) {
  if (room.phase !== "playing" || !room.current || player.solved) return;
  const attempt = text.slice(0, 80);
  if (!isCorrectGuess(attempt, room.current.title, room.current.artist)) {
    send(player.ws, { type: "guess_result", playerId: player.id, playerName: player.name, correct: false });
    return;
  }

  const elapsed = Math.max(0, Date.now() - room.startedAt);
  const points = pointsForGuess(elapsed, room.durationMs);
  player.score += points;
  player.roundPoints = points;
  player.solved = true;

  for (const other of room.players.values()) {
    send(other.ws, { type: "guess_result", playerId: player.id, playerName: player.name, correct: true });
  }
}

function returnToLobby(room: Room) {
  clearTimer(room);
  room.phase = "lobby";
  room.songs = [];
  room.roundIndex = 0;
  room.current = null;
  room.previewToken = null;
  room.startedAt = 0;
  room.durationMs = room.settings.durationSec * 1000;
  for (const player of room.players.values()) {
    player.score = 0;
    player.solved = false;
    player.roundPoints = 0;
  }
  broadcast(room);
}

function onMessage(ws: WebSocket, message: ClientMessage) {
  if (message.type === "create") {
    const name = cleanName(message.name);
    if (!name) {
      fail(ws, "ENTER A NAME");
      return;
    }
    const room: Room = {
      code: makeCode(),
      hostId: "",
      players: new Map(),
      settings: { ...DEFAULT_SETTINGS },
      phase: "lobby",
      songs: [],
      roundIndex: 0,
      startedAt: 0,
      durationMs: DEFAULT_SETTINGS.durationSec * 1000,
      timer: null,
      current: null,
      previewToken: null,
      starting: false,
    };
    const player = createPlayer(name);
    room.hostId = player.id;
    room.players.set(player.id, player);
    rooms.set(room.code, room);
    attach(room, player, ws);
    broadcast(room);
    return;
  }

  if (message.type === "join") {
    const name = cleanName(message.name);
    if (!name) {
      fail(ws, "ENTER A NAME");
      return;
    }
    const room = rooms.get(roomCode(message.code));
    if (!room) {
      fail(ws, "ROOM NOT FOUND");
      return;
    }
    if (room.phase !== "lobby") {
      fail(ws, "GAME ALREADY STARTED");
      return;
    }
    if (room.players.size >= MAX_PLAYERS) {
      fail(ws, "ROOM IS FULL");
      return;
    }
    const player = createPlayer(uniqueName(room, name));
    room.players.set(player.id, player);
    attach(room, player, ws);
    broadcast(room);
    return;
  }

  if (message.type === "rejoin") {
    const room = rooms.get(roomCode(message.code));
    const player = room?.players.get(message.playerId);
    if (!room || !player) {
      fail(ws, "ROOM NOT FOUND");
      return;
    }
    attach(room, player, ws);
    broadcast(room);
    return;
  }

  const meta = sockets.get(ws);
  const room = meta ? rooms.get(meta.code) : undefined;
  const player = room && meta ? room.players.get(meta.playerId) : undefined;
  if (!room || !player) {
    fail(ws, "ROOM NOT FOUND");
    return;
  }

  if (message.type === "settings") {
    if (!requireHost(room, player, ws) || room.phase !== "lobby" || room.starting) return;
    room.settings = message.settings;
    room.durationMs = message.settings.durationSec * 1000;
    broadcast(room);
    return;
  }

  if (message.type === "start") {
    if (!requireHost(room, player, ws)) return;
    void startGame(room, ws);
    return;
  }

  if (message.type === "guess") {
    guess(room, player, message.text);
    return;
  }

  if (message.type === "lobby_again") {
    if (!requireHost(room, player, ws) || room.phase !== "final") return;
    returnToLobby(room);
  }
}

export function handleConnection(ws: WebSocket) {
  ws.on("message", (data) => {
    const text = data.toString();
    if (text.length > 2000) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    const message = readMessage(parsed);
    if (!message) return;
    onMessage(ws, message);
  });

  ws.on("close", () => {
    const meta = sockets.get(ws);
    sockets.delete(ws);
    if (!meta) return;
    const room = rooms.get(meta.code);
    const player = room?.players.get(meta.playerId);
    if (!room || !player || player.ws !== ws) return;
    player.ws = null;
    player.leaveTimer = setTimeout(() => removePlayer(room, player.id), LEAVE_MS);
  });
}
