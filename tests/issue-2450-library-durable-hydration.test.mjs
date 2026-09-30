import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import { createServerSessionBoundary } from "../core/auth/server-session/server-session-boundary-core.mjs";
import { createEmptyProject } from "../core/project/project.ts";
import { WORLD_MAP_CHARACTER_VIEWS } from "../core/contracts/world-map/index.ts";
import {
  FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
  FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
} from "../core/contracts/build-progress.ts";
import { normalizeLibraryProject } from "../core/storage/library-project.ts";
import {
  hydrateProfileProjectLibrary,
  initializeProfileProjectLibrary,
  listProfileProjectSummaries,
} from "../core/storage/project-library-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

const NOW = "2026-09-25T17:50:00.000Z";
const PASSWORD = "Afterglow durable persistence passphrase";

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

function richAfterglowProject() {
  const base = createEmptyProject({ id: "afterglow-working-copy", now: NOW, title: "Afterglow" });
  const references = Array.from({ length: 5 }, (_, versionIndex) => {
    const version = versionIndex + 1;
    const createdAt = `2026-09-25T17:${String(45 + version).padStart(2, "0")}:00.000Z`;
    return WORLD_MAP_CHARACTER_VIEWS.map((view, viewIndex) => ({
      id: `wren-v${version}-${view.id}`,
      versionId: `wren-version-${version}`,
      characterId: "wren",
      characterName: "Wren",
      view: view.id,
      assetUrl: `/api/local-ai/assets/afterglow/wren-v${version}-${viewIndex + 1}.webp`,
      prompt: `Wren saved character version ${version} · ${view.label}`,
      provider: "local-comfyui",
      model: "qwen-image",
      createdAt,
      reviewState: version === 5 ? "approved" : "draft",
    }));
  }).flat();
  const posterArtifacts = Array.from({ length: 5 }, (_, index) => {
    const version = index + 1;
    return {
      id: `afterglow-poster-version-${version}`,
      assetUrl: `/api/local-ai/assets/afterglow/worldmap-poster-afterglow-working-copy-v${version}.webp`,
      prompt: `Afterglow poster saved version ${version}`,
      createdAt: `2026-09-25T17:${String(45 + version).padStart(2, "0")}:30.000Z`,
      provider: "local-comfyui",
      model: "qwen-image",
      narrativeIntention: "PPF Marketing Reference · WorldMap poster",
      curriculumFrontier: FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
      sourceDecisionKeys: ["surface:worldmap"],
      workflow: FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
      reviewState: version === 5 ? "accepted" : "draft",
      parentArtifactId: null,
    };
  });
  return normalizeLibraryProject({
    ...base,
    revision: 12,
    build: {
      ...base.build,
      foundations: {
        visualArtifacts: [...posterArtifacts].reverse(),
        acceptedVisualArtifactIds: ["afterglow-poster-version-5"],
      },
    },
    discovery: {
      version: 1,
      cards: [
        {
          id: "mindmap-inbox-act-1",
          kind: "text",
          content: "Wren enters Act 1 carrying the unresolved signal.",
          assetRef: "",
          sourceState: "new-local",
          sourceRef: null,
          createdAt: NOW,
          inboxAct: 1,
          placement: null,
        },
        {
          id: "mindmap-agent-plot-act-1",
          kind: "text",
          content: "The Act 1 plot pressure escalates around Wren's choice.",
          assetRef: "",
          sourceState: "agent-proposal",
          sourceRef: "agent:creative-director:mind-map:act-1:plot",
          createdAt: NOW,
          inboxAct: 1,
          placement: {
            act: 1,
            lane: "plot",
            reason: "Creative Director proposal for Act 1 Plot.",
            evidenceRefs: [],
            classifierId: "creative-director",
            classifierVersion: "mind-map-v1",
            pinnedAt: NOW,
          },
        },
      ],
    },
    writing: {
      version: 1,
      entries: [{ id: "write:block-01:mini-1", blockNumber: 1, miniBlockNumber: 1, text: "Afterglow opening passage.", updatedAt: NOW }],
    },
    worldMap: {
      version: 1,
      characterVisuals: [{
        characterId: "wren",
        characterName: "Wren",
        references,
        lockedVersionId: "wren-version-5",
        approvedAt: NOW,
        updatedAt: NOW,
      }],
    },
  });
}

