export function pointsForGuess(elapsedMs: number, durationMs: number): number {
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed <= 3000) return 1000;

  const span = Math.max(1, durationMs - 3000);
  const progress = Math.min(1, (elapsed - 3000) / span);
  return Math.max(100, Math.round(1000 - 900 * progress));
}
