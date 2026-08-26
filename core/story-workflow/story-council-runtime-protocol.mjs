export const STORY_COUNCIL_RUNTIME_MARKER = "PLOTPICKLE_STORY_COUNCIL_V1";

export const STORY_COUNCIL_RUNTIME_KINDS = Object.freeze([
  "finding",
  "proposal",
  "alternatives",
  "no-finding",
  "blocked",
  "needs-human",
]);

export const STORY_COUNCIL_RUNTIME_SEVERITIES = Object.freeze(["low", "medium", "high"]);

const OUTPUT_KEYS = new Set(["kind", "severity", "confidence", "changesCanon", "explanation", "proposal", "alternatives"]);
const RUNTIME_KINDS = new Set(STORY_COUNCIL_RUNTIME_KINDS);
const RUNTIME_SEVERITIES = new Set(STORY_COUNCIL_RUNTIME_SEVERITIES);

function boundedText(value, maximum) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function boundedStrings(value, maximum, itemMaximum) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => boundedText(item, itemMaximum)).filter(Boolean))].slice(0, maximum);
}

export function isStoryCouncilRuntimeMessage(value) {
  const text = String(value ?? "");
  return text === STORY_COUNCIL_RUNTIME_MARKER || text.startsWith(`${STORY_COUNCIL_RUNTIME_MARKER}\n`);
}

export function storyCouncilRuntimeMessage(content) {
  const text = String(content ?? "").replace(/\u0000|\r/g, "").trim();
  if (!text) throw new Error("Story Council runtime content is required.");
  return `${STORY_COUNCIL_RUNTIME_MARKER}\n${text}`;
}

export function parseStoryCouncilRuntimeText(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) throw new Error("Story Council specialist did not return the required structured JSON object.");
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Story Council specialist returned an invalid structured object.");
  const unexpected = Object.keys(parsed).filter((key) => !OUTPUT_KEYS.has(key));
  if (unexpected.length) throw new Error(`Story Council specialist returned host-owned or unsupported fields: ${unexpected.join(", ")}.`);
  const kind = boundedText(parsed.kind, 40);
  const severity = boundedText(parsed.severity, 20);
  const confidence = Number(parsed.confidence);
  const explanation = boundedText(parsed.explanation, 2_400);
  const proposal = boundedText(parsed.proposal, 2_400);
  if (!RUNTIME_KINDS.has(kind)) throw new Error("Story Council specialist returned an invalid finding class.");
  if (!RUNTIME_SEVERITIES.has(severity)) throw new Error("Story Council specialist returned an invalid severity.");
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("Story Council specialist confidence must be between 0 and 1.");
  if (typeof parsed.changesCanon !== "boolean") throw new Error("Story Council specialist must state whether the recommendation would change canon.");
  if (!explanation) throw new Error("Story Council specialist explanation is required.");
  if (kind === "proposal" && !proposal) throw new Error("Story Council proposal output requires a proposal.");
  return {
    kind,
    severity,
    confidence,
    changesCanon: parsed.changesCanon,
    explanation,
    proposal,
    alternatives: boundedStrings(parsed.alternatives, 4, 1_000),
  };
}
