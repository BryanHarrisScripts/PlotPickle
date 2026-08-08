import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#452 exposes exactly five writer-facing Storyboard creative areas", async () => {
  const nav = await source("app/storyboard-area-nav-host.tsx");

  for (const area of ["Overview", "Story World", "Moments", "Continuity", "Versions"]) {
    assert.ok(nav.includes(`label: "${area}"`), `Missing Storyboard area: ${area}`);
  }
  assert.match(nav, /One story moment\. Five creative areas\./);
  assert.match(nav, /aria-label="Storyboard areas"/);
  assert.match(nav, /4 Acts/);
  assert.match(nav, /24 Blocks/);
  assert.match(nav, /96 moments/);
});

test("#452 preserves all existing Storyboard tools beneath the five creative areas", async () => {
  const nav = await source("app/storyboard-area-nav-host.tsx");

  for (const tool of [
    "Visual overview",
    "Characters & identity locks",
    "Locations & world",
    "Props, vehicles & wardrobe",
    "Colour, lighting & language",
    "24-block storyboard",
    "96 mini-block frames",
    "Continuity & missing assets",
    "Posters, pitch & production",
  ]) assert.ok(nav.includes(tool), `Missing preserved Storyboard tool: ${tool}`);
});

test("#452 five-area navigation reuses canonical Visual Board controls instead of creating story state", async () => {
  const nav = await source("app/storyboard-area-nav-host.tsx");

  assert.match(nav, /nav\[aria-label="Visual Board sections"\] button/);
  assert.match(nav, /button\?\.click\(\)/);
  assert.match(nav, /legacyNav\.hidden = true/);
  assert.match(nav, /createPortal/);
  assert.match(nav, /MutationObserver/);
  assert.doesNotMatch(nav, /setProject|onChange|approvedImageVersionId|approvedVideoVersionId|localStorage|sessionStorage/);
});

test("#452 Versions opens the existing selected-moment review without creating a parallel asset store", async () => {
  const nav = await source("app/storyboard-area-nav-host.tsx");

  assert.match(nav, /virtual: "versions"/);
  assert.match(nav, /96 mini-block frames/);
  assert.match(nav, /searchParams\.set\("visualSection", "frames"\)/);
  assert.match(nav, /searchParams\.set\("decision", "review"\)/);
  assert.match(nav, /PopStateEvent\("popstate"\)/);
  assert.doesNotMatch(nav, /versions:\s*\[|new Map|indexedDB/i);
});

test("#452 five-area rail is Storyboard-only and mounted outside the canonical data model", async () => {
  const [layout, nav] = await Promise.all([
    source("app/layout.tsx"),
    source("app/storyboard-area-nav-host.tsx"),
  ]);

  assert.match(layout, /import StoryboardAreaNavHost/);
  assert.match(layout, /<StoryboardAreaNavHost \/>/);
  assert.match(nav, /document\.querySelector<HTMLElement>\("\.visual-studio-layout"\)/);
  assert.match(nav, /Storyboard creative areas/);
  assert.doesNotMatch(nav, /Ollama|ComfyUI|MiniMax|checkpoint|endpoint|apiKey/i);
});
