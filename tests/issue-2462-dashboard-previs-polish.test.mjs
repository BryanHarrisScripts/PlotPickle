import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2462 keeps the approved Dashboard order and labels", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const rows = [...menu.matchAll(/\{ id: "([^"]+)", shortcut: "([^"]+)", label: "([^"]+)", description: "([^"]+)", group: "([^"]+)" \}/gu)]
    .map((match) => ({ id: match[1], shortcut: match[2], label: match[3], group: match[5] }));

  assert.deepEqual(rows.filter((row) => row.group === "SOUND").map((row) => row.label), ["Foley", "Narration", "Music"]);
  assert.deepEqual(rows.filter((row) => row.group === "PITCH").map((row) => row.label), ["Deck", "Package", "Feedback"]);
  assert.deepEqual(
    rows.filter((row) => row.group === "PLAY").map((row) => [row.id, row.shortcut, row.label]),
    [["profile", "I", "Identity"], ["wyrmwood", "2", "Wyrmwood"], ["story", "3", "The Unwritten"]],
  );
});

test("#2462 uses the approved MindMap one-word header", async () => {
  const [host, discovery] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/discovery-surface.tsx"),
  ]);

  assert.match(host, /aria-label="MindMap"/u);
  assert.match(host, /<h1>MindMap<\/h1>/u);
  assert.match(host, /onSurfaceNameChange\("MindMap"\)/u);
  assert.match(discovery, /<h2>MindMap<\/h2>/u);
  assert.match(discovery, /MindMap · ACT \{selectedAct\} · NON-CANON PROJECTION/u);
});

test("#2462 labels Previs correctly and removes the legacy back-links", async () => {
  const [host, surfaces, map, previs] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("modules/build/ui/progressive-story-map.tsx"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(host, /<h1>Previs<\/h1>/u);
  assert.match(host, /onSurfaceNameChange\("PREVIS"\)/u);
  assert.match(surfaces, /surfaceLabel="Previs"/u);
  assert.match(map, /surfaceLabel === "Previs" \? "Previs" : "The story is the navigation\."/u);
  assert.doesNotMatch(previs, />Open Storyboard</u);
  assert.doesNotMatch(previs, />Inspect evidence</u);
});

test("#2462 preserves Previs Flip Book, navigation, shot authoring, and evidence provenance", async () => {
  const previs = await read("app/_components/previs/previs-readiness-workspace.tsx");

  assert.match(previs, /data-previs-flipbook="25-positions"/u);
  assert.match(previs, /Array\.from\(\{ length: 25 \}/u);
  assert.match(previs, /aria-label="Previs Acts"/u);
  assert.match(previs, /Add creative shot/u);
  assert.match(previs, /id="previs-selected-evidence"/u);
  assert.match(previs, /artifact\.workflow === "storyboard-frame-webp-v2"/u);
  assert.match(previs, /acceptedVisualIds\.has\(artifact\.id\) && artifact\.reviewState === "accepted"/u);
});
