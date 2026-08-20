import type { PlotPickleAccountSyncState } from "../identity/account-learn-sync";
import * as core from "./managed-cloud-compute-core.mjs";

export type CloudComputeCapability = "text" | "image" | "video";
export type CloudComputeAvailability = "available" | "busy" | "offline";
export type CloudComputeCost =
  | { readonly kind: "free" }
  | { readonly kind: "paid"; readonly currency: string; readonly amountMinor: number; readonly unit: "job" };

export type ManagedCloudService = {
  readonly version: 1;
  readonly serviceId: string;
  readonly serviceType: "managed-cloud";
  readonly enabled: true;
  readonly availability: CloudComputeAvailability;
  readonly capabilities: readonly CloudComputeCapability[];
  readonly modelClasses: readonly string[];
  readonly workflowClasses: readonly string[];
  readonly protocolVersion: string;
  readonly cost: CloudComputeCost;
  readonly verifiedAt: string;
  readonly expiresAt: string;
};

export type CloudServiceRegistry = {
  readonly version: 1;
  readonly personId: string;
  readonly services: Readonly<Record<string, ManagedCloudService>>;
};

export type ScopedCloudWorkPackage = {
  readonly version: 1;
  readonly jobId: string;
  readonly requesterPersonId: string;
  readonly requesterNodeId: string;
  readonly targetServiceId: string;
  readonly capability: CloudComputeCapability;
  readonly contextItems: readonly { readonly contextId: string; readonly kind: string; readonly text: string }[];
  readonly referenceAssets: readonly { readonly assetId: string; readonly contentHashSha256: string; readonly mediaType: string; readonly byteLength: number }[];
  readonly modelClass: string | null;
  readonly workflowClass: string | null;
  readonly constraints: { readonly maxRuntimeSeconds: number; readonly maxOutputBytes: number };
  readonly grant: { readonly grantId: string; readonly issuedAt: string; readonly expiresAt: string; readonly targetServiceId: string; readonly capability: CloudComputeCapability; readonly maxUses: 1 };
  readonly returnRouteId: string;
  readonly billingConsentId: string | null;
  readonly requestedAt: string;
};

export type CandidateCloudResult = {
  readonly version: 1;
  readonly resultId: string;
  readonly jobId: string;
  readonly candidateStatus: "candidate";
  readonly canonStatus: "not-canon";
  readonly accepted: false;
  readonly artifact: { readonly artifactId: string; readonly contentHashSha256: string; readonly mediaType: string; readonly byteLength: number; readonly remoteArtifactRef: string };
  readonly provenance: { readonly serviceId: string; readonly signedReceiptId: string; readonly completedAt: string; readonly providerClass: string | null; readonly modelClass: string | null; readonly workflowClass: string | null };
};

export const createCloudServiceRegistry = core.createCloudServiceRegistry as (personId: string) => CloudServiceRegistry;
export const createManagedCloudService = core.createManagedCloudService as (input: unknown) => ManagedCloudService;
export const registerManagedCloudService = core.registerManagedCloudService as (registry: CloudServiceRegistry, input: unknown) => CloudServiceRegistry;
export const disableManagedCloudService = core.disableManagedCloudService as (registry: CloudServiceRegistry, serviceId: string) => CloudServiceRegistry;
export const listManagedCloudServices = core.listManagedCloudServices as (registry: CloudServiceRegistry, options?: unknown) => readonly ManagedCloudService[];
export const requireSelectedCloudService = core.requireSelectedCloudService as (registry: CloudServiceRegistry, serviceId: string, options?: unknown) => ManagedCloudService;
export const createScopedCloudWorkPackage = core.createScopedCloudWorkPackage as (account: PlotPickleAccountSyncState, selectedService: ManagedCloudService, input: unknown) => ScopedCloudWorkPackage;
export const assertCloudWorkPackageUsable = core.assertCloudWorkPackageUsable as (workPackage: ScopedCloudWorkPackage, serviceId: string, now?: string) => ScopedCloudWorkPackage;
export const createCandidateCloudResult = core.createCandidateCloudResult as (workPackage: ScopedCloudWorkPackage, input: unknown) => CandidateCloudResult;

export const CLOUD_COMPUTE_CAPABILITIES = core.CLOUD_COMPUTE_CAPABILITIES as readonly CloudComputeCapability[];
export const CLOUD_COMPUTE_AVAILABILITY = core.CLOUD_COMPUTE_AVAILABILITY as readonly CloudComputeAvailability[];
export const CLOUD_SERVICE_ALLOWLIST = core.CLOUD_SERVICE_ALLOWLIST as readonly string[];
export const CLOUD_WORK_PACKAGE_ALLOWLIST = core.CLOUD_WORK_PACKAGE_ALLOWLIST as readonly string[];
export const CLOUD_RESULT_ALLOWLIST = core.CLOUD_RESULT_ALLOWLIST as readonly string[];
