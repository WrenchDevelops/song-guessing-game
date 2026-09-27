export const ROUNDS = [5, 10, 15, 20] as const;
export const DURATIONS = [10, 15, 20] as const;
export const CATEGORIES = ["ALL", "POP", "RAP", "ROCK", "2000s", "2010s", "2020s"] as const;

export type Rounds = (typeof ROUNDS)[number];
export type DurationSec = (typeof DURATIONS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Phase = "lobby" | "playing" | "reveal" | "final";

export interface Settings {
  rounds: Rounds;
  category: Category;
  durationSec: DurationSec;
}

export const DEFAULT_SETTINGS: Settings = {
  rounds: 10,
  category: "ALL",
  durationSec: 15,
};

export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
}

export interface Solver {
  id: string;
  name: string;
}

export interface RevealPayload {
  title: string;
  artist: string;
  artworkUrl: string;
  genre: string;
  year: number;
  yourPoints: number;
}

export interface GameSnapshot {
  phase: Phase;
  roomCode: string;
  playerId: string;
  hostId: string;
  players: PublicPlayer[];
  settings: Settings;
  round: number;
  totalRounds: number;
  durationMs: number;
  startedAt: number;
  serverNow: number;
  previewToken: string | null;
  youSolved: boolean;
  solvers: Solver[];
  reveal: RevealPayload | null;
  leaderboard: LeaderboardEntry[];
}

export type ClientMessage =
  | { type: "create"; name: string }
  | { type: "join"; code: string; name: string }
  | { type: "rejoin"; code: string; playerId: string }
  | { type: "settings"; settings: Settings }
  | { type: "start" }
  | { type: "guess"; text: string }
  | { type: "lobby_again" };

export type ServerMessage =
  | { type: "snapshot"; snapshot: GameSnapshot }
  | { type: "guess_result"; playerId: string; playerName: string; correct: boolean }
  | { type: "error"; message: string };
