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
    return { position: item.position, intention: item.intention.trim().slice(0, 420) };
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
