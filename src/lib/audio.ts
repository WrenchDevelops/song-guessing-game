let context: AudioContext | null = null;

export function unlockAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!context) context = new AudioCtx();
  if (context.state === "suspended") void context.resume();
  return context;
}
