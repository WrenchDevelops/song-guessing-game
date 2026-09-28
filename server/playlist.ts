import { normalizeAnswer } from "../src/lib/normalize";
import { PLAYLIST_ITUNES, PLAYLIST_TRACKS, type PlaylistTrack } from "./playlist-data";
import type { Song } from "./songs";

const BAD = /\b(remix|karaoke|instrumental|commentary|tribute|sped up|slowed|originally performed)\b|\(live| - live/i;
const TTL_MS = 6 * 60 * 60 * 1000;

interface DeezerHit {
  title?: string;
  preview?: string;
  artist?: { name?: string };
  album?: { cover_xl?: string; cover_big?: string };
}

function artistParts(artist: string): string[] {
  return artist
    .split(/\s*(?:,|&|\band\b|\bx\b)\s*/i)
    .map((part) => normalizeAnswer(part))
    .filter((part) => part.length > 1);
}

function artistHit(got: string, wanted: string): boolean {
  const name = normalizeAnswer(got);
  return artistParts(wanted).some((part) => name.includes(part));
}

function versionOk(wanted: string, got: string): boolean {
  return !(BAD.test(got) && !BAD.test(wanted));
}

function trackKey(title: string, artist: string): string {
  return `${normalizeAnswer(title)}|${normalizeAnswer(artist)}`;
}

const itunes = new Map(PLAYLIST_ITUNES.map((song) => [trackKey(song.title, song.artist), song]));

function deezerPreview(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".dzcdn.net") && parsed.pathname.startsWith("/api/1/");
  } catch {
    return false;
  }
}

function fromDeezer(track: PlaylistTrack, hit: DeezerHit): Song | null {
  if (!hit.preview || !hit.title || !hit.artist?.name || !deezerPreview(hit.preview)) return null;
  if (normalizeAnswer(hit.title) !== normalizeAnswer(track.title)) return null;
  if (!versionOk(track.title, hit.title) || !artistHit(hit.artist.name, track.artist)) return null;
  return {
    title: track.title,
    artist: track.artist,
    previewUrl: hit.preview,
    artworkUrl: hit.album?.cover_xl || hit.album?.cover_big || "",
    genre: "",
    year: 0,
  };
}

async function searchDeezer(term: string): Promise<DeezerHit[]> {
  const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(term)}`, {
    headers: { Accept: "application/json", "User-Agent": "guess-the-song/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`deezer ${response.status}`);
  const data = (await response.json()) as { data?: DeezerHit[]; error?: { message?: string } };
  if (data.error?.message) throw new Error(data.error.message);
  return data.data ?? [];
}

async function resolveOne(track: PlaylistTrack): Promise<Song | null> {
  const first = track.artist.split(",")[0]?.trim() || track.artist;
  const clean = track.title.replace(/\([^)]*\)/g, " ").split(/\s[-–—]\s/)[0]?.trim() || track.title;
  const term = `${clean} ${first}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const hits = await searchDeezer(term);
      const match = hits.map((hit) => fromDeezer(track, hit)).find((song): song is Song => song !== null);
      if (match) return match;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (attempt === 0 && /quota/i.test(message)) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      break;
    }
  }
  return itunes.get(trackKey(track.title, track.artist)) ?? null;
}

function shuffle(songs: Song[]): Song[] {
  const copy = songs.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

let cached: { at: number; songs: Song[] } | null = null;
let pending: Promise<Song[]> | null = null;

async function resolveAll(): Promise<Song[]> {
  const songs: Song[] = [];
  const queue = PLAYLIST_TRACKS.slice();
  async function worker() {
    while (queue.length > 0) {
      const track = queue.shift();
      if (!track) return;
      const song = await resolveOne(track);
      if (song) songs.push(song);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (songs.length < 8) throw new Error("COULD NOT LOAD SONGS");
  return songs;
}

export function loadPlaylist(): Promise<Song[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(shuffle(cached.songs));
  if (!pending) {
    pending = resolveAll()
      .then((songs) => {
        cached = { at: Date.now(), songs };
        console.log(`loaded ${songs.length} PLAYLIST songs`);
        return songs;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending.then((songs) => shuffle(songs));
}
