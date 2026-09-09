import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const DASHBOARD_ART = path.join(
  process.cwd(),
  "docs",
  "brand",
  "plotpickle-banner-dragon-logo.jpg",
);

export async function GET() {
  try {
    const image = await readFile(DASHBOARD_ART);
    return new Response(new Uint8Array(image), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("PlotPickle Dashboard artwork is unavailable.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
