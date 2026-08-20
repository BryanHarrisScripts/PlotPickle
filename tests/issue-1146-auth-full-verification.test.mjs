import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createInMemoryAuthStateStore,
  createPlotPickleAuthService,
} from "../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

const root = process.cwd();
const passwordA = "Bryan auth matrix private passphrase";
const passwordB = "Jane auth matrix separate passphrase";
const storyCanaryA = "PP_1146_BRYAN_PRIVATE_STORY_CANARY";
const storyCanaryB = "PP_1146_JANE_PRIVATE_STORY_CANARY";
const credentialCanaryA = "PP_1146_BRYAN_PROVIDER_SECRET_CANARY";
const buzzCanaryA = "PP_1146_BRYAN_BUZZ_PRIVATE_KEY_CANARY";

async function text(file) {
  return readFile(path.join(root, file), "utf8");
}

async function twoHumanFixture(context) {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-1146-"));
  context.after(() => rm(home, { recursive: true, force: true }));
  const stateStore = createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService({ nodeId: "node-1146-matrix", accessMode: "desktop-loopback", stateStore });
  context.after(() => auth.close());
  const bryan = await auth.createFirstProfile({ displayName: "Bryan", password: passwordA, avatarRef: null });
  const jane = await auth.createProfile({ displayName: "Jane", password: passwordB, avatarRef: null }, bryan.authContext);
  const storage = createProfilePrivateStorageService({ root: home, authService: auth });
  context.after(() => storage.close());
  await storage.saveProject(bryan.authContext, { project: { id: "bryan-private-project", title: storyCanaryA } });
  await storage.saveProject(jane.authContext, { project: { id: "jane-private-project", title: storyCanaryB } });
  await storage.writePrivateJson(bryan.authContext, { domain: "memory", objectId: "private-memory", value: { note: storyCanaryA } });
  await storage.writeCredential(bryan.authContext, "provider.json", { apiKey: credentialCanaryA });
  await storage.writePrivateJson(bryan.authContext, { domain: "buzz", objectId: "human-identity", value: { privateKey: buzzCanaryA } });
  return { home, stateStore, auth, storage, bryan, jane };
}

test("#1146 cross-profile adversarial matrix keeps projects, memory, credentials, BUZZ identity and PMK capabilities isolated", async (context) => {
  const { auth, storage, bryan, jane } = await twoHumanFixture(context);
  assert.equal(await storage.loadProject(jane.authContext, "bryan-private-project"), null);
  assert.equal(await storage.readPrivateJson(jane.authContext, { domain: "memory", objectId: "private-memory" }), null);
  assert.equal(await storage.readCredential(jane.authContext, "provider.json"), null);
  assert.equal(await storage.readPrivateJson(jane.authContext, { domain: "buzz", objectId: "human-identity" }), null);

  const bryanVault = auth.createProfileVaultCapability(bryan.authContext);
  const janeVault = auth.createProfileVaultCapability(jane.authContext);
  const envelope = await bryanVault.wrapSecret({ secretId: "issue-1146-cross-profile", secret: storyCanaryA });
  await assert.rejects(
    janeVault.unwrapSecret({ envelope, secretId: "issue-1146-cross-profile" }),
    (error) => new Set(["AUTHENTICATION_FAILED", "INVALID_ENVELOPE"]).has(error?.code),
  );

  const forged = { ...bryan.authContext, profileId: jane.profile.profileId };
  assert.throws(() => auth.createProfileVaultCapability(forged), (error) => error?.code === "SESSION_REJECTED");
  assert.equal((await storage.loadProject(bryan.authContext, "bryan-private-project")).title, storyCanaryA);
  assert.equal((await storage.loadProject(jane.authContext, "jane-private-project")).title, storyCanaryB);
});

test("#1146 fresh desktop and server profile creation remain self-contained and the server UI accepts only the one-time bootstrap proof", async () => {
  const ui = await text("app/profile-access/profile-access-boundary.tsx");
  const route = await text("app/api/auth/profile/route.ts");
  assert.match(ui, /Create your local profile/u);
  assert.match(ui, /Server bootstrap proof/u);
  assert.match(ui, /bootstrapProof/u);
  assert.match(ui, /next\.configured \? "login" : "create"/u);
  assert.match(route, /create-first-profile[\s\S]*bootstrapProof/u);
  assert.doesNotMatch(ui, /type="email"|Sign up with|Continue with Google/u);
});

