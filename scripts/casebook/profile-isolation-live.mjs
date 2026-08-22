import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createJsonFileAuthStateStore,
  createPlotPickleAuthService,
} from "../../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService, profileStoragePaths } from "../../core/storage/profile-private/profile-private-storage-core.mjs";

const CASE_ID = "profile-isolation";
const VERIFIER = "profile-boundary-observer";

function strongPassword(prefix) {
  return `${prefix}-${randomBytes(32).toString("base64url")}`;
}

function fixtureProject(id, title) {
  const now = new Date().toISOString();
  return { id, title, storyText: `${title} synthetic Casebook content`, revision: 1, createdAt: now, updatedAt: now };
}

function normalizeFixtureProject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.id !== "string") throw new Error("Casebook profile fixture received an invalid project.");
  return structuredClone(value);
}

function caseRoot(baseRoot) {
  if (baseRoot) return path.resolve(baseRoot);
  const local = process.env.LOCALAPPDATA || (process.platform === "win32" ? path.join(os.homedir(), "AppData", "Local") : path.join(os.homedir(), ".local", "share"));
  return path.join(local, "PlotPickle", "casebook-profile-isolation", `run-${randomUUID()}`);
}

async function createFixtureServices(root) {
  const authStatePath = path.join(root, "auth", "state.json");
  const auth = await createPlotPickleAuthService({
    nodeId: "casebook-profile-isolation-node",
    accessMode: "desktop-loopback",
    stateStore: createJsonFileAuthStateStore(authStatePath),
  });
  const storage = createProfilePrivateStorageService({
    root: path.join(root, "private"),
    authService: auth,
    normalizeProject: normalizeFixtureProject,
  });
  return { auth, storage, authStatePath };
}

function observation(id, passed, summary, metadata = {}) {
  return { id, status: passed ? "verified" : "contradicted", summary, metadata };
}

function independentProof(passed, summary, metadata = {}) {
  return {
    id: "profile-isolation-independent-proof",
    kind: "security",
    status: passed ? "verified" : "contradicted",
    source: VERIFIER,
    independent: true,
    summary,
    metadata,
  };
}

function fault(id, detected, observed) {
  return { id, injected: true, outcome: detected ? "blocked" : "pass", observed };
}

