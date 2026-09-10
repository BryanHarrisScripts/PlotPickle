import type { Character, PlotPickleProject, StoryBlock, StoryScene } from "../project";

const SCREENPLAY_INTELLIGENCE_EXTENSION = "screenplayIntelligence";
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "but", "by", "for", "from", "has", "have", "he", "her", "his",
  "i", "in", "is", "it", "its", "of", "on", "or", "our", "she", "that", "the", "their", "them", "they", "this", "to", "was",
  "we", "were", "will", "with", "you", "your",
]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function unique(values: unknown[]) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function words(value: unknown) {
  return text(value).split(/\s+/).filter(Boolean);
}

function tokens(value: unknown) {
  return [...new Set(text(value)
    .toLowerCase()
    .replace(/[^a-z0-9' -]+/g, " ")
    .split(/\s+/)
    .map((item) => item.replace(/^'+|'+$/g, ""))
    .filter((item) => item.length >= 3 && !STOP_WORDS.has(item)))];
}

export type ControllingIdea = {
  value: string;
  cause: string;
  statement: string;
  updatedAt: string;
};

export type ControllingIdeaLens = {
  idea: ControllingIdea;
  counterArgument: string;
  endingProof: string;
  candidateEvidenceBlocks: number[];
  missing: Array<"value" | "cause" | "counter-argument" | "ending-proof">;
  status: "not-defined" | "developing" | "grounded";
};

export function controllingIdeaFor(project: PlotPickleProject): ControllingIdea {
  const extension = record(project.extensions?.[SCREENPLAY_INTELLIGENCE_EXTENSION]);
  const candidate = record(extension?.controllingIdea);
  const value = text(candidate?.value);
  const cause = text(candidate?.cause);
  return {
    value,
    cause,
    statement: text(candidate?.statement) || (value && cause ? `${value} because ${cause}` : value || cause),
    updatedAt: text(candidate?.updatedAt),
  };
}

/**
 * Explicit writer-owned update. This never changes theme, anti-theme, blocks or screenplay text.
 */
export function withControllingIdea(
  project: PlotPickleProject,
  input: Partial<ControllingIdea>,
  updatedAt = new Date().toISOString(),
): PlotPickleProject {
  const existingExtension = record(project.extensions?.[SCREENPLAY_INTELLIGENCE_EXTENSION]) ?? {};
  const previous = controllingIdeaFor(project);
  const value = text(input.value ?? previous.value);
  const cause = text(input.cause ?? previous.cause);
  const statement = text(input.statement) || (value && cause ? `${value} because ${cause}` : value || cause);
  return {
    ...project,
    extensions: {
      ...(project.extensions ?? {}),
      [SCREENPLAY_INTELLIGENCE_EXTENSION]: {
        ...existingExtension,
        version: 1,
        controllingIdea: { value, cause, statement, updatedAt },
      },
    },
  };
}

export function buildControllingIdeaLens(project: PlotPickleProject): ControllingIdeaLens {
  const idea = controllingIdeaFor(project);
  const counterArgument = text(project.story.antiTheme);
  const endingProof = text(project.development?.foundations?.endingProof) || text(project.story.ending);
  const candidateEvidenceBlocks = project.blocks
    .filter((block) => Boolean(text(block.choice) && (text(block.consequence) || text(block.emotionalTurn) || text(block.payoff))))
    .map((block) => block.number);
  const missing: ControllingIdeaLens["missing"] = [];
  if (!idea.value) missing.push("value");
  if (!idea.cause) missing.push("cause");
  if (!counterArgument) missing.push("counter-argument");
  if (!endingProof) missing.push("ending-proof");
  const status = !idea.value && !idea.cause ? "not-defined" : missing.length === 0 ? "grounded" : "developing";
  return { idea, counterArgument, endingProof, candidateEvidenceBlocks, missing, status };
}

export type MisbeliefPressurePoint = {
  checkpointId: string;
  kind: string;
  blockNumber: number | null;
  belief: string;
  pressure: string;
  choice: string;
  consequence: string;
  evidence: string;
};

export type CharacterMisbeliefLens = {
  characterId: string;
  characterName: string;
  misbelief: string;
  origin: string;
  truth: string;
  pressurePoints: MisbeliefPressurePoint[];
  missing: Array<"misbelief" | "origin" | "truth" | "pressure-points">;
};

function isPrimaryCharacter(project: PlotPickleProject, character: Character) {
  if (/protagonist|lead/i.test(character.role)) return true;
  const protagonistName = text(project.development?.foundations?.protagonist).toLowerCase();
  return Boolean(protagonistName && protagonistName === text(character.name).toLowerCase());
}

export function buildCharacterMisbeliefLens(project: PlotPickleProject, characterId: string): CharacterMisbeliefLens | null {
  const character = project.characters.find((item) => item.id === characterId);
  if (!character) return null;
  const primary = isPrimaryCharacter(project, character);
  const matrix = character.arcMatrix;
  const misbelief = text(matrix?.protectiveLie) || (primary ? text(project.development?.ghost?.lie) : "");
  const origin = text(character.ghost) || (primary ? text(project.development?.ghost?.origin) : "");
  const truth = text(matrix?.emergingTruth) || (primary ? text(project.development?.ghost?.truth) : "");
  const pressurePoints = Array.isArray(matrix?.checkpoints)
    ? matrix.checkpoints
      .filter((checkpoint) => unique([checkpoint.belief, checkpoint.pressure, checkpoint.choice, checkpoint.consequence, checkpoint.evidence]).length > 0)
      .map((checkpoint) => ({
        checkpointId: checkpoint.id,
        kind: checkpoint.kind,
        blockNumber: checkpoint.blockNumber,
        belief: text(checkpoint.belief),
        pressure: text(checkpoint.pressure),
        choice: text(checkpoint.choice),
        consequence: text(checkpoint.consequence),
        evidence: text(checkpoint.evidence),
      }))
    : [];
  const missing: CharacterMisbeliefLens["missing"] = [];
  if (!misbelief) missing.push("misbelief");
  if (!origin) missing.push("origin");
  if (!truth) missing.push("truth");
  if (pressurePoints.length === 0) missing.push("pressure-points");
  return { characterId, characterName: character.name, misbelief, origin, truth, pressurePoints, missing };
}

export type CharacterPerspectiveGap = "absent" | "passive" | "unchallenged" | "unchanged";

export type CharacterPerspectiveRow = {
  blockNumber: number;
  blockTitle: string;
  present: boolean;
  objective: string[];
  pressure: string[];
  action: string[];
  turn: string[];
  gaps: CharacterPerspectiveGap[];
};

export type CharacterPerspectiveAudit = {
  characterId: string;
  characterName: string;
  rows: CharacterPerspectiveRow[];
  presentBlocks: number;
  activeBlocks: number;
  challengedBlocks: number;
  changedBlocks: number;
  gapBlocks: number[];
};

function sceneHasCharacter(scene: StoryScene, characterId: string) {
  return scene.characterIds.includes(characterId)
    || scene.miniBlocks.some((mini) => mini.characterId === characterId);
}

function blockHasCharacter(block: StoryBlock, characterId: string) {
  return block.characterIds.includes(characterId) || block.scenes.some((scene) => sceneHasCharacter(scene, characterId));
}

export function auditCharacterPerspective(project: PlotPickleProject, characterId: string): CharacterPerspectiveAudit | null {
  const character = project.characters.find((item) => item.id === characterId);
  if (!character) return null;
  const rows = [...project.blocks]
    .sort((left, right) => left.number - right.number)
    .map((block): CharacterPerspectiveRow => {
      const present = blockHasCharacter(block, characterId);
      const scenes = block.scenes.filter((scene) => sceneHasCharacter(scene, characterId));
      const minis = scenes.flatMap((scene) => scene.miniBlocks.filter((mini) => mini.characterId === characterId));
      const objective = present ? unique([block.goal, ...scenes.map((scene) => scene.objective), ...minis.map((mini) => mini.objective)]) : [];
      const pressure = present ? unique([block.conflict, ...scenes.flatMap((scene) => [scene.opposition, scene.conflict]), ...minis.map((mini) => mini.resistance)]) : [];
      const action = present ? unique([block.choice, block.action, ...scenes.map((scene) => scene.action), ...minis.map((mini) => mini.action)]) : [];
      const turn = present ? unique([
        block.consequence,
        block.emotionalTurn,
        ...scenes.flatMap((scene) => [scene.reversal, scene.turn, scene.outcome]),
        ...minis.flatMap((mini) => [mini.revelation, mini.turn]),
      ]) : [];
      const gaps: CharacterPerspectiveGap[] = [];
      if (!present) gaps.push("absent");
      if (present && objective.length === 0 && action.length === 0) gaps.push("passive");
      if (present && pressure.length === 0) gaps.push("unchallenged");
      if (present && turn.length === 0) gaps.push("unchanged");
      return { blockNumber: block.number, blockTitle: block.title, present, objective, pressure, action, turn, gaps };
    });
  return {
    characterId,
    characterName: character.name,
    rows,
    presentBlocks: rows.filter((row) => row.present).length,
    activeBlocks: rows.filter((row) => row.action.length > 0 || row.objective.length > 0).length,
    challengedBlocks: rows.filter((row) => row.pressure.length > 0).length,
    changedBlocks: rows.filter((row) => row.turn.length > 0).length,
    gapBlocks: rows.filter((row) => row.gaps.length > 0).map((row) => row.blockNumber),
  };
}

export function auditAllCharacterPerspectives(project: PlotPickleProject) {
  return project.characters
    .map((character) => auditCharacterPerspective(project, character.id))
    .filter((audit): audit is CharacterPerspectiveAudit => Boolean(audit));
}

export type LocationChallengeCandidate = {
  locationId: string;
  locationName: string;
  score: number;
  sharedTerms: string[];
  reason: string;
  source: "canonical-world";
  requiresHumanAcceptance: true;
};

export type LocationChallenge = {
  sceneId: string;
  sceneTitle: string;
  currentLocationIds: string[];
  candidates: LocationChallengeCandidate[];
};

function findScene(project: PlotPickleProject, sceneId: string) {
  for (const block of project.blocks) {
    const scene = block.scenes.find((item) => item.id === sceneId);
    if (scene) return { block, scene };
  }
  return null;
}

/**
 * Suggests only locations already recorded in canon. It never changes scene.locationIds.
 */
export function challengeSceneLocation(project: PlotPickleProject, sceneId: string, limit = 5): LocationChallenge | null {
  const match = findScene(project, sceneId);
  if (!match) return null;
  const { block, scene } = match;
  const current = new Set(scene.locationIds);
  const sceneTerms = tokens(unique([
    scene.purpose,
    scene.objective,
    scene.opposition,
    scene.conflict,
    scene.action,
    scene.reversal,
    scene.outcome,
    block.goal,
    block.conflict,
    block.emotionalTurn,
  ]).join(" "));
  const candidates = project.world.locations
    .filter((location) => !current.has(location.id))
    .map((location): LocationChallengeCandidate => {
      const locationTerms = tokens(`${location.name} ${location.description}`);
      const sharedTerms = locationTerms.filter((term) => sceneTerms.includes(term));
      const score = sharedTerms.length * 10 + (text(location.description) ? 2 : 0) + (text(location.image) ? 1 : 0);
      const pressure = text(scene.opposition) || text(scene.conflict) || text(block.conflict) || "the recorded scene pressure";
      const reason = sharedTerms.length > 0
        ? `${location.name} shares ${sharedTerms.join(", ")} with the scene context; test whether those recorded qualities sharpen ${pressure}.`
        : `${location.name} is an existing canonical alternative; test whether moving the same objective and conflict there creates stronger action, pressure, or visual behavior.`;
      return {
        locationId: location.id,
        locationName: location.name,
        score,
        sharedTerms,
        reason,
        source: "canonical-world",
        requiresHumanAcceptance: true,
      };
    })
    .sort((left, right) => right.score - left.score || left.locationName.localeCompare(right.locationName))
    .slice(0, Math.min(8, Math.max(1, limit)));
  return { sceneId: scene.id, sceneTitle: scene.title, currentLocationIds: [...scene.locationIds], candidates };
}

export type SpecReadinessIssueKind =
  | "action-density"
  | "camera-direction"
  | "interior-thought"
  | "scene-heading"
  | "dialogue-density"
  | "parenthetical-density"
  | "character-cue"
  | "production-mode";

export type SpecReadinessIssue = {
  id: string;
  elementId: string;
  kind: SpecReadinessIssueKind;
  severity: "info" | "warning";
  message: string;
  evidence: string;
};

export type SpecReadinessReport = {
  status: "empty" | "ready-to-review" | "needs-polish" | "needs-revision";
  score: number;
  elementCount: number;
  issueCount: number;
  warningCount: number;
  issues: SpecReadinessIssue[];
};

const CAMERA_DIRECTION = /\b(?:ANGLE ON|CAMERA|CLOSE ON|CLOSE[- ]?UP|CU\b|DOLLY|PAN TO|POV\b|PUSH IN|PULL BACK|TRACKING SHOT|TILT|WE HEAR|WE SEE|ZOOM)\b/i;
const INTERIOR_THOUGHT = /\b(?:decides|feels that|knows that|realizes|remembers|thinks|wonders)\b/i;
const SCENE_HEADING = /^(?:INT\.|EXT\.|INT\.?\/EXT\.|EXT\.?\/INT\.|I\/E\.)\s+\S+/i;

function excerpt(value: string, max = 120) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

export function scanSpecReadiness(project: PlotPickleProject): SpecReadinessReport {
  const elements = project.screenplay.draftElements.filter((element) => !element.omitted);
  const issues: SpecReadinessIssue[] = [];
  const push = (
    elementId: string,
    kind: SpecReadinessIssueKind,
    severity: SpecReadinessIssue["severity"],
    message: string,
    evidence: string,
  ) => issues.push({ id: `${elementId || "screenplay"}:${kind}`, elementId, kind, severity, message, evidence });

  if (project.screenplay.productionDraft?.mode === "production") {
    push("screenplay", "production-mode", "info", "Production draft mode is active; spec-readiness findings are advisory until the writer returns to a submission draft.", "productionDraft.mode=production");
  }

  for (const element of elements) {
    const value = text(element.text);
    const count = words(value).length;
    if (element.type === "action") {
      if (count > 55) push(element.id, "action-density", "warning", "Action paragraph is dense for a fast screenplay read; consider separating distinct playable actions.", excerpt(value));
      if (CAMERA_DIRECTION.test(value)) push(element.id, "camera-direction", "warning", "Action contains explicit camera/viewer direction; confirm it is essential to the storytelling rather than directing from the page.", excerpt(value));
      if (INTERIOR_THOUGHT.test(value)) push(element.id, "interior-thought", "warning", "Action may describe an internal conclusion that cannot be directly seen or heard; look for playable evidence.", excerpt(value));
    }
    if (element.type === "scene-heading" && value && !SCENE_HEADING.test(value)) {
      push(element.id, "scene-heading", "warning", "Scene heading does not begin with a standard interior/exterior marker.", excerpt(value));
    }
    if (element.type === "dialogue" && count > 70) {
      push(element.id, "dialogue-density", "warning", "Dialogue block is long enough to merit a rhythm, interruption, action, or intent check.", excerpt(value));
    }
    if (element.type === "parenthetical" && count > 6) {
      push(element.id, "parenthetical-density", "info", "Parenthetical is carrying substantial direction; check whether the action or dialogue can carry it instead.", excerpt(value));
    }
    if (element.type === "character" && value && value !== value.toUpperCase()) {
      push(element.id, "character-cue", "info", "Character cue is not uppercase; verify the exported screenplay formatter will normalize it.", excerpt(value));
    }
  }

  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === "warning" ? 6 : 2), 0);
  const score = elements.length === 0 ? 0 : Math.max(0, 100 - penalty);
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const status: SpecReadinessReport["status"] = elements.length === 0
    ? "empty"
    : score >= 90
      ? "ready-to-review"
      : score >= 75
        ? "needs-polish"
        : "needs-revision";
  return { status, score, elementCount: elements.length, issueCount: issues.length, warningCount, issues };
}
