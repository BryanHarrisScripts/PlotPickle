import {
  approvedCharacterIdentityPrompt,
  approvedCharacterReferenceImages,
  getCharacterVisualIdentity,
  type CharacterWithVisualIdentity,
} from "./character-visual-identity";
import {
  cloneProject,
  type ComicPitchDeck,
  type ComicPitchDialogue,
  type ComicPitchPanel,
  type ComicPitchPanelStatus,
  type PlotPickleProject,
  type ScreenplayDraftElement,
  type StoryBlock,
} from "./project";
import type { MiniBlock, StoryScene } from "./structure";

export const COMIC_PITCH_PAGE_COUNT = 24;
export const COMIC_PITCH_PANELS_PER_PAGE = 4;
export const COMIC_PITCH_PANEL_COUNT = COMIC_PITCH_PAGE_COUNT * COMIC_PITCH_PANELS_PER_PAGE;
export const COMIC_PITCH_STYLE = "black-and-white-sketch" as const;

const STYLE_PROMPT = [
  "Black-and-white hand-drawn comic-book storyboard panel.",
  "Expressive graphite pencil and crisp ink linework, cinematic contrast, production-ready composition.",
  "One borderless landscape panel only.",
  "No colour.",
  "No written words, letters, captions, speech balloons, signs, logos, borders or watermark; PlotPickle adds editable dialogue and captions separately.",
].join(" ");

const DEFAULT_SHOTS = [
  "Establishing wide shot, eye level, locked camera, clear geography",
  "Character-led medium shot, eye level, restrained cinematic composition",
  "Tight close-up, purposeful angle, visual emphasis on pressure and choice",
  "Consequential reaction or reveal shot, composed as a strong page-turn image",
] as const;

function clip(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
}

