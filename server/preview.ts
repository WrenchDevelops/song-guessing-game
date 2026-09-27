import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const previews = new Map<string, { url: string; exp: number }>();

function isAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "audio-ssl.itunes.apple.com" || parsed.hostname === "audio.itunes.apple.com")
    );
  } catch {
    return false;
  }
}

export function issuePreview(url: string): string {
  const id = randomBytes(18).toString("base64url");
  previews.set(id, { url, exp: Date.now() + 30 * 60 * 1000 });
  return id;
}

function resolvePreview(id: string): string | null {
  const row = previews.get(id);
  if (!row) return null;
  if (row.exp < Date.now() || !isAllowed(row.url)) {
    previews.delete(id);
    return null;
  }
  return row.url;
}

export async function pipePreview(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const url = resolvePreview(id);
  if (!url) {
    res.statusCode = 403;
    res.end();
    return;
  }

  const headers: Record<string, string> = {
    "User-Agent": "guess-the-song/1.0",
    Accept: "*/*",
  };
  if (req.headers.range) headers.Range = String(req.headers.range);

  const upstream = await fetch(url, { headers });
  res.statusCode = upstream.status;
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  res.setHeader("cache-control", "no-store");
  res.setHeader("access-control-allow-origin", "*");

  if (!upstream.body) {
    res.end();
    return;
  }

  await pipeline(Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream), res);
}
