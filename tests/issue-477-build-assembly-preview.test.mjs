import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#477 mounts the Build assembly layer inside the reviewed Studio shell", async () => {
  const [layout, assembly] = await Promise.all([
    source("app/layout.tsx"),
    source("app/build-assembly-studio.tsx"),
  ]);

  assert.match(layout, /import BuildAssemblyStudio/);
  assert.match(layout, /<BuildAssemblyStudio \/>/);
  assert.match(layout, /build-assembly-studio\.css/);
  assert.match(assembly, /aside\[aria-label="Build sections"\]/);
  assert.match(assembly, /data-build-studio-context/);
});

test("#477 assembles only canonical or approved source material for the exact story moment", async () => {
  const assembly = await source("app/build-assembly-studio.tsx");

  assert.match(assembly, /project\.screenplay\.draftElements\.filter/);
  assert.match(assembly, /item\.approvedImageVersionId/);
  assert.match(assembly, /approvedVariation\(project, item\.assetRef\)/);
  assert.match(assembly, /project\.production\.shots\.filter/);
  assert.match(assembly, /project\.production\.cues\.filter/);
  assert.match(assembly, /blockNumber === blockNumber/);
  assert.match(assembly, /miniBlockNumber === miniBlockNumber/);
});

test("#477 keeps arrangement outside canon until explicit sequence approval", async () => {
  const assembly = await source("app/build-assembly-studio.tsx");

  assert.match(assembly, /window\.sessionStorage\.setItem\(reviewKey/);
  assert.match(assembly, /Sequence is a candidate\. Canon has not changed/);
  assert.match(assembly, /Approve sequence/);
  assert.match(assembly, /window\.localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(next\)\)/);
  assert.match(assembly, /buildSequenceApprovals/);
  assert.match(assembly, /sourceIds: ordered\.map/);
});

test("#477 promotes matching planned shots without rewriting screenplay or approved visual source records", async () => {
  const assembly = await source("app/build-assembly-studio.tsx");

  assert.match(assembly, /shot\.status === "planned"/);
  assert.match(assembly, /status: "approved" as const/);
  assert.doesNotMatch(assembly, /draftElements:\s*project\.screenplay/);
  assert.doesNotMatch(assembly, /visuals:\s*block/);
  assert.doesNotMatch(assembly, /fetch\(|apiKey|Ollama|ComfyUI|MiniMax|provider/i);
});

test("#477 routes source corrections back to the owning module and same story position", async () => {
  const assembly = await source("app/build-assembly-studio.tsx");

  assert.match(assembly, /item\.kind === "screenplay"/);
  assert.match(assembly, /`\/edit\?block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}`/);
  assert.match(assembly, /item\.kind === "storyboard"/);
  assert.match(assembly, /workspace=storyboard&block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}/);
  assert.match(assembly, /item\.kind === "graphic-novel"/);
  assert.match(assembly, /workspace=pitch&block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}/);
  assert.match(assembly, /Send back/);
});

test("#477 follows the reviewed matte-black warm-gold Build visual contract", async () => {
  const styles = await source("app/build-assembly-studio.css");

  assert.match(styles, /#0b0b0a/i);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /Georgia/);
  assert.match(styles, /build-assembly-body/);
  assert.match(styles, /build-sequence-preview/);
  assert.match(styles, /@media\(max-width:640px\)/);
  assert.doesNotMatch(styles, /purple|violet|#7c3aed|#8b5cf6/i);
});
