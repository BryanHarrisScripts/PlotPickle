export type CharacterTruthClaimKind =
  | "identity"
  | "backstory"
  | "personality"
  | "want"
  | "need"
  | "fear"
  | "worldview"
  | "relationship"
  | "conflict"
  | "setting"
  | "starting-state"
  | "ending-state"
  | "arc-direction"
  | "visual-reference"
  | "sensitive-source";

export type CharacterTruthClaimReviewState =
  | "source-only"
  | "needs-review"
  | "human-approved"
  | "rejected";

export type CharacterTruthClaim = {
  readonly id: string;
  readonly characterIds: readonly string[];
  readonly kind: CharacterTruthClaimKind;
  readonly summary: string;
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly sourceVersion: string;
  readonly reviewState: CharacterTruthClaimReviewState;
  readonly targetArcField: string | null;
  readonly handling: "writer-reference" | "restricted-reference";
  readonly canonEffect: "none";
  readonly note: string;
};

export type CharacterProfileSource = {
  readonly id: string;
  readonly fileName: string;
  readonly repoPath: string;
  readonly blobSha: string;
  readonly characterIds: readonly string[];
  readonly immutable: true;
  readonly sourceVersion: string;
  readonly status: "historical-reference";
  readonly handlingNotes: readonly string[];
};

export type CharacterArcEvidenceState =
  | "not-present-no-evidence"
  | "present-arc-neutral"
  | "pressure-introduced"
  | "belief-strategy-reinforced"
  | "belief-strategy-challenged"
  | "meaningful-choice"
  | "consequence"
  | "relationship-movement"
  | "arc-transition"
  | "unresolved-insufficient-evidence";

export type CharacterArcEvidenceReviewState = "unreviewed" | "human-reviewed";

export type CharacterArcEvidenceCell = {
  readonly characterId: string;
  readonly blockNumber: number;
  readonly state: CharacterArcEvidenceState;
  readonly reviewState: CharacterArcEvidenceReviewState;
  readonly passageIds: readonly string[];
  readonly sceneNumbers: readonly number[];
  readonly profileClaimIds: readonly string[];
  readonly note: string;
  readonly reviewedAt: string | null;
};

export type CharacterArcCheckpointEvidence = {
  readonly characterId: string;
  readonly kind: "opening" | "midpoint" | "crisis" | "climax" | "ending";
  readonly targetArcField:
    | "startingState"
    | "midpointShift"
    | "crisisChoice"
    | "climaxChoice"
    | "endingState";
  readonly blockNumbers: readonly number[];
  readonly passageIds: readonly string[];
  readonly sceneNumbers: readonly number[];
  readonly note: string;
};

export type CharacterTruthEvidence = {
  readonly schemaVersion: 1;
  readonly fixtureId: string;
  readonly sources: readonly CharacterProfileSource[];
  readonly claims: readonly CharacterTruthClaim[];
  readonly principalCharacterIds: readonly string[];
  readonly arcCells: readonly CharacterArcEvidenceCell[];
  readonly checkpoints: readonly CharacterArcCheckpointEvidence[];
  readonly governingRule: string;
};

function clean(value: unknown, limit = 2000) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
}

function integer(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isInteger(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function strings(value: unknown, limit = 128) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => clean(item, 500)).filter(Boolean))].slice(0, limit)
    : [];
}

function numbers(value: unknown, limit = 256) {
  return Array.isArray(value)
    ? [...new Set(value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 0 && item <= 9999))]
      .sort((left, right) => left - right)
      .slice(0, limit)
    : [];
}

function claimKind(value: unknown): CharacterTruthClaimKind {
  const allowed: CharacterTruthClaimKind[] = [
    "identity", "backstory", "personality", "want", "need", "fear", "worldview",
    "relationship", "conflict", "setting", "starting-state", "ending-state",
    "arc-direction", "visual-reference", "sensitive-source",
  ];
  return allowed.includes(value as CharacterTruthClaimKind)
    ? value as CharacterTruthClaimKind
    : "backstory";
}

function claimReviewState(value: unknown): CharacterTruthClaimReviewState {
  return value === "needs-review"
    || value === "human-approved"
    || value === "rejected"
    ? value
    : "source-only";
}

function arcState(value: unknown): CharacterArcEvidenceState {
  const allowed: CharacterArcEvidenceState[] = [
    "not-present-no-evidence",
    "present-arc-neutral",
    "pressure-introduced",
    "belief-strategy-reinforced",
    "belief-strategy-challenged",
    "meaningful-choice",
    "consequence",
    "relationship-movement",
    "arc-transition",
    "unresolved-insufficient-evidence",
  ];
  return allowed.includes(value as CharacterArcEvidenceState)
    ? value as CharacterArcEvidenceState
    : "unresolved-insufficient-evidence";
}

