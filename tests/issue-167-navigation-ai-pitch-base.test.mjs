import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #167 keeps exactly ten primary workflow steps in the requested order", async () => {
  const direction = await source("lib/product-direction.ts");
  const primary = direction.slice(
    direction.indexOf("export const PRIMARY_WORKFLOW_NAVIGATION"),
    direction.indexOf("export const COLLABORATION_NAVIGATION"),
  );
  const actual = [...primary.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(actual, ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Pitch", "Build", "Feedback", "Refine", "Reports"]);
  assert.equal([...primary.matchAll(/zone: "discovery"/g)].length, 6);
  assert.equal([...primary.matchAll(/zone: "production"/g)].length, 4);
  assert.doesNotMatch(primary, /Introduction|Settings/);
});

test("the application shell renders both named groups and the new Pitch workspace", async () => {
  const [header, page] = await Promise.all([
    source("app/application-shell-header.tsx"),
    source("app/page.tsx"),
  ]);
  assert.match(header, /Discovery &amp; Pre-Production/);
  assert.match(header, /Production &amp; Polishing/);
  assert.ok(header.indexOf("shell-zone-discovery") < header.indexOf("shell-zone-production"));
  assert.match(page, /activeTab === "pitch"/);
  assert.match(page, /<AiPitchDeckWorkspace/);
  assert.match(page, /connectionState\.snapshot\.items\.ai/);
  assert.match(page, /connectionState\.settings\.ai\.imageModel/);
  assert.match(page, /onOpenCharacters/);
});

test("Settings has the exact four ordered groups and requested destinations", async () => {
  const panel = await source("app/settings-panel.tsx");
  const menu = panel.slice(panel.indexOf("const SETTINGS_GROUPS"), panel.indexOf("const SETTINGS_SECTIONS"));
  const labels = [...menu.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(labels, [
    "Workspace", "General", "Appearance / Accessibility", "Project Defaults",
    "Integrations", "Story & Art", "Repository & Collab", "Scheduling & Meetings", "Media & Film Engines",
    "Data Storage", "Storage & Backups",
    "Security", "Privacy & Permissions", "About & Licensing",
  ]);
  assert.match(panel, /SETTINGS_GROUPS\.map/);
  assert.match(panel, /section === "appearance"[\s\S]*settings\.accessibility\.highContrast/);
});

test("the canonical comic plan covers every Block and mini-block with directed visual context", async () => {
  const deck = await source("lib/ai-pitch-deck.ts");
  for (const contract of [
    "COMIC_PITCH_PAGE_COUNT = 24",
    "COMIC_PITCH_PANELS_PER_PAGE = 4",
    "COMIC_PITCH_PANEL_COUNT = COMIC_PITCH_PAGE_COUNT * COMIC_PITCH_PANELS_PER_PAGE",
    "project.production.shots.find",
    "block?.storyboardDirection",
    "approvedCharacterIdentityPrompt",
    "approvedCharacterReferenceImages",
    "screenplay.draftElements.filter",
  ]) assert.ok(deck.includes(contract), `Comic plan is missing: ${contract}`);
  assert.match(deck, /Black-and-white hand-drawn comic-book storyboard panel/);
  assert.match(deck, /No written words, letters, captions, speech balloons/);
  assert.match(deck, /for \(let blockNumber = 1; blockNumber <= COMIC_PITCH_PAGE_COUNT/);
  assert.match(deck, /for \(let miniBlockNumber = 1; miniBlockNumber <= COMIC_PITCH_PANELS_PER_PAGE/);
});

test("the writer explicitly controls cost, progress, pause, resume, retry and regeneration", async () => {
  const [workspace, queue, castQueue] = await Promise.all([
    source("app/ai-pitch-deck-workspace.tsx"),
    source("app/use-graphic-novel-queue.ts"),
    source("app/use-cast-identity-queue.ts"),
  ]);
  assert.match(workspace, /I understand this run can make up to \{queue\.preflight\.remainingImages\} paid image API calls/);
  assert.match(workspace, /disabled=\{!queue\.aiReady \|\| !queue\.preflight\.ready \|\| !queue\.acknowledged/);
  assert.match(queue, /new AbortController\(\)/);
  assert.match(queue, /status: "stopped"/);
  assert.match(queue, /function retry\(itemId: string\)/);
  for (const label of [
    "Generate all Graphic Novel images",
    "Resume remaining images",
    "Retry",
    "Rebuild all 96 panels",
    "Stop generation",
  ]) assert.ok(workspace.includes(label), `Graphic Novel workflow is missing: ${label}`);
  assert.match(queue, /Completed images were kept/);
  assert.match(workspace, /Regenerate Entire Cast/);
  assert.match(castQueue, /window\.confirm/);
  assert.match(castQueue, /for \(const queueItem of remaining\)/);
  assert.match(castQueue, /saveVisualIdentityDraft/);
});

test("dialogue remains editable HTML outside generated image pixels and exports portably", async () => {
  const [deck, workspace] = await Promise.all([
    source("lib/ai-pitch-deck.ts"),
    source("app/ai-pitch-deck-workspace.tsx"),
  ]);
  assert.match(deck, /panel\.dialogue\.map\(\(item\) => `<blockquote>/);
  assert.match(deck, /imageDataByPanel/);
  assert.match(deck, /@media print/);
  assert.match(workspace, /Dialogue balloons/);
  assert.match(workspace, /Download self-contained HTML/);
  assert.match(workspace, /Print \/ Save as PDF/);
  assert.match(workspace, /FileReader/);
});

test("OpenAI reference images use the supported edit endpoint and stay local", async () => {
  const gateway = await source("build/local-ai-gateway.ts");
  assert.match(gateway, /\/images\/edits/);
  assert.match(gateway, /new FormData\(\)/);
  assert.match(gateway, /form\.append\("image\[\]"/);
  assert.match(gateway, /references\.length/);
  assert.match(gateway, /slice\(0, 4\)/);
  assert.match(gateway, /if \(!connection\.imageModel\.startsWith\("gpt-image-2"\)\) form\.set\("input_fidelity", "high"\)/);
  assert.match(gateway, /path\.join\(assetsDirectory\(\), fileName\)/);
  assert.doesNotMatch(gateway, /console\.(?:log|warn|error)/);
});

test("comic deck state migrates safely and records non-secret provenance", async () => {
  const [project, schema, operations] = await Promise.all([
    source("lib/project.ts"),
    source("schema/plotpickle-project.schema.json"),
    source("lib/ai-pitch-deck.ts"),
  ]);
  assert.match(project, /comicDeck\?: ComicPitchDeck/);
  assert.match(project, /createBlankComicPitchDeck/);
  assert.match(project, /status === "generating" \? "paused"/);
  assert.match(schema, /"comicPitchDeck"/);
  assert.match(schema, /"maxItems": 96/);
  assert.match(operations, /recordComicPitchDeckProvenance/);
  assert.match(operations, /operation: "image"/);
  assert.doesNotMatch(`${project}\n${operations}`, /apiKey|accessToken|refreshToken/);
  assert.doesNotThrow(() => JSON.parse(schema));
});

test("issue #167 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-167-navigation-ai-pitch\.test\.mjs/);
  assert.equal(packageJson.scripts["test:ai-comic-pitch"], "node --test tests/issue-167-navigation-ai-pitch.test.mjs");
});
