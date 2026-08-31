export type AutonomousVisualAuthority = Readonly<{
  authorityClass: "delegated-autonomous-operator";
  delegated: true;
  autonomousRunId: string;
  operatorId: string;
  modelRole: string;
  modelId: string;
  provider: string;
  runtime: string;
}>;

export type AutonomousVisualPolicy = Readonly<{
  enabled: true;
  allowVisualProduction: true;
  autonomousRunId: string;
  projectId: string;
  configuredProviders?: readonly string[];
  allowPaidCloud?: boolean;
  minimumConfidence?: number;
  maxEvaluationAttempts?: number;
}>;

export type AutonomousVisualAnchorInput = Readonly<{
  projectId: string;
  currentRevision: string | number;
  targetId: string;
  miniBlockNumber: number;
  authority: AutonomousVisualAuthority;
  autonomousPolicy: AutonomousVisualPolicy;
  evidence?: Readonly<{ securityFailure?: boolean; integrityFailure?: boolean }>;
  evidenceRefs?: readonly string[];
  targetRefs?: readonly string[];
  recordedAt?: string;
}>;

export type AutonomousVisualAnchorReceipt = Readonly<{
  autonomousRunId: string;
  authorityClass: "delegated-autonomous-operator";
  operatorId: string;
  modelRole: string;
  modelId: string;
  provider: string;
  runtime: string;
  projectId: string;
  targetId: string;
  miniBlockNumber: number;
  baseRevision: string;
  currentRevision: string;
  resultingRevision: string;
  storyboardCandidateId: string;
  storyboardArtifactId: string;
  productionShotIds: readonly string[];
  evidenceRefs: readonly string[];
  targetRefs: readonly string[];
  rationales: readonly string[];
  affectedRefs: readonly string[];
  staleProjectionRefs: readonly string[];
  validationResult: "blocked" | "progressed" | "passed";
  storyCanonChanged: false;
  renderPlanReady: boolean;
  recordedAt: string;
}>;

export type AutonomousVisualAnchorResult =
  | Readonly<{ status: "blocked"; blocker: Readonly<{ code: string; message: string }>; receipt: AutonomousVisualAnchorReceipt }>
  | Readonly<{ status: "progressed" | "ready"; receipt: AutonomousVisualAnchorReceipt }>;

export function operateAutonomousVisualAnchor(
  input: AutonomousVisualAnchorInput,
  ports: Readonly<Record<string, (...args: any[]) => any>>,
): Promise<AutonomousVisualAnchorResult>;
