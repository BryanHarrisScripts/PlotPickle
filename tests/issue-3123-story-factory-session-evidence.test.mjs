import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { observeStoryFactoryProjectSession } from "../core/sidecars/webmcp-acceptance-sidecar.mjs";

const ACTIVE = "plotpickle.human-profile.active.v1";
const SESSION = "plotpickle.project-library.session-project";
const PROFILE = "profile_3123_fixture";
const EXPECTED = "secret-test-story-id-3123";
const KEY = `${SESSION}:${PROFILE}`;
const REGISTRY = `plotpickle.library.profile.v1.${PROFILE}.registry`;

async function observe(entries) {
  const data = new Map(Object.entries(entries));
  let writes = 0;
  const browserStorage = {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem() { writes += 1; throw new Error("Read-only evidence must not mutate storage"); },
    removeItem() { writes += 1; throw new Error("Read-only evidence must not remove active project"); },
    clear() { writes += 1; throw new Error("Read-only evidence must not clear profile"); },
  };
  const prior = globalThis.window;
  globalThis.window = { sessionStorage: browserStorage };
  try {
    const page = { evaluate: async (callback, args) => callback(args) };
    const result = await observeStoryFactoryProjectSession(page, EXPECTED);
    assert.equal(writes, 0);
    const serialized = JSON.stringify(result);
    for (const forbidden of [EXPECTED, PROFILE, "secret-test-story"]) {
      assert.equal(serialized.includes(forbidden), false, "evidence cannot contain raw private identifiers");
    }
    return result;
  } finally {
    if (prior === undefined) delete globalThis.window;
    else globalThis.window = prior;
  }
}

test("#3123 confirms the actual profile-scoped current-session selection without reading private story bytes", async () => {
  const result = await observe({
    [ACTIVE]: PROFILE,
    [KEY]: EXPECTED,
    [REGISTRY]: JSON.stringify({
      activeProjectId: EXPECTED,
      projects: [{ id: EXPECTED, archivedAt: null, title: "should not be logged" }],
    }),
  });
  assert.deepEqual(result, {
    activeProfilePresent: true,
    selectedProjectPresent: true,
    selectedProjectMatchesExpected: true,
    nonemptySessionProjectKeyCount: 1,
    foreignProfileSelectionCount: 0,
    registryPresent: true,
    registryMalformed: false,
    registryActiveMatchesExpected: true,
    registryContainsExpected: true,
  });
});

test("#3123 detects lost session selection even when the verified profile registry retains the expected project", async () => {
  const result = await observe({
    [ACTIVE]: PROFILE,
    [REGISTRY]: JSON.stringify({
      activeProjectId: EXPECTED,
      projects: [{ id: EXPECTED, archivedAt: null }],
    }),
  });
  assert.equal(result.selectedProjectPresent, false);
  assert.equal(result.selectedProjectMatchesExpected, false);
  assert.equal(result.registryContainsExpected, true);
  assert.equal(result.registryActiveMatchesExpected, true);
});

test("#3123 distinguishes a foreign-profile selection from the authenticated profile without adopting it", async () => {
  const result = await observe({
    [ACTIVE]: PROFILE,
    [`${SESSION}:profile_foreign_fixture`]: EXPECTED,
  });
  assert.equal(result.activeProfilePresent, true);
  assert.equal(result.selectedProjectPresent, false);
  assert.equal(result.nonemptySessionProjectKeyCount, 1);
  assert.equal(result.foreignProfileSelectionCount, 1);
  assert.equal(result.selectedProjectMatchesExpected, false);
});

test("#3123 malformed or absent registry never invents active-project continuity", async () => {
  const malformed = await observe({
    [ACTIVE]: PROFILE,
    [REGISTRY]: "{malformed",
  });
  assert.equal(malformed.registryMalformed, true);
  assert.equal(malformed.registryContainsExpected, false);

  const missingProfile = await observe({ [KEY]: EXPECTED });
  assert.equal(missingProfile.activeProfilePresent, false);
  assert.equal(missingProfile.selectedProjectPresent, false);
  assert.equal(missingProfile.nonemptySessionProjectKeyCount, 1);
});

test("#3123 actual browser journey records pre-open, rendered, and dashboard-return state but keeps six original real failures blocking", async () => {
  const source = await readFile(new URL("../core/sidecars/webmcp-acceptance-sidecar.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runStoryFactoryReadOnlyJourney(");
  const end = source.indexOf("export async function runWebMcpAcceptanceJourney(");
  const journey = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.match(journey, /await observe\(stage\.id, "before-open"\)/u);
  assert.match(journey, /await observe\(stage\.id, "rendered"\)/u);
  assert.match(journey, /await observe\(stage\.id, "after-dashboard"\)/u);
  assert.match(journey, /observed\.projectId === initialProject/u);
  assert.match(journey, /finalProject === initialProject/u);
  assert.match(journey, /project-session-evidence\.json/u);
  assert.doesNotMatch(journey, /resumeSessionActiveProject|switchActiveLibraryProject|clearSessionActiveProject|setItem\(|fetch\(/u);
  assert.match(journey, /dashboard === "dashboard", "dashboard", dashboard/u);
});