function emptyLibraryProject({ id, now, title }) {
  return normalizeLibraryProject(createEmptyProject({ id, now, title }));
}

function describeProject(project) {
  return { progress: project.discovery.cards.length ? 60 : 0, frontier: "MindMap + WorldMap", thumbnail: "" };
}

function browserHarness(storage, profileId) {
  return {
    storage,
    profileId,
    normalizeProject: normalizeLibraryProject,
    createProject: emptyLibraryProject,
    describeProject,
    now: () => NOW,
    idFactory: () => "generated-empty-project",
  };
}

function request() {
  return {
    method: "POST",
    url: "http://127.0.0.1:4173/api/auth/profile",
    remoteAddress: "127.0.0.1",
    headers: { host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173" },
  };
}

test("#2450 complete MindMap + Wren WorldMap state survives browser Library hydration with the same working-copy id", () => {
  const storage = new MemoryStorage();
  const project = richAfterglowProject();
  const input = browserHarness(storage, "profile-bryan");

  const hydrated = hydrateProfileProjectLibrary({
    ...input,
    activeProjectId: project.id,
    projects: [{
      project,
      summary: {
        sourceKind: "example",
        sourceId: "afterglow-v9",
        genre: "Science Fiction",
        format: "Screenplay",
      },
    }],
  });

  assert.equal(hydrated.activeProject.id, "afterglow-working-copy");
  assert.deepEqual(hydrated.activeProject.discovery.cards.map((card) => [card.id, card.inboxAct, card.placement?.lane ?? null]), [
    ["mindmap-inbox-act-1", 1, null],
    ["mindmap-agent-plot-act-1", 1, "plot"],
  ]);
  const wren = hydrated.activeProject.worldMap.characterVisuals.find((item) => item.characterId === "wren");
  assert.ok(wren);
  assert.equal(wren.references.length, 40);
  assert.equal(wren.references.filter((reference) => reference.reviewState === "approved").length, 8);
  assert.equal(wren.lockedVersionId, "wren-version-5");
  assert.equal(wren.approvedAt, NOW);
  assert.equal(wren.references.every((reference) => reference.assetUrl.startsWith("/api/local-ai/assets/")), true);
  assert.equal(hydrated.activeProject.build.foundations.visualArtifacts.filter((artifact) => artifact.workflow === FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW).length, 5);
  assert.equal(hydrated.activeProject.build.foundations.acceptedVisualArtifactIds.includes("afterglow-poster-version-5"), true);

  const summaries = listProfileProjectSummaries(input);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].id, "afterglow-working-copy");
  assert.equal(summaries[0].sourceKind, "example");
  assert.equal(summaries[0].sourceId, "afterglow-v9");

  const restarted = initializeProfileProjectLibrary(input);
  assert.equal(restarted.activeProject.id, project.id);
  assert.equal(restarted.activeProject.discovery.cards.length, 2);
  assert.equal(restarted.activeProject.worldMap.characterVisuals[0].references.length, 40);
  assert.equal(restarted.activeProject.worldMap.characterVisuals[0].lockedVersionId, "wren-version-5");
  assert.equal(restarted.activeProject.build.foundations.visualArtifacts.filter((artifact) => artifact.workflow === FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW).length, 5);
});

