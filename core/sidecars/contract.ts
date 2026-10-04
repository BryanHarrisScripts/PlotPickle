export const SIDECAR_STATES = ["waiting", "starting", "ready", "degraded", "unavailable", "failed", "stopped"] as const;
export type SidecarState = typeof SIDECAR_STATES[number];

export type SidecarEvidence = Readonly<{ kind: string; summary: string; observedAt: string }>;
export type SidecarStatus = Readonly<{ id: string; state: SidecarState; evidence: readonly SidecarEvidence[]; pid?: number }>;

export type VerificationRequest = Readonly<{
  requestId: string;
  operation: "health" | "verify-contract" | "rendered-acceptance";
  target?: string;
}>;

export type VerificationResult = Readonly<{
  requestId: string;
  state: SidecarState;
  evidence: readonly SidecarEvidence[];
}>;

export function validateVerificationRequest(request: VerificationRequest): VerificationRequest {
  if (!request.requestId.trim()) throw new Error("Sidecar requestId is required.");
  if (!["health", "verify-contract", "rendered-acceptance"].includes(request.operation)) {
    throw new Error("Sidecar operation is not permitted.");
  }
  return Object.freeze({ ...request });
}
