export const BUZZ_SOURCE_REPOSITORY = "https://github.com/block/buzz";
export const BUZZ_RUNTIME_LAYOUT_VERSION = 1;
export const BUZZ_MANAGED_DEPLOYMENT_KIND = "docker-compose" as const;

export const BUZZ_RUNTIME_COMPONENTS = [
  "buzz-relay",
  "buzz-cli",
  "buzz-agent",
  "buzz-dev-mcp",
] as const;

export type BuzzRuntimeComponent = (typeof BUZZ_RUNTIME_COMPONENTS)[number];

export const BUZZ_RUNTIME_PLATFORMS = [
  "windows-x64",
  "macos-x64",
  "macos-arm64",
  "linux-x64",
] as const;

export type BuzzRuntimePlatform = (typeof BUZZ_RUNTIME_PLATFORMS)[number];

export type BuzzRuntimeLifecycle =
  | "unconfigured"
  | "available"
  | "prerequisite-required"
  | "configuring"
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "degraded"
  | "repair-required"
  | "unavailable";

export type BuzzRuntimeComponentManifest = {
  id: BuzzRuntimeComponent;
  relativePath: string;
  sha256: string;
  required: boolean;
};

export type BuzzRuntimeManifest = {
  schemaVersion: typeof BUZZ_RUNTIME_LAYOUT_VERSION;
  sourceRepository: typeof BUZZ_SOURCE_REPOSITORY;
  sourceRevision: string;
  buzzVersion: string;
  platform: BuzzRuntimePlatform;
  packaged: boolean;
  components: BuzzRuntimeComponentManifest[];
  licenseFiles: string[];
};

export type BuzzManagedDeploymentFile = {
  path: string;
  sha256: string;
  bytes: number;
};

export type BuzzManagedDeploymentManifest = {
  schemaVersion: typeof BUZZ_RUNTIME_LAYOUT_VERSION;
  sourceRepository: typeof BUZZ_SOURCE_REPOSITORY;
  sourceTag: string;
  sourceRevision: string;
  deploymentKind: typeof BUZZ_MANAGED_DEPLOYMENT_KIND;
  relayImage: string;
  localOnly: true;
  validationGate: string;
  files: BuzzManagedDeploymentFile[];
  licenseFiles: string[];
};

export type BuzzRuntimePaths = {
  installRoot: string;
  dataRoot: string;
  credentialRoot: string;
  logRoot: string;
  backupRoot: string;
};

export type BuzzRuntimeSnapshot = {
  lifecycle: BuzzRuntimeLifecycle;
  configured: boolean;
  packaged: boolean;
  processRunning: boolean;
  relayListening: boolean;
  identityCreated: boolean;
  dataCreated: boolean;
  relayUrl: string;
  community: string;
  version: string;
  platform: BuzzRuntimePlatform | "unknown";
  paths: BuzzRuntimePaths | null;
  lastCheckedAt: string;
  message: string;
};

export const DORMANT_BUZZ_RUNTIME: BuzzRuntimeSnapshot = {
  lifecycle: "unconfigured",
  configured: false,
  packaged: false,
  processRunning: false,
  relayListening: false,
  identityCreated: false,
  dataCreated: false,
  relayUrl: "",
  community: "",
  version: "",
  platform: "unknown",
  paths: null,
  lastCheckedAt: "",
  message: "Buzz is an optional PlotPickle Story Room and has not been configured on this computer.",
};

export const BUZZ_RUNTIME_BOUNDARIES = {
  settingsOwner: "Settings → Integrations → Buzz",
  workspaceOwner: "Buzz",
  creativeAuthority: "PPF remains the canonical creative record.",
  codeAuthority: "GitHub remains the canonical code repository and pull-request authority when repository collaboration is enabled.",
  credentialRule: "Buzz private keys and service secrets never enter PPF projects, exports, reports, logs or GitHub commits.",
  dormantRule: "An unconfigured runtime creates no process, listening port, identity, credential or Buzz project data.",
  packagingRule: "PlotPickle can package a pinned, checksummed Docker Compose deployment bundle; native Buzz binaries and the separate Buzz desktop client are not embedded.",
  proposalRule: "Buzz discussion can create a reviewable PlotPickle proposal, but only an explicit human approval changes the PPF.",
} as const;

export function isDormantBuzzRuntime(snapshot: BuzzRuntimeSnapshot) {
  return snapshot.lifecycle === "unconfigured"
    && !snapshot.configured
    && !snapshot.processRunning
    && !snapshot.relayListening
    && !snapshot.identityCreated
    && !snapshot.dataCreated
    && snapshot.paths === null;
}

export function canStartBuzzRuntime(snapshot: BuzzRuntimeSnapshot) {
  return snapshot.packaged
    && snapshot.configured
    && (snapshot.lifecycle === "stopped" || snapshot.lifecycle === "repair-required");
}

export function canConfigureBuzzRuntime(snapshot: BuzzRuntimeSnapshot) {
  return snapshot.packaged
    && (snapshot.lifecycle === "unconfigured" || snapshot.lifecycle === "repair-required");
}

export function validateBuzzRuntimeManifest(manifest: BuzzRuntimeManifest) {
  const componentIds = new Set(manifest.components.map((component) => component.id));
  const missing = BUZZ_RUNTIME_COMPONENTS.filter((component) => !componentIds.has(component));
  const invalidHashes = manifest.components.filter((component) => component.sha256 && !/^[a-f0-9]{64}$/i.test(component.sha256));

  return {
    ok: manifest.schemaVersion === BUZZ_RUNTIME_LAYOUT_VERSION
      && manifest.sourceRepository === BUZZ_SOURCE_REPOSITORY
      && missing.length === 0
      && invalidHashes.length === 0
      && manifest.licenseFiles.length > 0,
    missing,
    invalidHashes: invalidHashes.map((component) => component.id),
  };
}

export function validateBuzzManagedDeploymentManifest(manifest: BuzzManagedDeploymentManifest) {
  const invalidFiles = manifest.files.filter((file) => !/^[A-Za-z0-9._-]+$/.test(file.path)
    || !/^[a-f0-9]{64}$/i.test(file.sha256)
    || !Number.isInteger(file.bytes)
    || file.bytes < 1);
  const missingLicences = manifest.licenseFiles.filter((license) => !manifest.files.some((file) => file.path === license));
  return {
    ok: manifest.schemaVersion === BUZZ_RUNTIME_LAYOUT_VERSION
      && manifest.sourceRepository === BUZZ_SOURCE_REPOSITORY
      && manifest.deploymentKind === BUZZ_MANAGED_DEPLOYMENT_KIND
      && manifest.localOnly === true
      && manifest.relayImage.startsWith("ghcr.io/block/buzz:")
      && invalidFiles.length === 0
      && missingLicences.length === 0
      && manifest.licenseFiles.length > 0,
    invalidFiles: invalidFiles.map((file) => file.path),
    missingLicences,
  };
}
