"use client";

import { FinalResults } from "@/components/FinalResults";
import { GameRound } from "@/components/GameRound";
import { Landing } from "@/components/Landing";
import { Lobby } from "@/components/Lobby";
import { SongReveal } from "@/components/SongReveal";
import { useGame } from "@/hooks/useGame";

export default function Home() {
  const game = useGame();

  if (!game.ready) return <main className="stage" />;

  if (game.booting && !game.snapshot) {
    return (
      <main className="stage">
        <p className="wait">CONNECTING...</p>
      </main>
    );
  }

  if (!game.snapshot) {
    return <Landing error={game.error} onCreate={game.create} onJoin={game.join} />;
  }

  const snapshot = game.snapshot;
  const youAreHost = snapshot.playerId === snapshot.hostId;

  if (snapshot.phase === "lobby") {
    return (
      <Lobby
        code={snapshot.roomCode}
        players={snapshot.players}
        settings={snapshot.settings}
        youAreHost={youAreHost}
        starting={game.starting}
        error={game.error}
        onSettings={game.setSettings}
        onStart={game.start}
      />
    );
  }

  if (snapshot.phase === "playing" && snapshot.previewToken) {
    return (
      <GameRound
        key={snapshot.startedAt}
        round={snapshot.round}
        totalRounds={snapshot.totalRounds}
        durationMs={snapshot.durationMs}
        startedAt={snapshot.startedAt}
        clockOffset={game.clockOffset}
        previewToken={snapshot.previewToken}
        youSolved={game.youSolved}
        solvers={game.solvers}
        youId={snapshot.playerId}
        rejectNonce={game.rejectNonce}
        choices={snapshot.choices}
        yourPick={snapshot.yourPick}
        onGuess={game.guess}
      />
    );
  }

  if (snapshot.phase === "reveal" && snapshot.reveal) {
    return (
      <SongReveal
        title={snapshot.reveal.title}
        artist={snapshot.reveal.artist}
        artworkUrl={snapshot.reveal.artworkUrl}
        genre={snapshot.reveal.genre}
        year={snapshot.reveal.year}
        yourPoints={snapshot.reveal.yourPoints}
        leaderboard={snapshot.leaderboard}
      />
    );
  }

  return <FinalResults leaderboard={snapshot.leaderboard} youAreHost={youAreHost} onAgain={game.lobbyAgain} />;
}
