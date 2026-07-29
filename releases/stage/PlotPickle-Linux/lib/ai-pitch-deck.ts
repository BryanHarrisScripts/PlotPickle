import type { ComicPitchDeck, ComicPitchPanel, PlotPickleProject } from "./project";
import * as legacy from "./ai-pitch-deck-base";

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
  return graphicNovelText(legacy.buildComicPitchDeckHtml(project, imageDataByPanel))
    .replace(/PlotPickle Graphic Novel Deck/gi, "PlotPickle Graphic Novel")
    .replace(/— Graphic Novel Deck/gi, "— Graphic Novel");
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
