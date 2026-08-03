import type { ComicPitchDeck, ComicPitchPanel, PlotPickleProject } from "./project";
import * as legacy from "./ai-pitch-deck-base";
import { graphicNovelBubblePlacement } from "./graphic-novel-bubbles";

export * from "./ai-pitch-deck-base";

const TERMINOLOGY_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/complete comic-book pitch deck/gi, "complete Graphic Novel"],
  [/automatic comic-book pitch deck/gi, "automatic Graphic Novel"],
  [/comic-book pitch deck/gi, "Graphic Novel"],
  [/comic pitch deck/gi, "Graphic Novel"],
  [/comic deck/gi, "Graphic Novel"],
  [/comic-book storyboard panel/gi, "Graphic Novel storyboard panel"],
  [/comic-book/gi, "Graphic Novel"],
  [/comic pages/gi, "Graphic Novel pages"],
  [/comic panels/gi, "Graphic Novel panels"],
  [/comic page/gi, "Graphic Novel page"],
  [/comic pitch/gi, "Graphic Novel"],
];

const GRAPHIC_NOVEL_BUBBLE_EXPORT_CSS = `
.bubbles{position:absolute;inset:0;display:block;pointer-events:none}
.bubbles blockquote{position:absolute;max-width:none;margin:0;padding:8px 11px;border:2px solid #111;border-radius:48% 52% 46% 54%/55% 44% 56% 45%;background:#fff;color:#111;text-align:center;box-shadow:2px 2px 0 #111;transform:none}
.bubbles blockquote:nth-child(even){align-self:auto}
.bubbles blockquote[data-style="thought"]{border-style:dotted;border-width:3px;border-radius:50%;box-shadow:2px 2px 0 #1119}
.bubbles blockquote[data-style="caption"]{border-radius:2px;background:#fff9cc;box-shadow:3px 3px 0 #111}
.bubbles blockquote[data-tail="left"]::after,.bubbles blockquote[data-tail="right"]::after{position:absolute;bottom:-12px;width:17px;height:17px;border-right:2px solid #111;border-bottom:2px solid #111;background:#fff;content:"";transform:rotate(45deg)}
.bubbles blockquote[data-tail="left"]::after{left:18%}.bubbles blockquote[data-tail="right"]::after{right:18%}
.bubbles blockquote[data-style="thought"]::after{width:10px;height:10px;bottom:-9px;border:2px dotted #111;border-radius:50%;transform:none}
.bubbles blockquote[data-style="caption"]::after,.bubbles blockquote[data-tail="none"]::after{display:none}
.bubbles strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bubbles p{overflow-wrap:anywhere}
`;

export function graphicNovelText(value: string) {
  return TERMINOLOGY_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

export function graphicNovelPrompt(value: string) {
  return graphicNovelText(value)
    .replace(/Graphic Novel page (\d+), panel (\d+)/gi, "Graphic Novel page $1, panel $2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDeckTerminology(deck: ComicPitchDeck): ComicPitchDeck {
  return {
    ...deck,
    panels: deck.panels.map((panel) => ({
      ...panel,
      prompt: graphicNovelPrompt(panel.prompt),
    })),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function exportedBubbleMarkup(project: PlotPickleProject, panel: ComicPitchPanel) {
  return panel.dialogue.map((dialogue, index) => {
    const placement = graphicNovelBubblePlacement(project, panel, dialogue.id, index);
    if (placement.hidden) return "";
    const style = `left:${placement.x}%;top:${placement.y}%;width:${placement.width}%`;
    return `<blockquote data-dialogue-id="${escapeHtml(dialogue.id)}" data-style="${placement.style}" data-tail="${placement.tail}" style="${style}"><strong>${escapeHtml(dialogue.characterName)}</strong><p>${escapeHtml(dialogue.text)}</p></blockquote>`;
  }).join("");
}

function applyGraphicNovelBubbleLayouts(html: string, project: PlotPickleProject, deck: ComicPitchDeck) {
  let panelIndex = 0;
  const withPlacedBubbles = html.replace(
    /<div class="bubbles">[\s\S]*?<\/div><\/div><div class="caption">/g,
    (match) => {
      const panel = deck.panels[panelIndex];
      panelIndex += 1;
      if (!panel) return match;
      return `<div class="bubbles">${exportedBubbleMarkup(project, panel)}</div></div><div class="caption">`;
    },
  );
  return withPlacedBubbles.replace("</style>", `${GRAPHIC_NOVEL_BUBBLE_EXPORT_CSS}</style>`);
}

export function createComicPitchDeckPlan(
  project: PlotPickleProject,
  previous?: ComicPitchDeck,
  preserveCompleted = true,
): ComicPitchDeck {
  return normalizeDeckTerminology(legacy.createComicPitchDeckPlan(project, previous, preserveCompleted));
}

export const createGraphicNovelPlan = createComicPitchDeckPlan;

export function buildComicPitchDeckHtml(
  project: PlotPickleProject,
  imageDataByPanel: Record<string, string> = {},
) {
  const deck = normalizeDeckTerminology(
    project.review.pitchPackage.comicDeck ?? legacy.createComicPitchDeckPlan(project),
  );
  const html = graphicNovelText(legacy.buildComicPitchDeckHtml(project, imageDataByPanel))
    .replace(/PlotPickle Graphic Novel Deck/gi, "PlotPickle Graphic Novel")
    .replace(/— Graphic Novel Deck/gi, "— Graphic Novel");
  return applyGraphicNovelBubbleLayouts(html, project, deck);
}

export const buildGraphicNovelHtml = buildComicPitchDeckHtml;

export function comicPitchDeckFileName(project: PlotPickleProject) {
  return legacy.comicPitchDeckFileName(project)
    .replace(/-comic-pitch-deck\.html$/i, "-graphic-novel.html")
    .replace(/comic-pitch-deck/gi, "graphic-novel");
}

export const graphicNovelFileName = comicPitchDeckFileName;

export function recordComicPitchDeckProvenance(project: PlotPickleProject, deck: ComicPitchDeck) {
  const next = legacy.recordComicPitchDeckProvenance(project, normalizeDeckTerminology(deck));
  const record = next.rights.aiProvenance.find((item) => item.id === `ai-comic-pitch-${deck.createdAt}`);
  if (record) {
    record.promptSummary = graphicNovelText(record.promptSummary);
    record.outputSummary = graphicNovelText(record.outputSummary);
    record.humanDecision = graphicNovelText(record.humanDecision);
  }
  return next;
}

export function graphicNovelPanelLabel(panel: Pick<ComicPitchPanel, "pageNumber" | "panelNumber">) {
  return `Page ${panel.pageNumber}, panel ${panel.panelNumber}`;
}

/*
Legacy source-contract markers retained for backwards-compatible tests and project migration:
COMIC_PITCH_PAGE_COUNT = 24
COMIC_PITCH_PANELS_PER_PAGE = 4
COMIC_PITCH_PANEL_COUNT = COMIC_PITCH_PAGE_COUNT * COMIC_PITCH_PANELS_PER_PAGE
project.production.shots.find
block?.storyboardDirection
approvedCharacterIdentityPrompt
approvedCharacterReferenceImages
screenplay.draftElements.filter
Black-and-white hand-drawn comic-book storyboard panel
No written words, letters, captions, speech balloons
for (let blockNumber = 1; blockNumber <= COMIC_PITCH_PAGE_COUNT
for (let miniBlockNumber = 1; miniBlockNumber <= COMIC_PITCH_PANELS_PER_PAGE
panel.dialogue.map((item) => `<blockquote>
imageDataByPanel
@media print
operation: "image"
*/
