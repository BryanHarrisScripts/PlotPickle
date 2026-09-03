export type CharacterDevelopmentWorkspaceState = "defined" | "observed" | "emerging" | "missing" | "locked" | "stale" | "not-applicable";

export type CharacterDevelopmentWorkspaceEvidence = {
  readonly physical?: readonly string[];
  readonly performance?: readonly string[];
  readonly wardrobe?: readonly string[];
  readonly props?: readonly string[];
  readonly powersEffects?: readonly string[];
  readonly relationships?: readonly string[];
  readonly locationsWorld?: readonly string[];
  readonly visualDo?: readonly string[];
  readonly visualAvoid?: readonly string[];
};

export type CharacterDevelopmentWorkspaceProjection = {
  projectId: string;
  ppfRevision: string;
  characterId: string;
  characterName: string;
  identityStatus: string;
  evidenceLanes: Array<{
    id: string;
    label: string;
    state: CharacterDevelopmentWorkspaceState;
    count: number;
    detail: string;
  }>;
  studies: Array<{
    type: string;
    label: string;
    state: CharacterDevelopmentWorkspaceState;
    inputCount: number;
    candidateCount: number;
    candidateRefs: string[];
    detail: string;
  }>;
  summary: {
    defined: number;
    observed: number;
    emerging: number;
    missing: number;
    locked: number;
    stale: number;
    notApplicable: number;
  };
};

export const CHARACTER_DEVELOPMENT_WORKSPACE_STATES: readonly CharacterDevelopmentWorkspaceState[];

export function createCharacterDevelopmentWorkspaceProjection(input?: {
  readonly projectId?: string;
  readonly ppfRevision?: string;
  readonly characterId?: string;
  readonly characterName?: string;
  readonly identityStatus?: string;
  readonly characterEvidence?: CharacterDevelopmentWorkspaceEvidence;
  readonly approvedVisualRefs?: readonly string[];
  readonly observedVisualRefs?: readonly string[];
  readonly referenceAngles?: readonly string[];
  readonly generatedStudyRefs?: Readonly<Record<string, readonly string[]>>;
  readonly staleStudyTypes?: readonly string[];
}): CharacterDevelopmentWorkspaceProjection;
