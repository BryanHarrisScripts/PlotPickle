export const runtime = "nodejs";

function boundedInteger(value: string | null, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const block = boundedInteger(url.searchParams.get("block"), 1, 24);
  const mini = boundedInteger(url.searchParams.get("mini"), 1, 4);
  if (!block || !mini) {
    return Response.json({ ok: false, message: "A valid Storyboard block (1-24) and mini-block (1-4) are required." }, { status: 400 });
  }

  const extension = block > 21 ? "svg" : "webp";
  const target = new URL(`/afterglow/storyboard/block-${String(block).padStart(2, "0")}-mini-${mini}.${extension}`, request.url);
  return Response.redirect(target, 307);
}
