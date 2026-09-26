export const PREVIS_FLIP_BOOK_INTERVAL_MS = 900;
export const PREVIS_GRAPHIC_NOVEL_INTERVAL_MS = 3000;

export type PrevisGraphicNovelPanelInput = Readonly<{
  position: number;
  assetUrl: string;
  authoritative: boolean;
  narrativeIntention: string;
  sceneNumbers: readonly string[];
  beatLabel: string;
  beatDirection: string;
  shotLabel: string;
  shotContext: string;
}>;

export type PrevisGraphicNovelPanel = Readonly<{
  position: number;
  assetUrl: string;
  authoritative: boolean;
  sceneLabel: string;
  beatLabel: string;
  caption: string;
  narration: string;
  shotLabel: string;
  shotContext: string;
}>;

export type PrevisGraphicNovelExportPanel = PrevisGraphicNovelPanel & Readonly<{
}>;

function clean(value: string, maximum = 420) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return normalized.slice(0, Math.max(0, maximum - 1)).trimEnd() + "…";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPrevisGraphicNovelPanel(input: PrevisGraphicNovelPanelInput): PrevisGraphicNovelPanel {
  const sceneLabel = input.sceneNumbers.length
    ? input.sceneNumbers.map((number) => `Scene ${number}`).join(" · ")
    : "Scene not mapped";
  const beatLabel = clean(input.beatLabel, 100) || `Position ${String(input.position).padStart(2, "0")}`;
  const narrativeIntention = clean(input.narrativeIntention);
  const beatDirection = clean(input.beatDirection);
  const shotContext = clean(input.shotContext);

  const narration = input.authoritative
    ? narrativeIntention || beatDirection || shotContext || "Story detail is still emerging from the approved visual sequence."
    : "This position is not Keep / Locked and is excluded from the authoritative Graphic Novel.";

  return {
    position: input.position,
    assetUrl: input.authoritative ? input.assetUrl : "",
    authoritative: input.authoritative,
    sceneLabel,
    beatLabel,
    caption: `${sceneLabel} · ${beatLabel}`,
    narration,
    shotLabel: clean(input.shotLabel, 140) || "Shot intent open",
    shotContext,
  };
}

export function graphicNovelExportFileName(projectTitle: string, blockNumber: number, miniBlockNumber: number) {
  const slug = projectTitle.toLowerCase().trim().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "plotpickle";
  return `${slug}-previs-graphic-novel-${String(blockNumber).padStart(2, "0")}-${miniBlockNumber}.html`;
}

export function buildPrevisGraphicNovelExportHtml(input: Readonly<{
  projectTitle: string;
  blockNumber: number;
  miniBlockNumber: number;
  panels: readonly PrevisGraphicNovelExportPanel[];
}>) {
  const authoritative = input.panels.filter((panel) => panel.authoritative);
  const skipped = input.panels.filter((panel) => !panel.authoritative);
  const panels = input.panels.map((panel) => {
    const image = panel.authoritative && panel.assetUrl
      ? `<img src="${escapeHtml(panel.assetUrl)}" alt="Graphic Novel frame ${panel.position}">`
      : '<div class="missing">NOT KEEP / LOCKED — OMITTED FROM AUTHORITATIVE VISUAL STORY</div>';
    return [
      `<article class="panel ${panel.authoritative ? "locked" : "omitted"}">`,
      image,
      '<div class="caption">',
      `<small>FRAME ${String(panel.position).padStart(2, "0")} · ${panel.authoritative ? "LOCKED" : "OMITTED"}</small>`,
      `<h2>${escapeHtml(panel.caption)}</h2>`,
      `<p>${escapeHtml(panel.narration)}</p>`,
      `<footer>${escapeHtml(panel.shotLabel)}${panel.shotContext ? ` · ${escapeHtml(panel.shotContext)}` : ""}</footer>`,
      "</div>",
      "</article>",
    ].join("");
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.projectTitle)} — Previs Graphic Novel</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#090b0a;color:#eef5ef;font:16px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}main{width:min(1100px,94vw);margin:0 auto;padding:36px 0 72px}header.hero{border:1px solid #70d6a1;padding:22px;margin-bottom:26px;background:#0d1d15}h1{margin:0 0 8px;font-size:26px}.hero p{margin:0;color:#a9b7ad}.panel{break-inside:avoid;margin:0 0 28px;border:1px solid #385746;background:#0d100e}.panel.locked{border-color:#70d6a1}.panel img{display:block;width:100%;max-height:70vh;object-fit:contain;background:#000}.caption{padding:18px 20px 22px;border-top:1px solid #385746}.caption small{color:#70d6a1}.caption h2{margin:8px 0;font-size:18px}.caption p{margin:0 0 10px;font-size:17px}.caption footer{color:#a9b7ad;font-size:13px}.missing{display:grid;min-height:220px;place-items:center;padding:30px;color:#8a948d;text-align:center}.omitted{opacity:.72}@media print{body{background:#fff;color:#111}.hero,.panel{background:#fff;border-color:#333}.panel{page-break-inside:avoid}.caption small,.caption footer,.hero p{color:#444}}
</style>
</head>
<body>
<main>
<header class="hero">
<h1>${escapeHtml(input.projectTitle || "Untitled Story")} · Previs Graphic Novel</h1>
<p>Block ${String(input.blockNumber).padStart(2, "0")} · Mini-Block ${input.miniBlockNumber} · ${authoritative.length} locked panel${authoritative.length === 1 ? "" : "s"} · ${skipped.length} omitted position${skipped.length === 1 ? "" : "s"}. Derived presentation only; story canon and Storyboard approval are unchanged. Images remain linked to this PlotPickle installation.</p>
</header>
${panels}
</main>
</body>
</html>`;
}
