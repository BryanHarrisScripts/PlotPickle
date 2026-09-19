export const SHOT_INFORMATION_MODES = ["SHOW_NOW", "WITHHOLD_NOW"] as const;
export type ShotInformationMode = (typeof SHOT_INFORMATION_MODES)[number];

export const SHOT_INFORMATION_RELEASE_STATES = [
  "not-applicable",
  "pending",
  "linked",
  "intentionally-unresolved",
  "never-reveal",
] as const;
export type ShotInformationReleaseState = (typeof SHOT_INFORMATION_RELEASE_STATES)[number];

export type ShotInformationRelease = {
  readonly state: ShotInformationReleaseState;
  readonly reference: string;
  readonly condition: string;
};

export type ShotInformationDirective = {
  /** Stable directive identity. This is not a second canon-fact identity. */
  readonly id: string;
  /** Existing upstream story/canon/evidence identity controlled by this directive. */
  readonly sourceRef: string;
  /** Optional snapshot/fingerprint of the source when this directive was reviewed. */
  readonly sourceFingerprint: string;
  /** Human-readable bounded description of the information being controlled. */
  readonly statement: string;
  readonly mode: ShotInformationMode;
  /** Visible/audible path by which SHOW_NOW information may reach the audience. */
  readonly carrier: string;
  /** Framing/audio/timing intent used to prevent premature disclosure where relevant. */
  readonly protectionIntent: string;
  readonly release: ShotInformationRelease;
  readonly rationale: string;
};

export type StoryboardEditorialBlocking = {
  readonly subjectId: string;
  readonly startPosition: string;
  readonly facing: string;
  readonly eyelineTargetId: string;
  readonly movement: string;
  readonly endPosition: string;
  readonly screenDirection: string;
  readonly axisState: string;
};

/**
 * Provider-neutral editorial Shot semantics for the current PPF Storyboard path.
 * This is a semantic contract/projection, not a new persisted Shot store.
 */
export type StoryboardEditorialShot = {
  readonly shotId: string;
  readonly anchorRef: string;
  readonly order: number;
  readonly narrativePurpose: string;
  readonly shotSize: string;
  readonly cameraAngle: string;
  readonly cameraMovement: string;
  readonly lensIntent: string;
  readonly lightingIntent: string;
  readonly continuityLockReferences: readonly string[];
  readonly notes: string;
  readonly blocking: readonly StoryboardEditorialBlocking[];
  readonly informationDirectives: readonly ShotInformationDirective[];
};

function text(value: unknown, maximum = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function strings(value: unknown, maximum = 80) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => text(item, 240)).filter(Boolean))].slice(0, maximum)
    : [];
}

function normalizeRelease(value: unknown, mode: ShotInformationMode): ShotInformationRelease {
  const source = record(value);
  const requested = SHOT_INFORMATION_RELEASE_STATES.includes(source.state as ShotInformationReleaseState)
    ? source.state as ShotInformationReleaseState
    : mode === "SHOW_NOW"
      ? "not-applicable"
      : "pending";
  const state: ShotInformationReleaseState = mode === "SHOW_NOW" ? "not-applicable" : requested;
  return {
    state,
    reference: state === "not-applicable" ? "" : text(source.reference, 320),
    condition: state === "not-applicable" ? "" : text(source.condition, 1_000),
  };
}

function normalizeInformationDirective(value: unknown, index: number): ShotInformationDirective | null {
  const source = record(value);
  if (!Object.keys(source).length) return null;
  const mode: ShotInformationMode = source.mode === "WITHHOLD_NOW" ? "WITHHOLD_NOW" : "SHOW_NOW";
  const sourceRef = text(source.sourceRef, 320);
  const statement = text(source.statement, 1_000);
  if (!sourceRef || !statement) return null;
  return {
    id: text(source.id, 240) || `shot-information-${index + 1}`,
    sourceRef,
    sourceFingerprint: text(source.sourceFingerprint, 240),
    statement,
    mode,
    carrier: text(source.carrier, 1_000),
    protectionIntent: text(source.protectionIntent, 1_000),
    release: normalizeRelease(source.release, mode),
    rationale: text(source.rationale, 1_000),
  };
}

