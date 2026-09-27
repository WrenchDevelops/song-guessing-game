export interface Suggestion {
  kind: "song" | "artist";
  label: string;
  detail: string;
  artworkUrl: string;
}

interface ItunesHit {
  wrapperType?: string;
  kind?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
}

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const cache = new Map<string, { at: number; songs: Suggestion[]; artists: Suggestion[] }>();
const TTL_MS = 60_000;

function art(url?: string): string {
  if (!url) return "";
  return url.replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)/i, "/100x100bb.$1");
}

async function lookup(term: string, entity: "song" | "musicArtist"): Promise<ItunesHit[]> {
  const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=${entity}&limit=8&country=US`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "guess-the-song/1.0" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { results?: ItunesHit[] };
  return data.results ?? [];
}

export async function suggest(raw: string): Promise<{ songs: Suggestion[]; artists: Suggestion[] }> {
  const term = raw.replace(/\s+/g, " ").trim().slice(0, 80);
  if (term.length < 2) return { songs: [], artists: [] };

  const key = term.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return { songs: cached.songs, artists: cached.artists };

  const [songHits, artistHits] = await Promise.all([lookup(term, "song"), lookup(term, "musicArtist")]);

  const songs: Suggestion[] = [];
  const seenSongs = new Set<string>();
  for (const hit of songHits) {
    if (hit.kind !== "song" || !hit.trackName || !hit.artistName) continue;
    const id = `${hit.trackName}\0${hit.artistName}`.toLowerCase();
    if (seenSongs.has(id)) continue;
    seenSongs.add(id);
    songs.push({ kind: "song", label: hit.trackName, detail: hit.artistName, artworkUrl: art(hit.artworkUrl100) });
    if (songs.length === 6) break;
  }

  const artists: Suggestion[] = [];
  const seenArtists = new Set<string>();
  for (const hit of artistHits) {
    if (!hit.artistName) continue;
    const id = hit.artistName.toLowerCase();
    if (seenArtists.has(id)) continue;
    seenArtists.add(id);
    artists.push({ kind: "artist", label: hit.artistName, detail: "ARTIST", artworkUrl: "" });
    if (artists.length === 4) break;
  }

  cache.set(key, { at: Date.now(), songs, artists });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return { songs, artists };
}
