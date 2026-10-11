/**
 * PP-NARR-SEQ candidate: sequence context is evidence, not new story canon.
 * The Human still approves printed text; no images are read by this text-only path.
 * Never allocate screenplay passages using shot position / passage count.
 */
const STRUCTURAL_TYPES = new Set([
  "transition", "scene-heading", "section", "page-break", "page-number",
  "shot", "title", "slugline", "header", "footer",
]);

export function screenplayFormattingDirective(text) {
  const value = String(text ?? "").replace(/\s+/gu, " ").trim();
  return /^(?:(?:FADE\s+(?:IN|OUT)|FADE\s+TO\s+BLACK|CUT\s+TO|SMASH\s+CUT\s+TO|DISSOLVE\s+TO|MATCH\s+CUT\s+TO|BACK\s+TO|CONTINUED|THE\s+END|END\s+OF\s+SCENE|INTERCUT|MONTAGE|SUPER|TITLE\s+CARD|OPEN\s+ON)\s*[:.!–-]*|(?:INT|EXT|INT\/EXT|EXT\/INT)\.\s+.+|(?:PAGE|SCENE|SHOT)\s+\d+\s*[:.!-]*)$/iu.test(value);
}

/**
 * Recovery provenance is not a creative description of the image.
 * Older approvals retain their original keys; filtering applies to the writer
 * evidence packet and explanatory UI, not the durable Storyboard artifact.
 */
export function storyboardNarrationAuthoredIntention(value) {
  const text = String(value ?? "").trim();
  if (/^Recovered local Storyboard frame\s*[·-]\s*position\s*\d{1,2}\s*$/iu.test(text)
      || /^Recovered local Storyboard resource\b/iu.test(text)
      || /^Original Storyboard (?:Image )?prompt unavailable\b/iu.test(text)
      || screenplayFormattingDirective(text)) return "";
  return text;
}

function narrativePassage(value) {
  if (!value || typeof value !== "object" || typeof value.type !== "string" || typeof value.text !== "string") return null;
  const type = value.type.trim().toLowerCase();
  if (STRUCTURAL_TYPES.has(type)) return null;
  // An importer may place screenplay formatting within an Action passage.
  // Keep the authored dramatic action after any isolated format-only lines.
  const clean = value.text.split(/\r?\n/u)
    .map(line => line.trim())
    .filter(line => line && !screenplayFormattingDirective(line))
    .join(" ").trim();
  if (!clean || screenplayFormattingDirective(clean)) return null;
  return { type: value.type, text: clean.slice(0, 8000) };
}

/**
 * Build a single bounded dramatic context, retaining the source's sequence
 * order and all 25 authored visual intentions. No arithmetic paragraph slicing.
 * Empty slots remain empty: the packet cannot invent missing events.
 */
export function prepareStoryboardNarrationSequence(value) {
  if (!value || !Number.isInteger(value.position) || value.position < 1 || value.position > 25
      || !Array.isArray(value.passages) || !Array.isArray(value.shots)) {
    throw new Error("The selected Shot needs valid sequence evidence.");
  }
  const seen = new Set();
  const sources = value.shots.map(item => {
    if (!item || !Number.isInteger(item.position) || item.position < 1 || item.position > 25
        || seen.has(item.position) || typeof item.intention !== "string"
        || item.intention.length > 1600) throw new Error("Invalid authored sequence Shot.");
    seen.add(item.position);
    const intention = storyboardNarrationAuthoredIntention(item.intention).slice(0, 420);
    return { position: item.position, intention: screenplayFormattingDirective(intention) ? "" : intention };
  });
  if (sources.length !== 25 || seen.size !== 25) throw new Error("A 25-Shot sequence plan is required.");
  const shots = sources.sort((a, b) => a.position - b.position);
  const passages = value.passages.map(narrativePassage).filter(Boolean);
  // A Shot with neither its own intent nor any script cannot be narrated truthfully.
  if (!shots[value.position - 1].intention && !passages.length) {
    throw new Error("This Shot has no authored dramatic context. Review its story intention before generating text.");
  }
  return {
    passages,
    sequence: {
      selectedPosition: value.position,
      shots,
    },
  };
}

/** Native storyteller procedure shared by the agent role and narration tasks. */
export const NARRATION_STORYTELLER_PROCEDURE = `Work as a storyteller adapting an existing story into sequential art. First interpret the whole story's central conflict, character desire and need, stakes, theme, causal arc and earned ending from supplied evidence. Then locate the selected Mini-Block: what pressure brings the characters here, what they want now, what choice or discovery changes their emotional state, and what consequence carries forward. Follow cause -> choice -> consequence; do not impose invented beats on missing material. Shape the 25 moments as a connected narrative with purposeful rhythm, tension, release and silence. Preserve viewpoint and audience knowledge: a future payoff may guide a setup but must not be revealed early. Use subtext, specific language and emotional progression; captions should add meaning the image cannot carry alone, never recite camera directions or redundantly label each image. Before returning a proposal, check continuity, motivation, setup/payoff order, repetition, clarity and whether fewer words or silence serves the moment better. Interpretive language remains a reviewable proposal, never new canon. Obey the task's output schema, exact screenplay dialogue and printed-text limits; keep this craft assessment internal when JSON alone is requested.`;

/** Saved story evidence only; proposals and operational project data stay out. */
export function narrationOverallStory(project) {
  const clean = (value, limit) => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, limit) : '';
  const decisions = Object.entries(project?.storyDevelopment?.fields ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, field]) => field?.acceptedSource && clean(field.value, 1))
    .map(([field, value]) => `${clean(field, 100)}: ${clean(value.value, 500)}`)
    .join('\n').slice(0, 2400);
  const foundations = clean(project?.foundations?.brief?.content, 1600);
  const blocks = [...(project?.sourceEvidence?.storyMatrix?.blocks ?? [])]
    .filter(block => Number.isInteger(block.blockNumber) && block.blockNumber >= 1 && block.blockNumber <= 24)
    .sort((a, b) => a.blockNumber - b.blockNumber)
    .slice(0, 24)
    .map(block => ({ block: block.blockNumber, title: clean(block.title, 80), responsibility: clean(block.responsibility, 120) }));
  return { decisions, foundations, blocks };
}

export function validateNarrationOverallStory(value) {
  if (value === undefined) return undefined; // legacy request compatibility
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.decisions !== 'string' || value.decisions.length > 2400
      || typeof value.foundations !== 'string' || value.foundations.length > 1600
      || !Array.isArray(value.blocks) || value.blocks.length > 24) throw new Error('Invalid overall story context.');
  let previous = 0;
  const blocks = value.blocks.map(block => {
    if (!block || !Number.isInteger(block.block) || block.block <= previous || block.block > 24
        || typeof block.title !== 'string' || block.title.length > 80
        || typeof block.responsibility !== 'string' || block.responsibility.length > 120) throw new Error('Invalid overall story block map.');
    previous = block.block;
    return { block: block.block, title: block.title, responsibility: block.responsibility };
  });
  return { decisions: value.decisions, foundations: value.foundations, blocks };
}
