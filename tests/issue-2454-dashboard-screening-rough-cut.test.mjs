import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2454 applies the Human-approved Dashboard IA without changing underlying workspace ids", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const rows = [...menu.matchAll(/\{ id: "([^"]+)", shortcut: "([^"]+)", label: "([^"]+)", description: "([^"]+)", group: "([^"]+)" \}/gu)]
    .map((match) => ({ id: match[1], shortcut: match[2], label: match[3], group: match[5] }));

  assert.deepEqual(
    rows.filter((row) => row.group === "EXPLORE").map((row) => row.label),
    ["Learn", "Library", "Community", "Screening", "Reports"],
  );
  assert.deepEqual(
    rows.filter((row) => row.group === "VISUALIZE").map((row) => row.label),
    ["Outline", "Storyboard", "Previs", "Timeline", "Rough Cut"],
  );
  assert.deepEqual(
    rows.filter((row) => row.group === "PITCH").map((row) => row.label),
    ["Deck", "Package", "Feedback"],
  );

  const roughCut = rows.find((row) => row.label === "Rough Cut");
  assert.equal(roughCut?.id, "production");
  assert.equal(roughCut?.shortcut, "D");

  const reports = rows.find((row) => row.id === "reports");
  assert.equal(reports?.group, "EXPLORE");
  assert.equal(reports?.shortcut, "A");

  const screening = rows.find((row) => row.id === "screening");
  assert.equal(screening?.group, "EXPLORE");
  assert.equal(screening?.shortcut, "9");

  assert.equal(new Set(rows.map((row) => row.shortcut)).size, rows.length);
});

test("#2454/#2458 keeps the approved IA while Screening becomes a governed review surface", async () => {
  const [menu, host] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  const unavailable = menu.slice(
    menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_STARTUP_CHOICES"),
  );
  assert.doesNotMatch(unavailable, /"screening"/u);
  assert.match(host, /item\.id === "screening"[\s\S]*setScreeningOpen\(true\)/u);
  assert.match(host, /item\.id === "production"[\s\S]*openProduction\(reviewAddress\)/u);
  assert.match(host, /onSurfaceNameChange\("MindMap"\)/u);
  assert.match(host, /<h1>MindMap<\/h1>/u);

  const review = menu.slice(
    menu.indexOf("export const DASHBOARD_REVIEW_ITEM_IDS"),
    menu.indexOf("export const DASHBOARD_UNAVAILABLE_ITEM_IDS"),
  );
  assert.deepEqual([...review.matchAll(/"([^"]+)"/gu)].map((match) => match[1]), ["screening", "sound-narration", "sound-music", "sound-foley", "previs", "timeline", "production"]);
  for (const id of ["discovery", "story-bible", "plan", "storyboard"]) assert.doesNotMatch(review, new RegExp(`"${id}"`, "u"));
});