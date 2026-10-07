import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2559/#2570 LOAD keeps Afterglow as one poster card and restores Human-owned story cards", async () => {
  const [source, css] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);
  const loadStart = source.indexOf('if (destination === "load")');
  const loadEnd = source.indexOf('if (destination === "examples"', loadStart);
  const load = source.slice(loadStart, loadEnd);

  assert.match(load, /<ExampleGatewayCard/u);
  assert.match(load, /posterUrls=\{afterglowPosters\}/u);
  assert.match(load, /setDestination\("examples"\)/u);
  assert.match(load, /<SavedStoryLoadCard/u);
  assert.match(load, /setPending\(\{ kind: "story", item: entry\.item \}\)/u);
  assert.match(load, /LOAD_CARDS_PER_PAGE/u);
  assert.match(load, /Previous Load stories/u);
  assert.match(load, /Next Load stories/u);
  assert.doesNotMatch(load, /Select an Afterglow poster to open EXAMPLES/u);
  assert.doesNotMatch(load, /Generated posters replace the packaged fallback artwork whenever local poster versions are available/u);
  assert.doesNotMatch(load, />Open Example<\/button>|Archive story|Resume Saved Story/u);

  const gatewayStart = source.indexOf("function ExampleGatewayCard");
  const gatewayEnd = source.indexOf("function SavedStoryLoadCard", gatewayStart);
  const gateway = source.slice(gatewayStart, gatewayEnd);
  assert.match(gateway, /const \[posterIndex, setPosterIndex\] = useState\(0\)/u);
  assert.match(gateway, /src=\{posterUrl\}/u);
  assert.match(gateway, /Previous Afterglow poster/u);
  assert.match(gateway, /Next Afterglow poster/u);
  assert.doesNotMatch(gateway, /posters\.map/u);
  assert.match(css, /\.loadCardGrid \{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u);
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

test("#2559/#2823 Open Example bypasses scanning while Your Changes prepares one resume manifest", async () => {
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
  assert.match(loader, /createLibraryLoadSessionBaseline\(openedProject/u);
  assert.match(loader, /inventory = await scanLocalResources\(openedProject\)/u);
  assert.match(loader, /setRecovery\(\{ project: openedProject, baseline, inventory, scanError \}\)/u);
  assert.match(source, /Resume Saved Afterglow/u);
  assert.match(source, /async function continueSavedStoryResume/u);
  assert.doesNotMatch(source, />Select All<\/button>|requires your explicit selection|selectedRecoveryOrigins/u);
});
test("#2559/#2560/#2570 packaged Afterglow artwork stays whole while Load and Examples browse one poster at a time", async () => {
  const [source, css] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);
  assert.match(source, /AFTERGLOW_EXAMPLE_FALLBACK_POSTER/u);
  assert.match(source, /afterglowExamplePosterUrls/u);
  assert.match(source, /if \(generatedPosters\.length\) return generatedPosters/u);
  assert.match(source, /packagedAfterglowManifest\.featuredPosterUrls/u);
  assert.match(source, /return packagedPosters\.length \? packagedPosters : \[AFTERGLOW_EXAMPLE_FALLBACK_POSTER\]/u);
  assert.match(source, /MAX_EXAMPLE_POSTERS = 5/u);
  assert.match(source, /className=\{styles\.loadPosterButton\}/u);
  assert.match(source, /className=\{styles\.loadPosterNavigation\}/u);
  assert.match(source, /Previous Afterglow poster/u);
  assert.match(source, /Next Afterglow poster/u);
  assert.match(source, /safePosterIndex \+ 1\} \/ \{examplePosters\.length\}/u);
  assert.match(css, /\.examplePoster \{[\s\S]*aspect-ratio: 2 \/ 3/u);
  assert.match(css, /\.examplePoster img \{[\s\S]*object-fit: contain/u);
  assert.match(css, /\.examplePosterNavigation/u);
});