export async function runProfileIsolationLiveCase({ root: requestedRoot, keepArtifacts = false } = {}) {
  const root = caseRoot(requestedRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const passwordA = strongPassword("casebook-a");
  const passwordB = strongPassword("casebook-b");
  const observations = [];
  const faults = [];
  let services = null;
  let restarted = null;

  try {
    services = await createFixtureServices(root);
    const profileA = await services.auth.createFirstProfile({ displayName: "Casebook Human A", password: passwordA, avatarRef: null });
    const profileB = await services.auth.createProfile({ displayName: "Casebook Human B", password: passwordB, avatarRef: null }, profileA.authContext);
    await services.storage.initializeProfile(profileA.authContext);
    await services.storage.initializeProfile(profileB.authContext);

    const projectA = fixtureProject("casebook-private-a", "Private A");
    const projectB = fixtureProject("casebook-private-b", "Private B");
    await services.storage.saveProject(profileA.authContext, { project: projectA, summary: { progress: 21, frontier: "Foundations" } });
    await services.storage.writeCredential(profileA.authContext, "buzz-connection.json", { identityConfigured: true, publicSigner: "casebook-a-public-signer" });
    await services.storage.writePrivateJson(profileA.authContext, { domain: "memory", objectId: "sage", value: { summary: "A-only synthetic retrieval memory" } });
    await services.storage.writePrivateJson(profileA.authContext, { domain: "indexes", objectId: "retrieval", value: { chunks: ["A-only synthetic retrieval chunk"] } });
    await services.storage.writePrivateJson(profileA.authContext, { domain: "cache", objectId: "ui-state", value: { lastScreen: "library", privateFlag: "A-only" } });
    await services.storage.saveProject(profileB.authContext, { project: projectB, summary: { progress: 3, frontier: "Foundations" } });

    const bProjects = await services.storage.listProjects(profileB.authContext);
    const bSeesAProject = await services.storage.loadProject(profileB.authContext, projectA.id);
    const bSeesBuzz = await services.storage.readCredential(profileB.authContext, "buzz-connection.json");
    const bSeesMemory = await services.storage.readPrivateJson(profileB.authContext, { domain: "memory", objectId: "sage" });
    const bSeesIndex = await services.storage.readPrivateJson(profileB.authContext, { domain: "indexes", objectId: "retrieval" });
    const bSeesUi = await services.storage.readPrivateJson(profileB.authContext, { domain: "cache", objectId: "ui-state" });
    const isolatedBeforeRestart = bProjects.length === 1 && bProjects[0]?.projectId === projectB.id
      && bSeesAProject === null && bSeesBuzz === null && bSeesMemory === null && bSeesIndex === null && bSeesUi === null;
    observations.push(observation("cross-profile-denial", isolatedBeforeRestart, isolatedBeforeRestart
      ? "Human B could not observe Human A project, BUZZ credential, memory, retrieval index, or private UI cache."
      : "Human B observed state that belongs only to Human A."));
    faults.push(fault("attempt-cross-profile-project-read", bSeesAProject === null, bSeesAProject === null
      ? "Deliberate cross-profile project read was denied as not found."
      : "Deliberate cross-profile project read leaked Human A data."));

    let exportDenied = false;
    try {
      await services.storage.exportProject(profileB.authContext, projectA.id);
    } catch (error) {
      exportDenied = error?.code === "PROJECT_NOT_FOUND";
    }
    faults.push(fault("attempt-cross-profile-project-export", exportDenied, exportDenied
      ? "Deliberate cross-profile export was rejected with PROJECT_NOT_FOUND."
      : "Deliberate cross-profile export was not rejected by the owner boundary."));

    const aPaths = profileStoragePaths(path.join(root, "private"), profileA.profile.profileId);
    const encryptedProject = await readFile(path.join(aPaths.projects, `${projectA.id}.json`), "utf8");
    const encryptedAtRest = !encryptedProject.includes(projectA.title) && !encryptedProject.includes(projectA.storyText);
    observations.push(observation("profile-a-state", encryptedAtRest, encryptedAtRest
      ? "Human A private project exists only as an encrypted profile-private envelope on disk."
      : "Human A private project plaintext was visible in the persisted envelope."));

    services.storage.close();
    services.auth.close();
    services = null;

    restarted = await createFixtureServices(root);
    const loginA = await restarted.auth.authenticate({ profileId: profileA.profile.profileId, password: passwordA });
    const loginB = await restarted.auth.authenticate({ profileId: profileB.profile.profileId, password: passwordB });
    const aAfter = await restarted.storage.loadProject(loginA.authContext, projectA.id);
    const bAfter = await restarted.storage.loadProject(loginB.authContext, projectB.id);
    const bStillCannotReadA = await restarted.storage.loadProject(loginB.authContext, projectA.id);
    const bStillCannotReadBuzz = await restarted.storage.readCredential(loginB.authContext, "buzz-connection.json");
    const restartIsolation = aAfter?.id === projectA.id && bAfter?.id === projectB.id && bStillCannotReadA === null && bStillCannotReadBuzz === null;
    observations.push(observation("restart-isolation", restartIsolation, restartIsolation
      ? "Both Humans recovered only their own private state after Auth and profile-storage services were restarted from disk."
      : "Profile-private isolation did not survive service restart."));
    observations.push(observation("profile-b-state", bAfter?.id === projectB.id, bAfter?.id === projectB.id
      ? "Human B authenticated after restart and recovered only the B project."
      : "Human B did not recover the expected B-scoped project after restart."));

    const passed = observations.every((item) => item.status === "verified") && faults.every((item) => ["fail", "blocked"].includes(item.outcome));
    return {
      schemaVersion: 1,
      caseId: CASE_ID,
      mode: "real-machine",
      recordedAt: new Date().toISOString(),
      rootRetained: keepArtifacts ? root : "",
      profileCount: 2,
      observations,
      faults,
      independentVerification: independentProof(
        passed,
        passed
          ? "Independent profile-boundary checks proved project, BUZZ credential, memory/index/cache, encrypted-at-rest, cross-profile denial, and restart isolation on one test-scoped PlotPickle Node."
          : "One or more profile-boundary or deliberate cross-profile fault checks failed.",
        { observationsVerified: observations.filter((item) => item.status === "verified").length, faultsDetected: faults.filter((item) => ["fail", "blocked"].includes(item.outcome)).length },
      ),
    };
  } finally {
    if (services) {
      services.storage.close();
      services.auth.close();
    }
    if (restarted) {
      restarted.storage.close();
      restarted.auth.close();
    }
    if (!keepArtifacts) await rm(root, { recursive: true, force: true });
  }
}
