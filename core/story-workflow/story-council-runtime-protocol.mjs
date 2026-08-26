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

export function isStoryCouncilRuntimeMessage(value) {
  const text = String(value ?? "");
  return text === STORY_COUNCIL_RUNTIME_MARKER || text.startsWith(`${STORY_COUNCIL_RUNTIME_MARKER}\n`);
}

export function storyCouncilRuntimeMessage(content) {
  const text = String(content ?? "").replace(/\u0000|\r/g, "").trim();
  if (!text) throw new Error("Story Council runtime content is required.");
  return `${STORY_COUNCIL_RUNTIME_MARKER}\n${text}`;
}
