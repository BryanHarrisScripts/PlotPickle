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
  assert.match(load, /posterUrls=\{afterglowPosters\}/u);
  assert.match(load, /setDestination\("examples"\)/u);
  assert.doesNotMatch(load, />Open Example<\/button>|StoryCard|Archive story|Open Saved Story|Resume Saved Story|setPending/u);
  assert.match(source, /className=\{styles\.gatewayPosterChoice\}/u);
});

test("#2559 Examples exposes exactly the clean-default and restore choices for Afterglow", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, />Open Example<\/button>/u);
  assert.match(source, />Open Example with Your Changes<\/button>/u);
  assert.doesNotMatch(source, />Project Defaults<\/button>|>Restore Your Changes<\/button>/u);
  assert.doesNotMatch(source, /Load & Explore/u);

  const examplesStart = source.indexOf('if (destination === "examples" || destination === "presets")');
  const examplesEnd = source.indexOf('if (destination === "avery")', examplesStart);
  const examples = source.slice(examplesStart, examplesEnd);
  assert.match(examples, /void loadPackagedExample\(item, mode \?\? "defaults"\)/u);
  assert.doesNotMatch(examples, /sourceKind: isExamples \? "example"/u);
});

test("#2559/#2566 Open Example bypasses scanning while local changes wait for one final Restore", async () => {
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

  assert.match(loader, /const openedProject = loadLibraryProjectSnapshot\(afterglowLocalState\.id\)/u);
  assert.match(loader, /sourceId: AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID/u);
  assert.match(loader, /inventory = await scanLocalResources\(openedProject\)/u);
  assert.match(loader, /if \(!inventory\.groups\.length && !scanError\)[\s\S]*switchActiveLibraryProject\(openedProject\.id\)[\s\S]*await openActiveProject\(\)/u);
  assert.match(loader, /setRecovery\(\{ project: openedProject, baseline, inventory, scanError \}\)/u);
  assert.match(source, />Select All<\/button>/u);
  assert.match(source, />\{restoringResources \? "Restoring…" : "Restore"\}<\/button>/u);
  assert.doesNotMatch(source, /Load All|Restore Selected Changes|Continue Without Local Media/u);
});

test("#2559/#2560 packaged Afterglow artwork stays whole while local poster versions can be browsed", async () => {
  const [source, css] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);
  assert.match(source, /AFTERGLOW_EXAMPLE_FALLBACK_POSTER/u);
  assert.match(source, /afterglowExamplePosterUrls/u);
  assert.match(source, /return generatedPosters\.length \? generatedPosters : \[AFTERGLOW_EXAMPLE_FALLBACK_POSTER\]/u);
  assert.match(source, /MAX_EXAMPLE_POSTERS = 5/u);
  assert.match(source, /gatewayPosterChoice/u);
  assert.match(source, /Previous Afterglow poster/u);
  assert.match(source, /Next Afterglow poster/u);
  assert.match(source, /safePosterIndex \+ 1\} \/ \{examplePosters\.length\}/u);
  assert.match(css, /\.examplePoster \{[\s\S]*aspect-ratio: 2 \/ 3/u);
  assert.match(css, /\.examplePoster img \{[\s\S]*object-fit: contain/u);
  assert.match(css, /\.examplePosterNavigation/u);
});
