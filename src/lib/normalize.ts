const ARTIST_SPLIT = /\s*(?:,|&|\band\b|\bx\b|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i;

export function normalizeAnswer(input: string): string {
  let value = input.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  value = value.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
  value = value.split(/\s[-–—]\s/)[0] ?? value;
  value = value.replace(/\b(feat|ft|featuring)\b\.?/g, " ");
  value = value.replace(/[-–—_/]+/g, " ");
  value = value.replace(/[^a-z0-9\s]/g, "");
  return value.replace(/\s+/g, " ").trim();
}

function acceptedAnswers(title: string, artist: string): Set<string> {
  const keys = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeAnswer(value);
    if (normalized) keys.add(normalized);
  };

  add(title);
  add(artist);
  for (const part of artist.split(ARTIST_SPLIT)) add(part);
  return keys;
}

export function isCorrectGuess(guess: string, title: string, artist: string): boolean {
  const normalized = normalizeAnswer(guess);
  if (!normalized) return false;
  return acceptedAnswers(title, artist).has(normalized);
}
