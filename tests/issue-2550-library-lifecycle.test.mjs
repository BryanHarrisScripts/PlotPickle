import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  archiveProfileProject, createProfileUserProject, deleteArchivedProfileProject,
  initializeProfileProjectLibrary, listProfileArchivedProjectSummaries, listProfileProjectSummaries,
} from "../core/storage/project-library-core.mjs";

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

test("#2545 delete one/all touches only archived snapshots and preserves the active story", () => {
  let serial = 0;
  const storage = new MemoryStorage();
  const input = {
    storage, profileId: "profile-library-2550", now: () => "2026-09-28T17:00:00.000Z",
    idFactory: () => `story-${++serial}`,
    createProject: ({ id, now, title }) => ({ id, title, createdAt: now, updatedAt: now }),
    normalizeProject: (project) => structuredClone(project),
    describeProject: () => ({ progress: 0, frontier: "Foundations", thumbnail: "" }),
  };
  const first = initializeProfileProjectLibrary(input).activeProject;
  const second = createProfileUserProject({ ...input, title: "Second" }).activeProject;
  const active = createProfileUserProject({ ...input, title: "Active" }).activeProject;
  assert.throws(() => deleteArchivedProfileProject({ ...input, projectId: active.id }), /Only an archived story/);
  for (const project of [first, second]) archiveProfileProject({ ...input, projectId: project.id });
  deleteArchivedProfileProject({ ...input, projectId: first.id });
  assert.deepEqual(listProfileArchivedProjectSummaries(input).map((item) => item.id), [second.id]);
  for (const item of listProfileArchivedProjectSummaries(input)) deleteArchivedProfileProject({ ...input, projectId: item.id });
  assert.equal(listProfileArchivedProjectSummaries(input).length, 0);
  assert.deepEqual(listProfileProjectSummaries(input).map((item) => item.id), [active.id]);
  assert.equal(initializeProfileProjectLibrary(input).activeProject.id, active.id);
  for (const project of [first, second]) assert.equal(storage.getItem(`plotpickle.library.profile.v1.${input.profileId}.projects.${project.id}`), null);
});

