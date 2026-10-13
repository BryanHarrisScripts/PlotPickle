import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { moveWriteStoryPosition } from "../modules/write/model/write-position-navigation.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function navigationFixture(locationHref) {
  const calls = [];
  const history = {
    state: { matrixSurface: "write", selectedProjectId: "brotherly-love" },
    replaceState(state, unused, href) { calls.push({ state, href }); },
  };
  return { locationHref, history, calls };
}

test("#2953 Block 01 → 24 → 01 remains on Matrix with exact project and URL context", () => {
  const sourceEvidence = Object.freeze({
    screenplay: Object.freeze({ fileName: "Brotherly Love.fdx", title: "Brotherly Love", sourceText: "Original screenplay. No rewrite." }),
  });
  const project = Object.freeze({ id: "brotherly-love", title: "Brotherly Love", sourceEvidence });
  const first = navigationFixture("http://127.0.0.1:4174/skin-v1?workspace=write&block=1&mini=1&source=fdx#writing");
  const moved = moveWriteStoryPosition({ ...first, blockNumber: 24, miniBlockNumber: 1, dirty: false, confirmDiscard: () => { throw new Error("Should not confirm unchanged work"); } });
  assert.deepEqual(moved, { blockNumber: 24, miniBlockNumber: 1 });
  assert.equal(first.calls.length, 1);
  assert.equal(first.calls[0].href, "/skin-v1?workspace=write&block=24&mini=1&source=fdx#writing");
  assert.equal(first.calls[0].state.selectedProjectId, project.id);
  const second = navigationFixture("http://127.0.0.1:4174" + first.calls[0].href);
  moveWriteStoryPosition({ ...second, blockNumber: 1, miniBlockNumber: 4, dirty: false, confirmDiscard: () => true });
  assert.equal(second.calls[0].href, "/skin-v1?workspace=write&block=1&mini=4&source=fdx#writing");
  assert.equal(project.title, "Brotherly Love");
  assert.strictEqual(project.sourceEvidence, sourceEvidence);
  assert.equal(project.sourceEvidence.screenplay.sourceText, "Original screenplay. No rewrite.");
});

test("#2953 unsaved changes cannot navigate or silently become another Mini-Block", () => {
  const fixture = navigationFixture("http://localhost:4174/skin-v1?block=1&mini=1");
  let confirms = 0;
  const denied = moveWriteStoryPosition({
    ...fixture, blockNumber: 24, miniBlockNumber: 1, dirty: true,
    confirmDiscard: () => { confirms++; return false; },
  });
  assert.equal(denied, null);
  assert.equal(confirms, 1);
  assert.equal(fixture.calls.length, 0);
  const accepted = moveWriteStoryPosition({
    ...fixture, blockNumber: 24, miniBlockNumber: 4, dirty: true,
    confirmDiscard: () => { confirms++; return true; },
  });
  assert.deepEqual(accepted, { blockNumber: 24, miniBlockNumber: 4 });
  assert.equal(fixture.calls[0].href, "/skin-v1?block=24&mini=4");
  assert.equal(confirms, 2);
  for (const invalid of [{ blockNumber: 0, miniBlockNumber: 1 }, { blockNumber: 25, miniBlockNumber: 1 }, { blockNumber: 1, miniBlockNumber: 5 }]) {
    assert.throws(() => moveWriteStoryPosition({ ...fixture, ...invalid, dirty: false, confirmDiscard: () => true }), RangeError);
  }
  assert.equal(fixture.calls.length, 1);
});

test("#2953 dashboard activates Write in Matrix and the editor selects addresses without document navigation", async () => {
  const [host, editor, menu, library] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("modules/write/ui/block-native-write-workspace.tsx"),
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("core/storage/project-library-browser.ts"),
  ]);
  const unavailable = menu.slice(menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"), menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"));
  assert.doesNotMatch(unavailable, /"write"/);
  assert.match(host, /if \(item\.id === "write"\)[\s\S]*setWriteOpen\(true\)[\s\S]*onSurfaceNameChange\("WRITE"\)/);
  assert.match(host, /data-dashboard-review-surface="write"/);
  assert.match(host, /<BlockNativeWriteWorkspace onBackDashboard=/);
  assert.match(editor, /moveWriteStoryPosition\(/);
  assert.match(editor, /if \(next\) setAddress\(next\)/);
  assert.doesNotMatch(editor, /window\.location\.assign\(addressHref/);
  assert.match(editor, /address\.blockNumber, address\.miniBlockNumber, project\?\.id/);
  assert.match(editor, /loadActiveLibraryProject\(\)/);
  assert.match(editor, /normalizeProjectSourceEvidence\(project\.sourceEvidence\)/);
  assert.match(editor, /Source evidence is never edited by this action/);
  assert.match(library, /export function loadActiveLibraryProject\(\): LibraryPPFProject/);
});