test("#1146 browser persistence and locked metadata audits keep authentication secrets out of durable browser storage", async () => {
  const ui = await text("app/profile-access/profile-access-boundary.tsx");
  const browserStorage = await text("core/storage/profile-private-browser.ts");
  const route = await text("app/api/auth/profile/route.ts");
  const combined = `${ui}\n${browserStorage}`;
  assert.doesNotMatch(combined, /localStorage\.setItem\([^\n]*(?:password|passphrase|recovery|csrf|session|privateKey|apiKey)/iu);
  assert.doesNotMatch(combined, /sessionStorage\.setItem\([^\n]*(?:password|passphrase|recovery|csrf|privateKey|apiKey)/iu);
  assert.match(ui, /The chooser shows only a safe name and optional avatar/iu);
  assert.doesNotMatch(route, /authContext\s*:/u);
});

test("#1146 credential registry is already v2+, separates Human and Node ownership and carries revocation/export policy", async () => {
  const registry = JSON.parse(await text("config/credential-boundary.registry.json"));
  assert.ok(registry.schema_version >= 2);
  assert.equal(registry.storage_roots.human_profile, "PLOTPICKLE_HOME/profiles/<profile_uuid>/credentials");
  assert.equal(registry.storage_roots.node, "PLOTPICKLE_HOME/node/secrets");
  assert.equal(registry.encryption_contract.human_profile, "pmk-profile-secret-envelope-v1");
  assert.equal(registry.encryption_contract.plaintext_fallback_allowed, false);
  assert.ok(registry.credentials.some((item) => item.owner_scope === "human-profile"));
  assert.ok(registry.credentials.some((item) => item.owner_scope === "node"));
  for (const item of registry.credentials) {
    assert.ok(item.export_boundary?.length > 20);
    assert.ok(item.remove_or_revoke?.length > 20);
    assert.ok(item.migration_state?.length > 5);
  }
});

test("#1146 one discoverable Auth command and one dedicated CI gate own the completed #1138-#1146 suite", async () => {
  const packageJson = JSON.parse(await text("package.json"));
  const command = packageJson.scripts["test:plotpickle-auth"];
  assert.equal(typeof command, "string");
  for (const issue of ["1138", "1139", "1140", "1141", "1142", "1143", "1144", "1145", "1146"]) {
    assert.match(command, new RegExp(`issue-${issue}`, "u"));
  }
  assert.match(command, /issue-299-credential-boundary-audit/u);
  const workflow = await text(".github/workflows/plotpickle-auth.yml");
  assert.match(workflow, /npm run test:plotpickle-auth/u);
  assert.match(workflow, /npm run audit:credentials/u);
  assert.match(workflow, /npm run build/u);
  for (const platform of ["package:windows", "package:macos", "package:linux"]) assert.ok(workflow.includes(platform));
});

test("#1146 Full Verification consumes Auth as a prerequisite without creating a tenth authoritative PASS system", async () => {
  const graph = await text("scripts/full-verification-graph.mjs");
  assert.match(graph, /id: "plotpickle-auth-security"[\s\S]*authoritative: false[\s\S]*args: \["run", "test:plotpickle-auth"\]/u);
  assert.match(graph, /id: "production-build"[\s\S]*dependencies: \[\{ id: "plotpickle-auth-security", require: "success"/u);
  assert.match(graph, /authoritative\.length !== 9/u);
});

test("#1146 crypto and dependency choices stay pinned and do not introduce passkey or PAKE as a mandatory recovery dependency", async () => {
  const packageJson = JSON.parse(await text("package.json"));
  assert.equal(packageJson.dependencies["libsodium-wrappers-sumo"], "0.8.4");
  assert.equal(packageJson.engines.node, ">=22.13.0");
  const dependencyNames = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).join("\n");
  assert.doesNotMatch(dependencyNames, /webauthn|opaque|pake/iu);
  const backupDoc = await text("docs/architecture/PLOTPICKLE-PROFILE-BACKUP.md");
  assert.match(backupDoc, /Passkeys remain optional/u);
  assert.match(backupDoc, /OPAQUE\/PAKE remains deferred/u);
});

test("#1146 release checklist records manual checks that deterministic automation cannot prove", async () => {
  const checklist = await text("docs/architecture/PLOTPICKLE-AUTH-RELEASE-CHECKLIST.md");
  for (const phrase of [
    "Fresh desktop profile creation",
    "Two simultaneous Human sessions",
    "wrong password and wrong recovery",
    "restore on another fresh Node",
    "provider tokens, BUZZ private keys and recovery material",
    "Server-network HTTPS",
    "Release archive",
  ]) assert.match(checklist, new RegExp(phrase, "iu"));
});
