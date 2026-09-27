"use client";

import { formatScore } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/types";
import { Leaderboard } from "./Leaderboard";

interface FinalResultsProps {
  leaderboard: LeaderboardEntry[];
  youAreHost: boolean;
  onAgain: () => void;
}

export function FinalResults({ leaderboard, youAreHost, onAgain }: FinalResultsProps) {
  const [winner, ...rest] = leaderboard;

  return (
    <main className="stage">
      <p className="kicker">GAME OVER</p>
      {winner && (
        <div className="winner">
          <p className="rank">{winner.rank}</p>
          <h2>{winner.name}</h2>
          <p className="score">{formatScore(winner.score)}</p>
        </div>
      )}
      <Leaderboard entries={rest} />
      {youAreHost ? (
        <button type="button" onClick={onAgain}>
          NEW GAME
        </button>
      ) : (
        <p className="wait">WAITING FOR HOST...</p>
      )}
    </main>
  );
}
