import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2446/#2458/#3019 moves Sound under ASSETS while preserving its three owning surfaces", async () => {
  const [menu, workspace, host] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/assets-workspace.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);
  const rows = [...menu.matchAll(/\{ id: "([^"]+)", shortcut: "([^"]+)", label: "([^"]+)", description: "([^"]+)", group: "([^"]+)" \}/gu)]
    .map((match) => ({ id: match[1], shortcut: match[2], label: match[3], group: match[5] }));
  assert.deepEqual(rows.filter((row) => row.group === "ASSETS"), [
    { id: "assets", shortcut: "A", label: "Assets", group: "ASSETS" },
  ]);
  assert.equal(rows.some((row) => row.group === "SOUND"), false);
  assert.equal(new Set(rows.map((row) => row.shortcut)).size, rows.length);
  for (const kind of ["foley", "narration", "music"]) {
    assert.match(workspace, new RegExp(`onOpenSound\\("${kind}"\\)`, "u"));
    assert.match(host, new RegExp(`"sound-${kind}"`, "u"));
  }
  assert.match(workspace, /aria-label="Sounds folder"/u);
  assert.match(host, /<SkinV1SoundReviewSurface/u);
  assert.match(host, /if \(item\.id === "assets"\)/u);
});

test("#3019 ASSETS enters the canonical Matrix host without creating an alternative SOUND store", async () => {
  const [menu, workspace] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/assets-workspace.tsx"),
  ]);
  const connected = menu.slice(menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"), menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"));
  assert.match(connected, /"assets"/u);
  assert.match(menu, /"assets"[\s\S]*"previs"/u);
  for (const id of ["sound-foley", "sound-narration", "sound-music"]) assert.match(connected, new RegExp(`"${id}"`, "u"));
  assert.match(workspace, /sessionActiveProjectId/u);
  assert.match(workspace, /loadLibraryProjectSnapshot/u);
  assert.match(workspace, /persistActiveProfileProject/u);
  assert.match(workspace, /flushProfilePrivateWrites/u);
  assert.match(workspace, /assertCurrentProject/u);
  assert.doesNotMatch(workspace, /localStorage\.setItem|sessionStorage\.setItem/u);
});

test("#2446 original Sound proposal remains historical, not deleted", async () => {
  const [host, brief] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("docs/developer-briefs/2446-dashboard-sound-selectable.md"),
  ]);
  assert.match(host, /setSoundOpen\(kind\)/u);
  assert.match(brief, /room tone/u);
});
