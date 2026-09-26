import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2446/#2458 keeps Sound between Visualize and Pitch and promotes the three destinations into review", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const rows = [...menu.matchAll(/\{ id: "([^"]+)", shortcut: "([^"]+)", label: "([^"]+)", description: "([^"]+)", group: "([^"]+)" \}/gu)]
    .map((match) => ({ id: match[1], shortcut: match[2], label: match[3], description: match[4], group: match[5] }));

  assert.deepEqual(
    rows.filter((row) => row.group === "SOUND").map((row) => [row.id, row.shortcut, row.label]),
    [
      ["sound-foley", "8", "Foley"],
      ["sound-narration", "6", "Narration"],
      ["sound-music", "7", "Music"],
    ],
  );
  assert.deepEqual(
    [...new Set(rows.map((row) => row.group))],
    ["EXPLORE", "DEVELOP", "VISUALIZE", "SOUND", "PITCH", "PLAY", "SYSTEM"],
  );
  assert.equal(new Set(rows.map((row) => row.shortcut)).size, rows.length);

  const connected = menu.slice(
    menu.indexOf("export const CONNECTED_DASHBOARD_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"),
  );
  for (const id of ["sound-narration", "sound-music", "sound-foley"]) assert.match(connected, new RegExp(`"${id}"`, "u"));

  const unavailable = menu.slice(
    menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"),
  );
  for (const id of ["screening", "sound-narration", "sound-music", "sound-foley"]) assert.doesNotMatch(unavailable, new RegExp(`"${id}"`, "u"));
  for (const id of ["pitch-package", "pitch-deck"]) assert.match(unavailable, new RegExp(`"${id}"`, "u"));
});

test("#2446/#2458 keeps only truly unavailable rows inert while Sound opens governed review surfaces", async () => {
  const [panel, host, client] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/skin-v1-client.tsx"),
  ]);

  assert.match(panel, /const selected = index === selectedIndex/u);
  assert.match(panel, /selected \? " is-selected" : ""/u);
  assert.match(panel, /const unavailable = DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(item\.id\)/u);
  assert.match(panel, /const locked = connected && !inReview && !unavailable/u);
  assert.match(panel, /data-dashboard-surface-state=\{unavailable \? "unavailable"/u);
  assert.match(panel, /data-dashboard-status=\{unavailable \? "inactive"/u);
  assert.doesNotMatch(panel, /if \(!item \|\| DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(item\.id\)\) return/u);

  assert.match(
    host,
    /if \(DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(item\.id\)\) \{[\s\S]*onActivate\(index\);[\s\S]*onSurfaceNameChange\("DASHBOARD"\);[\s\S]*return;/u,
  );
  assert.match(client, /function activateDashboardItem\(index: number\) \{[\s\S]*setDashboardSelection\(index\)/u);

  assert.match(host, /item\.id === "sound-narration" \|\| item\.id === "sound-music" \|\| item\.id === "sound-foley"/u);
  assert.match(host, /setSoundOpen\(kind\)/u);
  assert.match(host, /<SkinV1SoundReviewSurface/u);
});

test("#2446 brief remains historical while #2458 supplies the Sound surfaces", async () => {
  const [menu, host, brief] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("docs/developer-briefs/2446-dashboard-sound-selectable.md"),
  ]);

  assert.match(menu, /label: "Narration"/u);
  assert.match(menu, /label: "Music"/u);
  assert.match(menu, /label: "Foley"/u);
  assert.match(host, /<SkinV1SoundReviewSurface/u);
  assert.match(brief, /opening\/beginning music/u);
  assert.match(brief, /room tone/u);
  assert.match(brief, /Do not implement these menus now/u);
});