function normalizeBlocking(value: unknown): StoryboardEditorialBlocking[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = record(item);
    const subjectId = text(source.subjectId, 240);
    if (!subjectId) return [];
    return [{
      subjectId,
      startPosition: text(source.startPosition, 500),
      facing: text(source.facing, 240),
      eyelineTargetId: text(source.eyelineTargetId, 240),
      movement: text(source.movement, 500),
      endPosition: text(source.endPosition, 500),
      screenDirection: text(source.screenDirection, 240),
      axisState: text(source.axisState, 240),
    }];
  });
}

export function storyboardEditorialShotId(anchorRef: string, order: number) {
  const anchor = text(anchorRef, 320).replace(/[^A-Za-z0-9._:-]+/g, "-");
  const ordinal = Number.isInteger(order) && order > 0 ? order : 1;
  return anchor ? `storyboard-shot:${anchor}:shot-${ordinal}` : "";
}

/**
 * Adapts existing/proposed structured Shot data into the current PPF semantic contract.
 * Callers may pass the legacy StoryboardStructuredShot shape without importing its store.
 */
export function normalizeStoryboardEditorialShot(
  value: unknown,
  fallback: { readonly anchorRef: string; readonly order?: number },
): StoryboardEditorialShot {
  const source = record(value);
  const order = Number.isInteger(source.order) && Number(source.order) > 0
    ? Math.min(Number(source.order), 999)
    : Number.isInteger(fallback.order) && Number(fallback.order) > 0
      ? Math.min(Number(fallback.order), 999)
      : 1;
  const anchorRef = text(source.anchorRef, 320) || text(fallback.anchorRef, 320);
  const information = Array.isArray(source.informationDirectives)
    ? source.informationDirectives
      .map(normalizeInformationDirective)
      .filter((directive): directive is ShotInformationDirective => Boolean(directive))
      .filter((directive, index, all) => all.findIndex((candidate) => candidate.id === directive.id) === index)
      .slice(0, 80)
    : [];
  return {
    shotId: text(source.shotId, 320) || storyboardEditorialShotId(anchorRef, order),
    anchorRef,
    order,
    narrativePurpose: text(source.narrativePurpose, 2_000),
    shotSize: text(source.shotSize, 160),
    cameraAngle: text(source.cameraAngle, 160),
    cameraMovement: text(source.cameraMovement, 240),
    lensIntent: text(source.lensIntent, 240),
    lightingIntent: text(source.lightingIntent, 1_000),
    continuityLockReferences: strings(source.continuityLockReferences),
    notes: text(source.notes, 2_000),
    blocking: normalizeBlocking(source.blocking),
    informationDirectives: information,
  };
}

export function validateStoryboardEditorialShot(shot: StoryboardEditorialShot) {
  const errors: string[] = [];
  if (!shot.shotId) errors.push("shotId is required");
  if (!shot.anchorRef) errors.push("anchorRef is required");
  if (!Number.isInteger(shot.order) || shot.order < 1) errors.push("order must be a positive integer");
  const directiveIds = new Set<string>();
  for (const directive of shot.informationDirectives) {
    if (!directive.id) errors.push("information directive id is required");
    if (directiveIds.has(directive.id)) errors.push(`duplicate information directive id: ${directive.id}`);
    directiveIds.add(directive.id);
    if (!directive.sourceRef) errors.push(`${directive.id}: sourceRef is required`);
    if (!directive.statement) errors.push(`${directive.id}: statement is required`);
    if (directive.mode === "SHOW_NOW" && directive.release.state !== "not-applicable") {
      errors.push(`${directive.id}: SHOW_NOW must not carry a later release responsibility`);
    }
    if (directive.mode === "WITHHOLD_NOW" && directive.release.state === "not-applicable") {
      errors.push(`${directive.id}: WITHHOLD_NOW requires a release disposition`);
    }
    if (directive.release.state === "linked" && !directive.release.reference && !directive.release.condition) {
      errors.push(`${directive.id}: linked release requires a reference or condition`);
    }
  }
  return errors;
}

/** Production-ready validation is intentionally stricter than draft authoring. */
export function productionReadyShotInformationErrors(shot: StoryboardEditorialShot) {
  const errors = validateStoryboardEditorialShot(shot);
  for (const directive of shot.informationDirectives) {
    if (directive.mode !== "WITHHOLD_NOW") continue;
    if (directive.release.state === "pending") {
      errors.push(`${directive.id}: withheld information still has a pending release responsibility`);
    }
    if (directive.release.state === "intentionally-unresolved" && !directive.rationale.trim()) {
      errors.push(`${directive.id}: intentionally unresolved release requires a Human-readable rationale`);
    }
  }
  return errors;
}
