import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2559 LOAD is a read-only gateway to EXAMPLES", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const loadStart = source.indexOf('if (destination === "load")');
  const loadEnd = source.indexOf('if (destination === "examples"', loadStart);
  const load = source.slice(loadStart, loadEnd);

  assert.match(load, /<ExampleGatewayCard/u);
  assert.match(load, /setDestination\("examples"\)/u);
  assert.match(source, />Open Example<\/button>/u);
  assert.doesNotMatch(load, /StoryCard|Archive story|Open Saved Story|Resume Saved Story|setPending/u);
});

test("#2559 Examples exposes exactly the clean-default and restore choices for Afterglow", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, />Project Defaults<\/button>/u);
  assert.match(source, />Restore Your Changes<\/button>/u);
  assert.doesNotMatch(source, /Load & Explore/u);

  const examplesStart = source.indexOf('if (destination === "examples" || destination === "presets")');
  const examplesEnd = source.indexOf('if (destination === "avery")', examplesStart);
  const examples = source.slice(examplesStart, examplesEnd);
  assert.match(examples, /void loadPackagedExample\(item, mode \?\? "defaults"\)/u);
  assert.doesNotMatch(examples, /sourceKind: isExamples \? "example"/u);
});

test("#2559 Project Defaults bypasses local scanning while Restore Your Changes owns recovery", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const start = source.indexOf('async function loadPackagedExample(');
  const end = source.indexOf('async function confirmLoad()', start);
  const loader = source.slice(start, end);

  const defaultsBranch = loader.indexOf('if (mode === "defaults")');
  const scanner = loader.indexOf('inventory = await scanLocalResources(openedProject)');
  assert.ok(defaultsBranch >= 0 && scanner > defaultsBranch);
  const defaultsSlice = loader.slice(defaultsBranch, scanner);
  assert.match(defaultsSlice, /setRecovery\(null\)/u);
  assert.match(defaultsSlice, /await openActiveProject\(\)/u);
  assert.doesNotMatch(defaultsSlice, /scanLocalResources/u);

  assert.match(loader, /inventory = await scanLocalResources\(openedProject\)/u);
  assert.match(loader, /if \(!inventory\.groups\.length && !scanError\)[\s\S]*Opening the packaged Project Defaults\.[\s\S]*await openActiveProject\(\)/u);
  assert.match(loader, /setRecovery\(\{ project: openedProject, baseline, inventory, scanError \}\)/u);
  assert.match(source, />\{restoringResources \? "Restoring All…" : "Load All"\}<\/button>/u);
  assert.match(source, />\{restoringResources \? "Restoring…" : "Restore Selected Changes"\}<\/button>/u);
});

test("#2559 packaged Afterglow artwork is shown whole and local posters are not used as the example card", async () => {
  const [source, css] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);
  assert.match(source, /src=\{AFTERGLOW_EXAMPLE_FALLBACK_POSTER\}[\s\S]*width=\{1200\}[\s\S]*height=\{675\}/u);
  assert.doesNotMatch(source, /afterglowExamplePosterUrls|MAX_EXAMPLE_POSTERS|Previous Afterglow poster|Next Afterglow poster/u);
  assert.match(css, /\.examplePoster img,[\s\S]*\.gatewayPoster img[\s\S]*width: 100%;[\s\S]*height: auto;[\s\S]*object-fit: contain/u);
});
