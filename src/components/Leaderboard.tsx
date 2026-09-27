import { formatScore } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  if (entries.length === 0) return null;
  return (
    <ol className="board">
      {entries.map((entry) => (
        <li key={entry.id}>
          {entry.rank}. {entry.name} — {formatScore(entry.score)}
        </li>
      ))}
    </ol>
  );
}
