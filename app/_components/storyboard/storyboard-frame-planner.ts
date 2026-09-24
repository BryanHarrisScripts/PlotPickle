export type StoryboardGenerationScope = "single" | "group5" | "all25";

export type StoryboardPlanningPassage = Readonly<{
  id: string;
  type: string;
  text: string;
}>;

export type StoryboardCharacterGrounding = Readonly<{
  id: string;
  name: string;
  aliases?: readonly string[];
  pronouns: string;
  role: string;
  description: string;
  truthClaims: readonly string[];
  approvedVisualRefs: readonly string[];
  identityLock: Readonly<{
    characterId: string;
    status: string;
    version: number;
    approvedPrompt: string;
  }> | null;
}>;

export type StoryboardFrameBrief = Readonly<{
  position: number;
  storyFunction: string;
  visibleChange: string;
  evidence: readonly StoryboardPlanningPassage[];
  evidenceSummary: string;
  characters: readonly StoryboardCharacterGrounding[];
  characterTruth: string;
  approvedVisualRefs: readonly string[];
  identityLocks: readonly NonNullable<StoryboardCharacterGrounding["identityLock"]>[];
  identityMode: "approved-reference" | "exploratory" | "not-applicable";
  continuityIn: string;
  continuityOut: string;
}>;

const POSITION_STORY_FUNCTIONS = [
  "Establish the Mini-Block entry state and the first supported visual fact.",
  "Clarify the geography around the opening state.",
  "Clarify the central subject relationship present in the opening evidence.",
  "Isolate a supported story detail that gives the opening state meaning.",
  "Show the first supported shift in attention, intention, or physical state.",
  "Show the reaction caused by the preceding supported shift.",
  "Advance to the next supported action or story condition.",
  "Make the current obstacle, friction, or emotional resistance legible.",
  "Tighten visual pressure through staging, distance, or emphasis.",
  "Hold the unresolved setup that must carry into the next movement.",
  "Reorient the audience after the preceding change using supported geography or eyelines.",
  "Advance the next supported source event or emotional pressure.",
  "Show the human or physical reaction to that pressure.",
  "Emphasize a supported discovery, object, expression, or environmental clue.",
  "Cover the supported turn or change in meaning near the middle of the sequence.",
  "Show the immediate consequence of the supported turn.",
  "Isolate the supported detail that makes the stakes or emotional cost readable.",
  "Show the subject's supported intention, strategy, or next physical choice.",
  "Bring supported characters, objects, or story pressures into stronger visual relationship.",
  "Hold the strongest supported crisis pressure available in this Mini-Block evidence.",
  "Cover the principal supported confrontation, decision, or emotional collision.",
  "Give the strongest supported image or reaction its clearest visual emphasis.",
  "Show the immediate aftermath created by the preceding supported moment.",
  "Move the sequence toward its supported resolved state without inventing closure.",
  "Establish the Mini-Block exit boundary and a stable visual handoff to the next story address.",
] as const;

function boundedPosition(value: number) {
  return Math.min(25, Math.max(1, Math.trunc(Number(value) || 1)));
}

export function storyboardPositionsForScope(
  selectedPosition: number,
  scope: StoryboardGenerationScope,
): readonly number[] {
  const selected = boundedPosition(selectedPosition);
  if (scope === "single") return [selected];
  if (scope === "all25") return Array.from({ length: 25 }, (_, index) => index + 1);
  const start = Math.floor((selected - 1) / 5) * 5 + 1;
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function passageWindow(
  passages: readonly StoryboardPlanningPassage[],
  position: number,
) {
  if (!passages.length) return [];
  const start = Math.min(
    passages.length - 1,
    Math.floor(((position - 1) * passages.length) / 25),
  );
  const proportionalEnd = Math.ceil((position * passages.length) / 25);
  const end = Math.min(passages.length, Math.max(start + 1, proportionalEnd));
  return passages.slice(start, end);
}

function clean(value: string, limit = 700) {
  return value.replace(/\s+/gu, " ").trim().slice(0, limit);
}

function mentionsCharacter(
  text: string,
  character: StoryboardCharacterGrounding,
) {
  const candidates = [character.name, ...(character.aliases ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  return candidates.some((name) => {
    const escaped = name.replace(/[.*+?^$()|[\]\\]/gu, "\\$&");
    return new RegExp("\\b" + escaped + "\\b", "iu").test(text);
  });
}

function characterTruthLine(character: StoryboardCharacterGrounding) {
  return [
    character.name,
    character.pronouns ? "pronouns " + character.pronouns : "",
    character.role ? "role " + character.role : "",
    character.description,
    ...character.truthClaims.slice(0, 3),
  ].filter(Boolean).map((item) => clean(item, 420)).join("; ");
}

export function storyboardFrameBriefs(input: Readonly<{
  positions: readonly number[];
  passages: readonly StoryboardPlanningPassage[];
  characters?: readonly StoryboardCharacterGrounding[];
}>): readonly StoryboardFrameBrief[] {
  const characters = input.characters ?? [];
  return input.positions.map((rawPosition) => {
    const position = boundedPosition(rawPosition);
    const evidence = passageWindow(input.passages, position);
    const evidenceSummary = evidence.map((passage) => clean(passage.text)).filter(Boolean).join(" | ");
    const matchingCharacters = characters.filter((character) => mentionsCharacter(evidenceSummary, character));
    const approvedVisualRefs = [...new Set(matchingCharacters.flatMap((character) => character.approvedVisualRefs))];
    const identityLocks = matchingCharacters
      .map((character) => character.identityLock)
      .filter((value): value is NonNullable<StoryboardCharacterGrounding["identityLock"]> => Boolean(value));
    const identityMode = matchingCharacters.length === 0
      ? "not-applicable"
      : approvedVisualRefs.length && identityLocks.length
        ? "approved-reference"
        : "exploratory";
    const previousEvidence = passageWindow(input.passages, Math.max(1, position - 1));
    const nextEvidence = passageWindow(input.passages, Math.min(25, position + 1));
    const previousSummary = previousEvidence.map((passage) => clean(passage.text, 260)).join(" | ");
    const nextSummary = nextEvidence.map((passage) => clean(passage.text, 260)).join(" | ");
    return {
      position,
      storyFunction: POSITION_STORY_FUNCTIONS[position - 1],
      visibleChange: evidenceSummary
        ? "Make Position " + String(position).padStart(2, "0") + " visibly advance or reframe only this supported story evidence: " + evidenceSummary
        : "No direct screenplay passage is mapped to this position; use the progression function only to clarify already-established state without inventing an event.",
      evidence,
      evidenceSummary,
      characters: matchingCharacters,
      characterTruth: matchingCharacters.map(characterTruthLine).filter(Boolean).join(" | "),
      approvedVisualRefs,
      identityLocks,
      identityMode,
      continuityIn: position === 1
        ? "Mini-Block entry boundary."
        : previousSummary
          ? "Carry forward the established state from the preceding supported evidence: " + previousSummary
          : "Carry forward the established visual state from the preceding Storyboard position.",
      continuityOut: position === 25
        ? "Mini-Block exit boundary; leave a stable state for the next story address."
        : nextSummary
          ? "End in a state that can hand off to the next supported evidence: " + nextSummary
          : "End in a stable state that the next Storyboard position can continue.",
    };
  });
}