test("#2450 encrypted profile storage restores active full LibraryPPFProject in a new authenticated session", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2450-"));
  const auth = await createPlotPickleAuthService({
    nodeId: "node-2450-persistence",
    accessMode: "desktop-loopback",
    stateStore: createInMemoryAuthStateStore(),
  });
  const storage = createProfilePrivateStorageService({
    root,
    authService: auth,
    normalizeProject: normalizeLibraryProject,
    now: () => NOW,
  });
  context.after(async () => {
    storage.close();
    auth.close();
    await rm(root, { recursive: true, force: true });
  });

  const created = await auth.createFirstProfile({ displayName: "Bryan", password: PASSWORD, avatarRef: null });
  const project = richAfterglowProject();
  await storage.saveProject(created.authContext, {
    project,
    summary: {
      sourceKind: "example",
      sourceId: "afterglow-v9",
      genre: "Science Fiction",
      format: "Screenplay",
      progress: 60,
      frontier: "MindMap + WorldMap",
    },
  });
  await storage.saveProject(created.authContext, {
    project: normalizeLibraryProject(createEmptyProject({ id: "second-working-story", now: NOW, title: "Second Story" })),
    summary: { sourceKind: "user", format: "Feature" },
    activate: false,
  });

  assert.equal(auth.lock(created.authContext), true);
  const boundary = createServerSessionBoundary({
    authService: auth,
    exposure: { accessMode: "desktop-loopback", allowedOrigins: ["http://127.0.0.1:4173"], allowedHosts: ["127.0.0.1:4173"] },
  });
  const reopened = await boundary.loginWithPassword({ profileId: created.profile.profileId, password: PASSWORD }, request());
  const restored = await storage.loadActiveProject(reopened.authContext);

  assert.equal(restored.id, "afterglow-working-copy");
  assert.equal(restored.discovery.cards.find((card) => card.sourceState === "agent-proposal")?.placement?.lane, "plot");
  const wren = restored.worldMap.characterVisuals.find((item) => item.characterId === "wren");
  assert.equal(wren.references.length, 40);
  assert.equal(wren.references.filter((reference) => reference.reviewState === "approved").length, 8);
  assert.equal(wren.lockedVersionId, "wren-version-5");
  assert.equal(wren.approvedAt, NOW);
  assert.equal(restored.build.foundations.visualArtifacts.filter((artifact) => artifact.workflow === FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW).length, 5);
  assert.equal(restored.build.foundations.acceptedVisualArtifactIds.includes("afterglow-poster-version-5"), true);

  const summaries = await storage.listProjects(reopened.authContext);
  assert.equal(summaries.length, 2);
  const afterglow = summaries.find((item) => item.projectId === project.id);
  assert.equal(afterglow.sourceKind, "example");
  assert.equal(afterglow.sourceId, "afterglow-v9");
  assert.equal(afterglow.format, "Screenplay");
});

test("#2450 browser/profile boundaries use complete hydration and live MindMap/WorldMap refresh", async () => {
  const read = async (file) => (await import("node:fs/promises")).readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const [route, profileBrowser, libraryBrowser, host, workspace] = await Promise.all([
    read("app/api/auth/profile-private/route.ts"),
    read("core/storage/profile-private-browser.ts"),
    read("core/storage/project-library-browser.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);

  assert.match(route, /activeProjectId/u);
  assert.match(route, /privateStorage\.listProjects/u);
  assert.match(route, /privateStorage\.loadProject/u);
  assert.match(route, /projects\.filter/u);
  assert.match(profileBrowser, /hydrateProfileProjectLibrary\(\{ activeProjectId, projects \}\)/u);
  assert.match(profileBrowser, /normalizeLibraryProject/u);
  assert.match(profileBrowser, /\[\.\.\.listLibraryProjects\(\), \.\.\.listArchivedLibraryProjects\(\)\]/u);
  assert.match(libraryBrowser, /normalizeDiscoveryState/u);
  assert.match(libraryBrowser, /normalizeProjectSourceEvidence/u);
  assert.match(libraryBrowser, /projectWithStructure = \{ \.\.\.project, structure, sourceEvidence, writing, discovery, worldMap \}/u);

  assert.match(host, /PROJECT_LIBRARY_CHANGED_EVENT, refreshStoryBible/u);
  assert.match(host, /setStoryBibleProject\(loadWorkspaceLibraryProject\(\)\)/u);
  assert.match(host, /PROJECT_LIBRARY_CHANGED_EVENT, refreshDiscovery/u);
  assert.match(host, /setDiscoveryProject\(loadWorkspaceLibraryProject\(\)\)/u);

  assert.match(workspace, /Afterglow example · start fresh copy/u);
  assert.match(workspace, /open the saved Afterglow story listed below/u);
  assert.match(workspace, /Resume Saved Story/u);
  assert.match(workspace, /Open Saved Story/u);
  assert.match(workspace, /Start Fresh Afterglow Copy/u);
});

test("#2493 five saved WorldMap media versions remain bounded after normalization", () => {
  const project = richAfterglowProject();
  const wren = project.worldMap.characterVisuals.find((item) => item.characterId === "wren");
  assert.equal(new Set(wren.references.map((reference) => reference.versionId)).size, 5);
  assert.equal(project.build.foundations.visualArtifacts.filter((artifact) => artifact.workflow === FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW).length, 5);
  assert.equal(wren.lockedVersionId, "wren-version-5");
});