function normalizeSource(value: unknown): CharacterProfileSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<CharacterProfileSource>;
  const id = clean(source.id, 160);
  const fileName = clean(source.fileName, 500);
  const repoPath = clean(source.repoPath, 900);
  const blobSha = clean(source.blobSha, 160);
  if (!id || !fileName || !repoPath || !blobSha) return null;
  return {
    id,
    fileName,
    repoPath,
    blobSha,
    characterIds: strings(source.characterIds, 12),
    immutable: true,
    sourceVersion: clean(source.sourceVersion, 80) || "historical-profile",
    status: "historical-reference",
    handlingNotes: strings(source.handlingNotes, 16),
  };
}

function normalizeClaim(value: unknown): CharacterTruthClaim | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<CharacterTruthClaim>;
  const id = clean(source.id, 200);
  const summary = clean(source.summary, 3000);
  const sourceId = clean(source.sourceId, 160);
  const sourceRef = clean(source.sourceRef, 900);
  if (!id || !summary || !sourceId || !sourceRef) return null;
  return {
    id,
    characterIds: strings(source.characterIds, 12),
    kind: claimKind(source.kind),
    summary,
    sourceId,
    sourceRef,
    sourceVersion: clean(source.sourceVersion, 80) || "historical-profile",
    reviewState: claimReviewState(source.reviewState),
    targetArcField: clean(source.targetArcField, 120) || null,
    handling: source.handling === "restricted-reference" ? "restricted-reference" : "writer-reference",
    canonEffect: "none",
    note: clean(source.note, 2000),
  };
}

function normalizeArcCell(value: unknown): CharacterArcEvidenceCell | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<CharacterArcEvidenceCell>;
  const characterId = clean(source.characterId, 160);
  if (!characterId) return null;
  const passageIds = strings(source.passageIds, 2500);
  return {
    characterId,
    blockNumber: integer(source.blockNumber, 1, 24),
    state: arcState(source.state),
    reviewState: source.reviewState === "human-reviewed" ? "human-reviewed" : "unreviewed",
    passageIds,
    sceneNumbers: numbers(source.sceneNumbers),
    profileClaimIds: strings(source.profileClaimIds, 128),
    note: clean(source.note, 2400),
    reviewedAt: clean(source.reviewedAt, 80) || null,
  };
}

function normalizeCheckpoint(value: unknown): CharacterArcCheckpointEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<CharacterArcCheckpointEvidence>;
  const characterId = clean(source.characterId, 160);
  const kinds = ["opening", "midpoint", "crisis", "climax", "ending"] as const;
  const fields = ["startingState", "midpointShift", "crisisChoice", "climaxChoice", "endingState"] as const;
  if (!characterId || !kinds.includes(source.kind as typeof kinds[number]) || !fields.includes(source.targetArcField as typeof fields[number])) {
    return null;
  }
  return {
    characterId,
    kind: source.kind as typeof kinds[number],
    targetArcField: source.targetArcField as typeof fields[number],
    blockNumbers: numbers(source.blockNumbers, 24).filter((number) => number >= 1 && number <= 24),
    passageIds: strings(source.passageIds, 2500),
    sceneNumbers: numbers(source.sceneNumbers),
    note: clean(source.note, 1800),
  };
}

export function normalizeCharacterTruthEvidence(value: unknown): CharacterTruthEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<CharacterTruthEvidence>;
  const fixtureId = clean(source.fixtureId, 240);
  if (!fixtureId) return null;
  return {
    schemaVersion: 1,
    fixtureId,
    sources: Array.isArray(source.sources)
      ? source.sources.map(normalizeSource).filter((item): item is CharacterProfileSource => Boolean(item))
      : [],
    claims: Array.isArray(source.claims)
      ? source.claims.map(normalizeClaim).filter((item): item is CharacterTruthClaim => Boolean(item))
      : [],
    principalCharacterIds: strings(source.principalCharacterIds, 24),
    arcCells: Array.isArray(source.arcCells)
      ? source.arcCells.map(normalizeArcCell).filter((item): item is CharacterArcEvidenceCell => Boolean(item))
      : [],
    checkpoints: Array.isArray(source.checkpoints)
      ? source.checkpoints.map(normalizeCheckpoint).filter((item): item is CharacterArcCheckpointEvidence => Boolean(item))
      : [],
    governingRule: clean(source.governingRule, 3000),
  };
}

export function reviewCharacterArcEvidence(
  evidence: CharacterTruthEvidence,
  characterId: string,
  blockNumber: number,
  state: CharacterArcEvidenceState,
  note: string,
  reviewedAt: string,
): CharacterTruthEvidence {
  const normalized = normalizeCharacterTruthEvidence(evidence);
  if (!normalized) return evidence;
  const id = clean(characterId, 160);
  const block = integer(blockNumber, 1, 24);
  return {
    ...normalized,
    arcCells: normalized.arcCells.map((cell) => (
      cell.characterId !== id || cell.blockNumber !== block
        ? cell
        : {
          ...cell,
          state: arcState(state),
          reviewState: "human-reviewed" as const,
          note: clean(note, 2400),
          reviewedAt: clean(reviewedAt, 80) || null,
        }
    )),
  };
}
