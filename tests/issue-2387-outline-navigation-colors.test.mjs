import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Outline has the visible title, six-block horizontal navigation, and five distinct state colors", async () => {
  const [registry, declarations, host, map, layout, skin] = await Promise.all([
    read("config/skin-v1-surface-registry.json"),
    read("config/skin-v1-surface-declarations/standard-surfaces.json"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("modules/build/ui/progressive-story-map.tsx"),
    read("modules/build/ui/progressive-story-map.module.css"),
    read("app/skin-v1/preproduction-matrix-contract.css"),
  ]);
  assert.equal(JSON.parse(registry).surfaces.find((surface) => surface.id === "story-map")?.label, "Outline");
  assert.equal(JSON.parse(declarations).surfaces?.["story-map"]?.label ?? JSON.parse(declarations)["story-map"]?.label, "Outline");
  assert.match(host, /aria-label="Outline"[\s\S]*<h1>OUTLINE<\/h1>/);
  assert.match(map, /locked: "BLOCKED"/);
  assert.match(layout, /\.map\[aria-label\^="Act "\] \{ grid-template-columns: repeat\(3,minmax\(240px,1fr\)\); grid-template-rows: auto; grid-auto-flow: row/);
  const colors = [...skin.matchAll(/--story-(?:defined|observed|emerging|missing|locked): (#[a-f\d]{6});/g)].map((match) => match[1]);
  assert.equal(new Set(colors).size, 5);
});
