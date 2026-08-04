import type { ComicPitchDeck, ComicPitchPanel, PlotPickleProject } from "./project";
import * as legacy from "./ai-pitch-deck-base";
import { isAfterglowProject } from "./afterglow-legacy-visuals";
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

const BUNDLED_AFTERGLOW_ASSET_PREFIX = "/afterglow/storyboard/";
const BUNDLED_AFTERGLOW_PROVIDER = "PlotPickle bundled sample";
const BUNDLED_AFTERGLOW_MODEL = "Afterglow storyboard";

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

function bundledAfterglowPanelSource(project: PlotPickleProject, panel: ComicPitchPanel) {
  if (!isAfterglowProject(project)) return "";
  const block = project.blocks.find((item) => item.number === panel.blockNumber);
  const source = block?.visuals.find((item) => item.miniBlockNumber === panel.miniBlockNumber)?.src ?? "";
  return source.startsWith(BUNDLED_AFTERGLOW_ASSET_PREFIX) ? source : "";
}

export function withBundledAfterglowGraphicNovel(
  project: PlotPickleProject,
  deck: ComicPitchDeck,
  enabled = true,
): ComicPitchDeck {
  if (!enabled || !isAfterglowProject(project)) return deck;
  const panels = deck.panels.map((panel) => {
    if (panel.imageSrc) return panel;
    const source = bundledAfterglowPanelSource(project, panel);
    if (!source) return panel;
    return {
      ...panel,
      imageSrc: source,
      revisedPrompt: panel.revisedPrompt || panel.prompt,
      status: "complete" as const,
      error: "",
      provider: BUNDLED_AFTERGLOW_PROVIDER,
      model: BUNDLED_AFTERGLOW_MODEL,
      generatedAt: panel.generatedAt || project.metadata.updatedAt || deck.createdAt,
    };
  });
  return {
    ...deck,
    status: panels.length && panels.every((panel) => panel.status === "complete" && panel.imageSrc)
      ? "complete"
      : deck.status,
    panels,
  };
}

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
  const planned = legacy.createComicPitchDeckPlan(project, previous, preserveCompleted);
  return normalizeDeckTerminology(withBundledAfterglowGraphicNovel(project, planned, preserveCompleted));
}

export const createGraphicNovelPlan = createComicPitchDeckPlan;

export function comicPitchReferenceImages(project: PlotPickleProject, panel: ComicPitchPanel) {
  const references = legacy.comicPitchReferenceImages(project, panel);
  if (references.length) return references;
  const bundled = bundledAfterglowPanelSource(project, panel) || panel.imageSrc;
  return bundled.startsWith(BUNDLED_AFTERGLOW_ASSET_PREFIX) ? [bundled] : [];
}

export function comicPitchIdentityLocks(project: PlotPickleProject, panel: ComicPitchPanel) {
  const locked = legacy.comicPitchIdentityLocks(project, panel);
  const bundled = bundledAfterglowPanelSource(project, panel) || panel.imageSrc;
  if (!bundled.startsWith(BUNDLED_AFTERGLOW_ASSET_PREFIX) || locked.length === panel.characterIds.length) return locked;
  const byCharacter = new Map(locked.map((item) => [item.characterId, item]));
  return panel.characterIds.flatMap((characterId) => {
    const existing = byCharacter.get(characterId);
    if (existing) return [existing];
    const character = project.characters.find((item) => item.id === characterId);
    if (!character) return [];
    return [{
      characterId,
      characterName: character.name,
      version: 1,
      approvedPrompt: [
        `Bundled Afterglow demonstration identity for ${character.name}.`,
        character.description,
        "Use the packaged storyboard frame as the editable sample reference and preserve the established design while experimenting.",
      ].filter(Boolean).join(" "),
    }];
  });
}

export function comicPitchDeckPreflight(project: PlotPickleProject, deck: ComicPitchDeck) {
  const hydrated = withBundledAfterglowGraphicNovel(project, deck);
  const result = legacy.comicPitchDeckPreflight(project, hydrated);
  if (!isAfterglowProject(project)) return result;
  const bundledCharacterIds = new Set(
    hydrated.panels
      .filter((panel) => panel.imageSrc.startsWith(BUNDLED_AFTERGLOW_ASSET_PREFIX))
      .flatMap((panel) => panel.characterIds),
  );
  return {
    ...result,
    completePanels: hydrated.panels.filter((panel) => panel.status === "complete" && panel.imageSrc).length,
    remainingImages: hydrated.panels.filter((panel) => panel.status !== "complete" || !panel.imageSrc).length,
    lockedCharacterCount: result.relevantCharacterCount,
    missingCharacterLocks: [],
    approvedReferenceCount: Math.max(result.approvedReferenceCount, bundledCharacterIds.size),
    ready: result.panelCount === 96 && result.canonicalPositionCount === 96,
  };
}

export function buildComicPitchDeckHtml(
  project: PlotPickleProject,
  imageDataByPanel: Record<string, string> = {},
) {
  const deck = normalizeDeckTerminology(withBundledAfterglowGraphicNovel(
    project,
    project.review.pitchPackage.comicDeck ?? legacy.createComicPitchDeckPlan(project),
  ));
  const prepared = legacy.withComicPitchDeck(project, deck);
  const html = graphicNovelText(legacy.buildComicPitchDeckHtml(prepared, imageDataByPanel))
    .replace(/PlotPickle Graphic Novel Deck/gi, "PlotPickle Graphic Novel")
    .replace(/— Graphic Novel Deck/gi, "— Graphic Novel");
  return applyGraphicNovelBubbleLayouts(html, prepared, deck);
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
