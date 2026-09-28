import type { Category } from "../src/lib/types";
import { normalizeAnswer } from "../src/lib/normalize";
import { loadPlaylist } from "./playlist";

export interface Song {
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string;
  genre: string;
  year: number;
}

interface ItunesTrack {
  kind?: string;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  releaseDate?: string;
}

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const SKIP = /\b(remix|karaoke|instrumental|commentary|tribute|sped up|slowed)\b|\(live| - live/i;
const TTL_MS = 10 * 60 * 1000;

const SEARCHES: Record<Exclude<Category, "PLAYLIST">, { terms: string[]; minYear?: number; maxYear?: number; genre?: RegExp }> = {
  ALL: { terms: ["pop", "rap", "rock", "r&b", "indie"] },
  POP: { terms: ["pop", "dance pop", "synthpop", "electropop"], genre: /pop|dance/i },
  RAP: { terms: ["rap", "hip hop", "trap", "hip-hop"], genre: /rap|hip-?hop|trap/i },
  ROCK: { terms: ["rock", "alternative rock", "indie rock", "punk"], genre: /rock|alternative|indie|metal|punk/i },
  "2000s": { terms: ["2001", "2004", "2007", "2009 hits"], minYear: 2000, maxYear: 2009 },
  "2010s": { terms: ["2011", "2014", "2016", "2018 hits"], minYear: 2010, maxYear: 2019 },
  "2020s": { terms: ["2020", "2022", "2024", "2025 hits"], minYear: 2020, maxYear: 2029 },
};

const cache = new Map<Category, { at: number; songs: Song[] }>();

function largerArt(url?: string): string {
  if (!url) return "";
  return url.replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)/i, "/600x600bb.$1");
}

function toSong(track: ItunesTrack): Song | null {
  if (track.kind !== "song" || !track.previewUrl || !track.trackName || !track.artistName) return null;
  if (SKIP.test(track.trackName)) return null;
  const year = track.releaseDate ? new Date(track.releaseDate).getUTCFullYear() : 0;
  return {
    title: track.trackName,
    artist: track.artistName,
    previewUrl: track.previewUrl,
    artworkUrl: largerArt(track.artworkUrl100),
    genre: track.primaryGenreName || "Unknown",
    year: Number.isFinite(year) ? year : 0,
  };
}