function unique(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizedName(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function blockFor(project: PlotPickleProject, blockNumber: number) {
  return project.blocks.find((block) => block.number === blockNumber);
}

function miniContext(block: StoryBlock | undefined, miniBlockNumber: number): { scene?: StoryScene; mini?: MiniBlock } {
  for (const scene of block?.scenes ?? []) {
    const mini = scene.miniBlocks.find((item) => item.number === miniBlockNumber);
    if (mini) return { scene, mini };
  }
  return {};
}

function dialogueFor(
  project: PlotPickleProject,
  blockNumber: number,
  miniBlockNumber: number,
): ComicPitchDialogue[] {
  const charactersByCue = new Map(
    project.characters
      .filter((character) => character.name.trim())
      .map((character) => [normalizedName(character.name), character]),
  );
  const elements = project.screenplay.draftElements.filter(
    (element) => element.blockNumber === blockNumber && element.miniBlockNumber === miniBlockNumber && !element.omitted,
  );
  let speaker: { id: string; name: string } | null = null;
  const dialogue: ComicPitchDialogue[] = [];
  elements.forEach((element) => {
    if (element.type === "character") {
      const character = charactersByCue.get(normalizedName(element.text));
      speaker = character ? { id: character.id, name: character.name } : { id: "", name: clip(element.text, 80) || "Speaker" };
      return;
    }
    if ((element.type === "dialogue" || element.type === "dual-dialogue") && speaker && element.text.trim()) {
      dialogue.push({
        id: `comic-dialogue-${blockNumber}-${miniBlockNumber}-${dialogue.length + 1}`,
        characterId: speaker.id,
        characterName: speaker.name,
        text: clip(element.text, 220),
        sourceElementId: element.id,
      });
      return;
    }
    if (element.type !== "parenthetical") speaker = null;
  });
  return dialogue.slice(0, 3);
}

function narrationFor(block: StoryBlock | undefined, scene: StoryScene | undefined, mini: MiniBlock | undefined) {
  const canonical = [
    mini?.visualBeat,
    mini?.action,
    mini?.turn,
    mini?.revelation,
    mini?.purpose,
    scene?.action,
    scene?.turn,
    scene?.outcome,
    block?.summary,
    block?.action,
    block?.purpose,
  ].map((value) => clip(value, 280)).find(Boolean);
  if (canonical) return { text: canonical, source: "canonical" as const };
  return {
    text: `Block ${block?.number ?? 1}, beat ${mini?.number ?? 1}: a visual story turn is ready to be defined.`,
    source: "derived" as const,
  };
}

function shotDirectionFor(project: PlotPickleProject, block: StoryBlock | undefined, miniBlockNumber: number) {
  const shot = project.production.shots.find(
    (item) => item.blockNumber === block?.number && item.miniBlockNumber === miniBlockNumber && item.status !== "omitted",
  );
  if (shot) {
    return [
      shot.shotSize,
      shot.angle,
      shot.movement,
      shot.lens,
      shot.composition,
      shot.purpose,
      shot.continuity,
    ].map((value) => clip(value, 220)).filter(Boolean).join(". ");
  }
  const frame = block?.visuals.find((item) => item.miniBlockNumber === miniBlockNumber);
  return clip(frame?.shot, 500)
    || clip(block?.storyboardDirection, 500)
    || DEFAULT_SHOTS[miniBlockNumber - 1];
}

function characterIdsFor(
  block: StoryBlock | undefined,
  scene: StoryScene | undefined,
  mini: MiniBlock | undefined,
  dialogue: ComicPitchDialogue[],
) {
  return unique([
    ...dialogue.map((item) => item.characterId),
    mini?.characterId,
    ...(scene?.characterIds ?? []),
    ...(block?.characterIds ?? []),
  ]).slice(0, 4);
}

function locationIdsFor(block: StoryBlock | undefined, scene: StoryScene | undefined) {
  return unique([...(scene?.locationIds ?? []), ...(block?.locationIds ?? [])]);
}

function identityPromptFor(project: PlotPickleProject, characterIds: string[]) {
  return characterIds.slice(0, 4).flatMap((characterId) => {
    const character = project.characters.find((item) => item.id === characterId) as CharacterWithVisualIdentity | undefined;
    if (!character) return [];
    const identity = getCharacterVisualIdentity(character);
    const prompt = identity.status === "locked"
      ? approvedCharacterIdentityPrompt(character)
      : character.description;
    return prompt ? [
      `${character.name}: ${clip(prompt, 1_500)}`,
      identity.status === "locked" && identity.negativePrompt ? `Do not drift ${character.name}: ${clip(identity.negativePrompt, 700)}` : "",
    ].filter(Boolean).join(" ") : [];
  }).join(" ");
}

function promptFor(
  project: PlotPickleProject,
  panel: Pick<ComicPitchPanel, "pageNumber" | "panelNumber" | "narration" | "characterIds" | "locationIds" | "shotDirection">,
) {
  const characterNames = panel.characterIds.map((id) => project.characters.find((item) => item.id === id)?.name).filter(Boolean).join(", ");
  const locations = panel.locationIds.map((id) => project.world.locations.find((item) => item.id === id)).filter(Boolean);
  const locationText = locations.map((location) => `${location?.name}: ${clip(location?.description, 500)}`).join(". ");
  return [
    STYLE_PROMPT,
    `Comic page ${panel.pageNumber}, panel ${panel.panelNumber}.`,
    project.metadata.tone && `Story tone: ${clip(project.metadata.tone, 240)}.`,
    project.world.period && `Period: ${clip(project.world.period, 180)}.`,
    project.world.visualLanguage && `Project visual language: ${clip(project.world.visualLanguage, 900)}.`,
    panel.shotDirection && `Directed shot: ${clip(panel.shotDirection, 900)}.`,
    panel.narration && `Visible story action: ${clip(panel.narration, 1_000)}.`,
    locationText && `Location continuity: ${locationText}.`,
    characterNames && `Characters visible: ${characterNames}.`,
    identityPromptFor(project, panel.characterIds),
  ].filter(Boolean).join(" ");
}

function createPanel(
  project: PlotPickleProject,
  blockNumber: number,
  miniBlockNumber: number,
  existing?: ComicPitchPanel,
): ComicPitchPanel {
  const block = blockFor(project, blockNumber);
  const { scene, mini } = miniContext(block, miniBlockNumber);
  const dialogue = dialogueFor(project, blockNumber, miniBlockNumber);
  const narration = narrationFor(block, scene, mini);
  const characterIds = characterIdsFor(block, scene, mini, dialogue);
  const locationIds = locationIdsFor(block, scene);
  const panelBase = {
    id: `comic-pitch-${String(blockNumber).padStart(2, "0")}-${miniBlockNumber}`,
    pageNumber: blockNumber,
    panelNumber: miniBlockNumber,
    blockNumber,
    miniBlockNumber,
    title: `${block?.title || `Block ${blockNumber}`} · ${mini?.label || `Beat ${miniBlockNumber}`}`,
    narration: narration.text,
    narrationSource: narration.source,
    dialogue,
    characterIds,
    locationIds,
    shotDirection: shotDirectionFor(project, block, miniBlockNumber),
  };
  const keepGenerated = Boolean(existing?.imageSrc && existing.status === "complete");
  return {
    ...panelBase,
    prompt: promptFor(project, panelBase),
    imageSrc: keepGenerated ? existing?.imageSrc ?? "" : "",
    revisedPrompt: keepGenerated ? existing?.revisedPrompt ?? "" : "",
    status: keepGenerated ? "complete" : "pending",
    error: "",
    provider: keepGenerated ? existing?.provider ?? "" : "",
    model: keepGenerated ? existing?.model ?? "" : "",
    generatedAt: keepGenerated ? existing?.generatedAt ?? "" : "",
  };
}

export function createComicPitchDeckPlan(
  project: PlotPickleProject,
  previous?: ComicPitchDeck,
  preserveCompleted = true,
): ComicPitchDeck {
  const now = new Date().toISOString();
  const existing = new Map((preserveCompleted ? previous?.panels : [])?.map((panel) => [panel.id, panel]) ?? []);
  const panels: ComicPitchPanel[] = [];
  for (let blockNumber = 1; blockNumber <= COMIC_PITCH_PAGE_COUNT; blockNumber += 1) {
    for (let miniBlockNumber = 1; miniBlockNumber <= COMIC_PITCH_PANELS_PER_PAGE; miniBlockNumber += 1) {
      const id = `comic-pitch-${String(blockNumber).padStart(2, "0")}-${miniBlockNumber}`;
      panels.push(createPanel(project, blockNumber, miniBlockNumber, existing.get(id)));
    }
  }
  return {
    version: 1,
    style: COMIC_PITCH_STYLE,
    status: panels.every((panel) => panel.status === "complete") ? "complete" : "planned",
    panels,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    lastGeneratedAt: previous?.lastGeneratedAt || "",
  };
}

export function comicPitchReferenceImages(project: PlotPickleProject, panel: ComicPitchPanel) {
  return panel.characterIds.slice(0, 4).flatMap((characterId) => {
    const character = project.characters.find((item) => item.id === characterId) as CharacterWithVisualIdentity | undefined;
    if (!character) return [];
    return approvedCharacterReferenceImages(character).slice(0, 1);
  }).filter((value, index, all) => all.indexOf(value) === index).slice(0, 4);
}

export function comicPitchIdentityLocks(project: PlotPickleProject, panel: ComicPitchPanel) {
  return panel.characterIds.flatMap((characterId) => {
    const character = project.characters.find((item) => item.id === characterId) as CharacterWithVisualIdentity | undefined;
    if (!character) return [];
    const identity = getCharacterVisualIdentity(character);
    return identity.status === "locked" ? [{
      characterId,
      characterName: character.name,
      version: identity.version,
      approvedPrompt: identity.approvedPrompt,
    }] : [];
  });
}

export function comicPitchDeckPreflight(project: PlotPickleProject, deck: ComicPitchDeck) {
  const canonicalPositions = new Set(deck.panels.map((panel) => `${panel.pageNumber}:${panel.panelNumber}`));
  const characterIds = unique(deck.panels.flatMap((panel) => panel.characterIds));
  const relevantCharacters = characterIds.flatMap((characterId) => {
    const character = project.characters.find((item) => item.id === characterId) as CharacterWithVisualIdentity | undefined;
    return character ? [character] : [];
  });
  const missingCharacterLocks = relevantCharacters.filter((character) => getCharacterVisualIdentity(character).status !== "locked").map((character) => character.name);
  const approvedReferences = relevantCharacters.flatMap((character) => approvedCharacterReferenceImages(character));
  const completePanels = deck.panels.filter((panel) => panel.status === "complete" && panel.imageSrc).length;
  const failedPanels = deck.panels.filter((panel) => panel.status === "error").length;
  return {
    pageCount: COMIC_PITCH_PAGE_COUNT,
    panelCount: deck.panels.length,
    canonicalPositionCount: canonicalPositions.size,
    completePanels,
    failedPanels,
    remainingImages: deck.panels.length - completePanels,
    canonicalDialoguePanels: deck.panels.filter((panel) => panel.dialogue.length).length,
    derivedNarrationPanels: deck.panels.filter((panel) => panel.narrationSource === "derived").length,
    relevantCharacterCount: relevantCharacters.length,
    lockedCharacterCount: relevantCharacters.length - missingCharacterLocks.length,
    missingCharacterLocks,
    approvedReferenceCount: unique(approvedReferences).length,
    ready: deck.panels.length === COMIC_PITCH_PANEL_COUNT
      && canonicalPositions.size === COMIC_PITCH_PANEL_COUNT
      && missingCharacterLocks.length === 0,
  };
}

export function updateComicPitchPanel(
  deck: ComicPitchDeck,
  panelId: string,
  patch: Partial<ComicPitchPanel>,
  deckStatus: ComicPitchDeck["status"] = deck.status,
): ComicPitchDeck {
  const now = new Date().toISOString();
  return {
    ...deck,
    status: deckStatus,
    panels: deck.panels.map((panel) => panel.id === panelId ? { ...panel, ...patch } : panel),
    updatedAt: now,
  };
}

export function resetFailedComicPitchPanels(deck: ComicPitchDeck): ComicPitchDeck {
  return {
    ...deck,
    status: "planned",
    panels: deck.panels.map((panel) => panel.status === "error" ? { ...panel, status: "pending", error: "" } : panel),
    updatedAt: new Date().toISOString(),
  };
}

export function finalizeComicPitchDeck(deck: ComicPitchDeck, paused = false): ComicPitchDeck {
  const complete = deck.panels.filter((panel) => panel.status === "complete" && panel.imageSrc).length;
  const errors = deck.panels.filter((panel) => panel.status === "error").length;
  const status: ComicPitchDeck["status"] = paused
    ? "paused"
    : complete === deck.panels.length
      ? "complete"
      : errors
        ? "complete-with-errors"
        : "planned";
  const now = new Date().toISOString();
  return {
    ...deck,
    status,
    panels: deck.panels.map((panel) => panel.status === "generating" ? { ...panel, status: "pending" } : panel),
    updatedAt: now,
    lastGeneratedAt: complete || errors ? now : deck.lastGeneratedAt,
  };
}

export function withComicPitchDeck(project: PlotPickleProject, deck: ComicPitchDeck): PlotPickleProject {
  const next = cloneProject(project);
  next.review.pitchPackage.comicDeck = deck;
  next.review.pitchPackage.updatedAt = deck.updatedAt;
  return next;
}

export function recordComicPitchDeckProvenance(project: PlotPickleProject, deck: ComicPitchDeck): PlotPickleProject {
  const next = withComicPitchDeck(project, deck);
  const completed = deck.panels.filter((panel) => panel.status === "complete").length;
  const failed = deck.panels.filter((panel) => panel.status === "error").length;
  const providers = unique(deck.panels.map((panel) => panel.provider));
  const models = unique(deck.panels.map((panel) => panel.model));
  const id = `ai-comic-pitch-${deck.createdAt}`;
  const record = {
    id,
    provider: providers.join(", "),
    model: models.join(", "),
    operation: "image" as const,
    promptSummary: "Black-and-white comic pitch panels assembled from canonical story context, directed shots and locked character identities.",
    outputSummary: `${completed} of ${deck.panels.length} comic panels completed; ${failed} failed.`,
    humanContribution: "The writer explicitly initiated generation and retains editable narration, dialogue, prompts and approval control.",
    humanDecision: deck.status === "complete" ? "Retained as the current complete comic pitch deck." : "Retained as a resumable draft comic pitch deck.",
    retained: true,
    attachedTo: deck.panels.map((panel) => panel.id),
    createdAt: deck.lastGeneratedAt || deck.updatedAt,
  };
  const index = next.rights.aiProvenance.findIndex((item) => item.id === id);
  if (index >= 0) next.rights.aiProvenance[index] = record;
  else next.rights.aiProvenance.push(record);
  return next;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildComicPitchDeckHtml(
  project: PlotPickleProject,
  imageDataByPanel: Record<string, string> = {},
) {
  const deck = project.review.pitchPackage.comicDeck ?? createComicPitchDeckPlan(project);
  const pages = Array.from({ length: COMIC_PITCH_PAGE_COUNT }, (_, index) => {
    const pageNumber = index + 1;
    const panels = deck.panels.filter((panel) => panel.pageNumber === pageNumber).sort((left, right) => left.panelNumber - right.panelNumber);
    return `<section class="comic-page"><header><span>Page ${pageNumber} of ${COMIC_PITCH_PAGE_COUNT}</span><h2>${escapeHtml(blockFor(project, pageNumber)?.title || `Block ${pageNumber}`)}</h2></header><div class="panel-grid">${panels.map((panel) => {
      const image = imageDataByPanel[panel.id] || panel.imageSrc;
      const bubbles = panel.dialogue.map((item) => `<blockquote><strong>${escapeHtml(item.characterName)}</strong><p>${escapeHtml(item.text)}</p></blockquote>`).join("");
      return `<article class="comic-panel"><div class="panel-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(`${panel.title}: ${panel.narration}`)}">` : `<div class="placeholder">Panel ${panel.panelNumber}<br>Image not generated</div>`}<div class="bubbles">${bubbles}</div></div><div class="caption"><span>${escapeHtml(panel.title)}</span><p>${escapeHtml(panel.narration)}</p>${panel.narrationSource === "derived" ? "<small>Derived fallback narration</small>" : ""}</div></article>`;
    }).join("")}</div></section>`;
  }).join("");
  const title = project.review.pitchPackage.title || project.metadata.title;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — Comic Pitch Deck</title><style>
*{box-sizing:border-box}body{margin:0;background:#d8d8d4;color:#111;font-family:Arial,sans-serif}.cover,.comic-page{width:min(11in,100%);min-height:8.5in;margin:24px auto;padding:.45in;background:#fff;box-shadow:0 8px 30px #0002}.cover{display:grid;place-content:center;text-align:center}.cover h1{margin:0;font-family:Georgia,serif;font-size:52px}.cover p{max-width:760px;font-size:20px;line-height:1.5}.comic-page>header{display:flex;align-items:end;justify-content:space-between;border-bottom:3px solid #111;margin-bottom:14px}.comic-page h2{margin:0 0 7px;font-family:Georgia,serif}.comic-page header span{order:2;margin-bottom:8px;font-size:12px;font-weight:700}.panel-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.comic-panel{overflow:hidden;border:3px solid #111;background:#fff}.panel-image{position:relative;aspect-ratio:3/2;overflow:hidden;background:#eee}.panel-image img{width:100%;height:100%;object-fit:cover;filter:grayscale(1)}.placeholder{display:grid;place-content:center;height:100%;color:#555;text-align:center}.bubbles{position:absolute;inset:10px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;pointer-events:none}.bubbles blockquote{max-width:48%;margin:0;padding:8px 11px;border:2px solid #111;border-radius:50%;background:#fff;color:#111;text-align:center;box-shadow:2px 2px 0 #111}.bubbles blockquote:nth-child(even){align-self:flex-end}.bubbles strong{font-size:10px;text-transform:uppercase}.bubbles p{margin:3px 0;font-size:12px;line-height:1.25}.caption{min-height:88px;padding:10px;border-top:3px solid #111}.caption span{font-size:11px;font-weight:800;text-transform:uppercase}.caption p{margin:5px 0;font-family:Georgia,serif;font-size:14px;line-height:1.35}.caption small{color:#666}.rights{font-size:13px}.rights p{margin:4px 0}@page{size:landscape;margin:0}@media print{body{background:#fff}.cover,.comic-page{width:11in;height:8.5in;min-height:0;margin:0;box-shadow:none;break-after:page;page-break-after:always}.comic-page:last-child{break-after:auto;page-break-after:auto}}@media(max-width:760px){.cover,.comic-page{min-height:0;margin:0;padding:18px}.panel-grid{grid-template-columns:1fr}.bubbles blockquote{max-width:62%}}
</style></head><body><section class="cover"><p>PlotPickle Comic Pitch Deck</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(project.review.pitchPackage.logline || project.story.logline)}</p><div class="rights"><p>${escapeHtml(project.rights.copyrightNotice)}</p><p>Generated through an explicit, writer-controlled AI workflow. Dialogue remains editable text outside generated image pixels.</p></div></section>${pages}</body></html>`;
}

export function comicPitchDeckFileName(project: PlotPickleProject) {
  const stem = (project.review.pitchPackage.title || project.metadata.title || "plotpickle")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "plotpickle";
  return `${stem}-comic-pitch-deck.html`;
}

export function screenplayElementsForComicPanel(
  project: PlotPickleProject,
  panel: Pick<ComicPitchPanel, "blockNumber" | "miniBlockNumber">,
): ScreenplayDraftElement[] {
  return project.screenplay.draftElements.filter(
    (element) => element.blockNumber === panel.blockNumber && element.miniBlockNumber === panel.miniBlockNumber && !element.omitted,
  );
}

export function isRecoverableComicPanelStatus(status: ComicPitchPanelStatus) {
  return status === "pending" || status === "error";
}
