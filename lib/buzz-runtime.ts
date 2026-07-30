export const BUZZ_SOURCE_REPOSITORY = "https://github.com/block/buzz";
export const BUZZ_RUNTIME_LAYOUT_VERSION = 1;

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
  | "configuring"
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
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
  message: "Buzz is included as an optional PlotPickle-managed runtime but has not been configured on this computer.",
};

export const BUZZ_RUNTIME_BOUNDARIES = {
  settingsOwner: "Settings → Integrations → Buzz",
  workspaceOwner: "Buzz",
  creativeAuthority: "PPF remains the canonical creative record.",
  codeAuthority: "GitHub remains the canonical code repository and pull-request authority.",
  credentialRule: "Buzz private keys and service secrets never enter PPF projects, exports, reports, logs or GitHub commits.",
  dormantRule: "An unconfigured runtime creates no process, listening port, identity, credential or Buzz project data.",
  packagingRule: "PlotPickle packages pinned platform-native Buzz components without the separate Buzz desktop client.",
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
