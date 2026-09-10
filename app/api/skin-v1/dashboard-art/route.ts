import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Legacy #1754 source was docs/brand/plotpickle-banner-dragon-logo.jpg.
// Skin V1 now owns the approved Dashboard WebP in the public skin asset package.
const DASHBOARD_ART = path.join(
  process.cwd(),
  "public",
  "brand",
  "dashboard",
  "plotpickle-observatory-dragon.webp",
);

async function readDashboardArtwork() {
  return { image: await readFile(DASHBOARD_ART), contentType: "image/webp" } as const;
}

export async function GET() {
  try {
    const { image, contentType } = await readDashboardArtwork();
    return new Response(new Uint8Array(image), {
      status: 200,
      headers: {
        "Content-Type": contentType,
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
