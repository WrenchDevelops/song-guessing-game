import { formatScore } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/types";
import { Leaderboard } from "./Leaderboard";

interface SongRevealProps {
  title: string;
  artist: string;
  artworkUrl: string;
  genre: string;
  year: number;
  yourPoints: number;
  leaderboard: LeaderboardEntry[];
}

export function SongReveal({ title, artist, artworkUrl, genre, year, yourPoints, leaderboard }: SongRevealProps) {
  const meta = [genre, year > 0 ? String(year) : ""].filter(Boolean).join(" · ");

  return (
    <main className="stage">
      <div>
        <h2 className="song-title">{title}</h2>
        <p className="artist">{artist}</p>
        {meta && <p className="hint">{meta}</p>}
      </div>
      {artworkUrl && (
        // Album art is a one-off external image shown only after the round ends.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="art" src={artworkUrl} alt="" width={280} height={280} />
      )}
      <p className="delta">+{formatScore(yourPoints)} POINTS</p>
      <Leaderboard entries={leaderboard} />
    </main>
  );
}
