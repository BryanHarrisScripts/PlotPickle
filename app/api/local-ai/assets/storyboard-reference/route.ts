import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

function boundedInteger(value: string | null, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function referenceAsset(block: number, mini: number) {
  const extension = block > 21 ? "svg" : "webp";
  const filename = `block-${String(block).padStart(2, "0")}-mini-${mini}.${extension}`;
  return {
    extension,
    filename,
    absolutePath: path.join(process.cwd(), "public", "afterglow", "storyboard", filename),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const block = boundedInteger(url.searchParams.get("block"), 1, 24);
  const mini = boundedInteger(url.searchParams.get("mini"), 1, 4);
  if (!block || !mini) {
    return Response.json(
      { ok: false, message: "A valid Storyboard block (1-24) and mini-block (1-4) are required." },
      { status: 400 },
    );
  }

  const asset = referenceAsset(block, mini);
  try {
    const bytes = await readFile(asset.absolutePath);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": asset.extension === "svg" ? "image/svg+xml; charset=utf-8" : "image/webp",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        ...(asset.extension === "svg" ? { "Content-Security-Policy": "sandbox" } : {}),
      },
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "UNKNOWN";
    if (code === "ENOENT") {
      return Response.json({ ok: false, message: "The bundled Storyboard reference asset is unavailable." }, { status: 404 });
    }
    return Response.json({ ok: false, message: "The bundled Storyboard reference asset could not be read." }, { status: 500 });
  }
}
