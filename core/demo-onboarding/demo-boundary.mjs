const forbiddenAuthorityKeys = new Set([
  "authContext",
  "csrfToken",
  "credentials",
  "providerCredentials",
  "connectorScopes",
  "profileId",
  "humanProfileId",
  "buzzIdentity",
  "ppfAuthority",
  "canonAuthority",
  "agentAuthority",
  "installedSkills",
  "filesystemPath",
  "runtimeAuthority",
]);

export const DEMO_RUNTIME_CONTRACT_VERSION = "plotpickle.demo-runtime.v1";
export const DEMO_AUTHORITY_CLASS = "synthetic-demo-runtime";
export const DEMO_STORAGE_SCOPE = "demo-owned-disposable";

export const DEMO_ALLOWED_CAPABILITIES = Object.freeze([
  "story.synthetic.read",
  "story.synthetic.propose",
  "story.synthetic.resolve",
  "story.synthetic.reset",
  "sage.explain.read",
]);

export const DEMO_FORBIDDEN_CAPABILITIES = Object.freeze([
  "profile.read",
  "profile.write",
  "project.private.read",
  "project.private.write",
  "wyrmwood.private.read",
  "wyrmwood.private.write",
  "buzz.private.read",
  "buzz.private.write",
  "provider.credentials.read",
  "provider.credentials.write",
  "connector.github",
  "connector.google",
  "filesystem.host",
  "ppf.canon.read-private",
  "ppf.canon.write",
  "agent.install-skill",
  "agent.grant-authority",
]);

export function createDemoBoundary({ demoId, seed }) {
  if (typeof demoId !== "string" || demoId.trim().length === 0) throw new TypeError("demoId is required");
  if (typeof seed !== "string" || seed.trim().length === 0) throw new TypeError("seed is required");
  return Object.freeze({
    contractVersion: DEMO_RUNTIME_CONTRACT_VERSION,
    authorityClass: DEMO_AUTHORITY_CLASS,
    storageScope: DEMO_STORAGE_SCOPE,
    demoId: demoId.trim(),
    seed: seed.trim(),
    disposable: true,
    authenticatedHuman: false,
    humanProfileId: "",
    allowedCapabilities: DEMO_ALLOWED_CAPABILITIES,
  });
}

export function assertDemoCapability(capability) {
  if (!DEMO_ALLOWED_CAPABILITIES.includes(capability)) {
    const error = new Error(`DEMO capability denied: ${String(capability)}`);
    error.code = "DEMO_CAPABILITY_DENIED";
    throw error;
  }
  return capability;
}

export function createDemoReset({ boundary, initialState }) {
  if (boundary?.authorityClass !== DEMO_AUTHORITY_CLASS || boundary?.disposable !== true) {
    throw new TypeError("A valid disposable DEMO boundary is required");
  }
  return Object.freeze({
    demoId: boundary.demoId,
    seed: boundary.seed,
    resetTo: structuredClone(initialState),
    deleteBeforeReset: true,
    preserveHumanPrivateState: true,
    preserveGuestState: true,
  });
}

function assertPortableStarterContent(value, trail = "starterContent") {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPortableStarterContent(entry, `${trail}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenAuthorityKeys.has(key)) {
      const error = new Error(`DEMO handoff cannot contain privileged field ${trail}.${key}`);
      error.code = "DEMO_HANDOFF_PRIVILEGED_FIELD";
      throw error;
    }
    assertPortableStarterContent(nested, `${trail}.${key}`);
  }
}

export function createApprovedDemoHandoff({ approved, sourceDemoId, starterContent }) {
  if (approved !== true) {
    const error = new Error("DEMO handoff requires explicit Human approval");
    error.code = "DEMO_HANDOFF_APPROVAL_REQUIRED";
    throw error;
  }
  if (typeof sourceDemoId !== "string" || sourceDemoId.trim().length === 0) throw new TypeError("sourceDemoId is required");
  assertPortableStarterContent(starterContent);
  return Object.freeze({
    contractVersion: "plotpickle.demo-handoff.v1",
    sourceDemoId: sourceDemoId.trim(),
    approved: true,
    destination: "fresh-human-project",
    starterContent: structuredClone(starterContent ?? {}),
  });
}