async function search(term: string): Promise<Song[]> {
  const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=song&limit=50&country=US`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "guess-the-song/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`iTunes search failed (${response.status})`);
  const data = (await response.json()) as { results?: ItunesTrack[] };
  return (data.results ?? []).map(toSong).filter((song): song is Song => song !== null);
}

function dedupe(songs: Song[]): Song[] {
  const seen = new Set<string>();
  const unique: Song[] = [];
  for (const song of songs) {
    const key = normalizeAnswer(song.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(song);
  }
  return unique;
}

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

async function fetchCategory(category: Exclude<Category, "PLAYLIST">): Promise<Song[]> {
  const query = SEARCHES[category];
  const batches = await Promise.all(query.terms.map((term) => search(term).catch(() => [] as Song[])));
  let songs = dedupe(batches.flat());
  if (query.minYear !== undefined && query.maxYear !== undefined) {
    const ranged = songs.filter((song) => song.year >= query.minYear! && song.year <= query.maxYear!);
    if (ranged.length >= 8) songs = ranged;
  }
  if (query.genre) {
    const matched = songs.filter((song) => query.genre!.test(song.genre));
    if (matched.length >= 8) songs = matched;
  }
  return songs;
}

const FALLBACK: Song[] = [
  {
    title: "Heat Waves",
    artist: "Glass Animals",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a3/4c/b9/a34cb911-40fc-5f0c-e862-14bd171a77aa/mzaf_384792072030970151.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/da/8b/77/da8b7731-6f4f-eacf-5e74-8b23389eefa1/20UMGIM03371.rgb.jpg/600x600bb.jpg",
    genre: "Alternative",
    year: 2020,
  },
  {
    title: "Can't Feel My Face",
    artist: "The Weeknd",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e0/4d/65/e04d6546-d5ae-28bf-51fa-e4e54d737c2f/mzaf_17329746342766146939.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/30/05/1e/30051e57-a63a-3acc-4b30-42568293f5f7/15UMGIM36514.rgb.jpg/600x600bb.jpg",
    genre: "R&B/Soul",
    year: 2015,
  },
  {
    title: "When I Was Your Man",
    artist: "Bruno Mars",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6b/86/81/6b868187-1d8c-a6c1-51ca-f1f0fbd4a7ac/mzaf_4398730586437868651.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e0/a4/7c/e0a47c6f-005a-9f9f-ce29-8e858e2bcfcb/075679957283.jpg/600x600bb.jpg",
    genre: "Pop",
    year: 2012,
  },
  {
    title: "Perfect",
    artist: "Ed Sheeran",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c7/ba/bc/c7babc66-f598-aaa6-bcf6-307281795817/mzaf_16337361235117168274.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/15/e6/e8/15e6e8a4-4190-6a8b-86c3-ab4a51b88288/190295851286.jpg/600x600bb.jpg",
    genre: "Pop",
    year: 2017,
  },
  {
    title: "Lover",
    artist: "Taylor Swift",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e0/db/47/e0db47b0-7f70-0631-0414-cd4777d2fb3e/mzaf_6362891154838442638.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/600x600bb.jpg",
    genre: "Pop",
    year: 2019,
  },
  {
    title: "Happier",
    artist: "Marshmello & Bastille",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/fb/3f/e6/fb3fe69b-1f83-dae3-ad86-34b73a50e86c/mzaf_12086156071273718688.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e5/61/69/e561696f-40c5-19c1-ec6d-5b2dfaa919f2/21.jpg/600x600bb.jpg",
    genre: "Dance",
    year: 2018,
  },
  {
    title: "No Scrubs",
    artist: "TLC",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c9/64/38/c964385e-f18a-fd99-638c-76d4f9bdd4e2/mzaf_4744709234124158764.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2d/19/0c/2d190ce6-a157-6364-b5b4-e9b00265d313/mzi.ucefobwj.jpg/600x600bb.jpg",
    genre: "R&B/Soul",
    year: 1999,
  },
  {
    title: "Lose Control",
    artist: "Teddy Swims",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9f/65/d6/9f65d67d-db40-d7da-c954-9a23d28dfe1a/mzaf_7625794503195542708.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/36/19/66/36196640-1561-dc5e-c6bc-1e5f4befa583/093624856771.jpg/600x600bb.jpg",
    genre: "Pop",
    year: 2023,
  },
  {
    title: "WILDFLOWER",
    artist: "Billie Eilish",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/de/c3/e8/dec3e884-7237-9622-718a-12c5f48c5ca2/mzaf_3134455671785145822.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg",
    genre: "Alternative",
    year: 2024,
  },
  {
    title: "We Can't Stop",
    artist: "Miley Cyrus",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fe/50/86/fe5086f7-e8ff-cce6-0820-c17ac814c49d/mzaf_7121731585584531913.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e3/e0/84/e3e08400-2d03-75f9-6b8b-a3345452aa98/886444197816.jpg/600x600bb.jpg",
    genre: "Pop",
    year: 2013,
  },
  {
    title: "You Need To Calm Down",
    artist: "Taylor Swift",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e8/80/4f/e8804fa1-6118-74fd-4602-b96969ebef41/mzaf_5457103975229379192.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/600x600bb.jpg",
    genre: "Pop",
    year: 2019,
  },
  {
    title: "POP!",
    artist: "NAYEON",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/cc/74/22/cc7422df-1686-77ff-d3b0-2a2eb093fd76/mzaf_17159235851286493668.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/3f/49/ec/3f49ecb2-cb91-dd28-45b9-a31326d7e63b/738676859614_Cover.jpg/600x600bb.jpg",
    genre: "Dance",
    year: 2022,
  },
];

export async function loadSongs(category: Category, count: number): Promise<Song[]> {
  if (category === "PLAYLIST") return loadPlaylist();

  const cached = cache.get(category);
  if (cached && Date.now() - cached.at < TTL_MS && cached.songs.length >= count) {
    return shuffle(cached.songs).slice(0, count);
  }

  try {
    const songs = await fetchCategory(category);
    if (songs.length >= count) {
      cache.set(category, { at: Date.now(), songs });
      console.log(`loaded ${songs.length} ${category} songs`);
      return shuffle(songs).slice(0, count);
    }
  } catch (error) {
    console.error("itunes search failed", error);
  }

  if (FALLBACK.length >= count) {
    console.log(`using fallback songs for ${category}`);
    return shuffle(FALLBACK).slice(0, count);
  }

  throw new Error("COULD NOT LOAD SONGS");
}