test("#2547/#2548 Example and LOAD semantics stay separate", async () => {
  const [catalog, workspace, css] = await Promise.all([
    readFile(new URL("../modules/library/project-library-catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../modules/library/ui/library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../modules/library/ui/library-workspace.module.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(catalog, /clockmakers-map/i);
  assert.match(workspace, /AFTERGLOW_EXAMPLE_FALLBACK_POSTER/u);
  assert.match(css, /\.exampleCard \{[\s\S]*display: grid;[\s\S]*grid-template-columns:/u);
  assert.doesNotMatch(workspace, /Start Fresh Afterglow Copy/);
  assert.match(workspace, /Cancel saved story resume/);
  assert.match(workspace, /if \(!choice\)/);
  assert.match(workspace, /const savedStories = listHumanLibraryProjects\(\)/u);
  assert.match(workspace, /const archivedStories = listHumanArchivedLibraryProjects\(\)/u);
});

test("#2555/#2559/#2560 Afterglow stays packaged while local learning state remains hidden", async () => {
  const [identity, catalog, workspace, css, browser, archive] = await Promise.all([
    readFile(new URL("../data/afterglow-reference-identity.ts", import.meta.url), "utf8"),
    readFile(new URL("../modules/library/project-library-catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../modules/library/ui/library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../modules/library/ui/library-workspace.module.css", import.meta.url), "utf8"),
    readFile(new URL("../core/storage/project-library-browser.ts", import.meta.url), "utf8"),
    readFile(new URL("../modules/library/ui/archive-stories-panel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(identity, /AFTERGLOW_V9_REFERENCE_LOGLINE/u);
  assert.match(catalog, /logline: AFTERGLOW_V9_REFERENCE_LOGLINE/u);
  assert.match(workspace, /Your work never replaces the provided example/u);
  assert.match(workspace, />Open Example<\/button>/u);
  assert.match(workspace, />Open Afterglow<\/h2>/u);
  assert.match(workspace, /sourceId: AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID/u);
  assert.match(workspace, /const openedProject = choice\.project/u);
  assert.match(workspace, /if \(generatedPosters\.length\) return generatedPosters/u);
  assert.match(workspace, /packagedAfterglowManifest\.featuredPosterUrls/u);
  assert.match(workspace, /return packagedPosters\.length \? packagedPosters : \[AFTERGLOW_EXAMPLE_FALLBACK_POSTER\]/u);
  assert.match(workspace, /Previous Afterglow poster/u);
  assert.match(workspace, /Next Afterglow poster/u);
  assert.match(css, /aspect-ratio: 2 \/ 3/u);
  assert.match(css, /\.examplePoster img \{[\s\S]*object-fit: contain/u);
  assert.match(browser, /listHumanLibraryProjects\(\)[\s\S]*item\.sourceKind !== "example"/u);
  assert.match(browser, /listHumanArchivedLibraryProjects\(\)[\s\S]*item\.sourceKind !== "example"/u);
  assert.match(browser, /AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID/u);
  assert.match(browser, /priorSummary\?\.sourceId === AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID && project\.revision === 0/u);
  assert.match(archive, /listHumanArchivedLibraryProjects\(\)/u);
});

test("#2546 Avery opens a synthetic-provenance story and confirms selected deletion", async () => {
  const [ui, gateway] = await Promise.all([
    readFile(new URL("../modules/library/ui/avery-session-history/index.tsx", import.meta.url), "utf8"),
    readFile(new URL("../build/writer-in-residence-gateway.ts", import.meta.url), "utf8"),
  ]);
  assert.match(ui, /sourceKind: "synthetic", sourceId: session\.id/u);
  assert.match(ui, /Reconstructed from the saved session report; this is not a complete project snapshot/u);
  assert.match(ui, /Open Story<\/button>/u);
  assert.match(ui, /Permanently delete Avery story/u);
  assert.match(ui, /was deleted permanently/u);
  assert.match(ui, /aria-live="polite".*role="status"/u);
  assert.match(ui, /deleteArchivedProfileProjectFromVault\(copy\.id\)/u);
  assert.doesNotMatch(ui, /artifactButton|Open session POSTER|Open session TRAILER/u);
  assert.match(gateway, /request\.method === "DELETE"/u);
  assert.match(gateway, /safeSessionDirectory\(sessionId\)/u);
});

test("#2549/#2835 sign-in preserves browser recovery records without migrating them into the vault", async () => {
  const source = await readFile(new URL("../core/storage/profile-private-browser.ts", import.meta.url), "utf8");
  assert.match(source, /preserveLegacySessionRecords/u);
  assert.match(source, /quarantine.sign-in/u);
  assert.doesNotMatch(source, /migrateLegacyBrowserProjects|legacySessionLibrary/u);
  const hydration = source.slice(source.indexOf("export async function hydrateProfilePrivateBrowser"), source.indexOf("export function profilePrivateBrowserAuthorityMatches"));
  assert.doesNotMatch(hydration, /privateMutation/u);
});

test("#2550 Skin V1 restores private browser authority for an existing authenticated session", async () => {
  const [gateway, privateBrowser] = await Promise.all([
    readFile(new URL("../adapters/experience/browser-profile-auth-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../core/storage/profile-private-browser.ts", import.meta.url), "utf8"),
  ]);
  assert.match(privateBrowser, /let hydratedProfileId = "";/u);
  assert.match(privateBrowser, /export function profilePrivateBrowserAuthorityMatches\(profileId: string, token: string\)/u);
  assert.match(privateBrowser, /hydratedProfileId = profileId;[\s\S]*updateSaveState\("saved", "Saved"\)/u);
  assert.match(privateBrowser, /releaseProfilePrivateBrowserAuthority\(\)[\s\S]*hydratedProfileId = "";/u);
  assert.match(gateway, /async read\(\) \{\s*const status = await readRawProfileStatus\(\);[\s\S]*status\.authenticated && status\.profile[\s\S]*!status\.csrfToken[\s\S]*profilePrivateBrowserAuthorityMatches\(status\.profile\.profileId, status\.csrfToken\)[\s\S]*hydrateProfilePrivateBrowser\(status\.profile\.profileId, status\.csrfToken\)/u);
});
