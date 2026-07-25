import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function manifest() {
  return JSON.parse(await source("public/visual-references/manifest.json"));
}

test("legacy mood-board inventory is exact and verified", async () => {
  const report = JSON.parse(await source("public/visual-references/report.json"));
  assert.equal(report.sourceCount, 62);
  assert.equal(report.retainedCount, 62);
  assert.equal(report.renamedCount, 3);
  assert.equal(report.omittedCount, 0);
  assert.equal(report.replacementCount, 0);
  assert.equal(report.derivativeCount, 186);
  assert.equal(report.duplicateIds, 0);
  assert.deepEqual(report.missingManifestEntries, []);
  assert.deepEqual(report.zeroByteFiles, []);
  assert.deepEqual(report.failures, []);
  assert.ok(report.sizeReductionPercent > 60);
});

test("every retained reference has complete searchable metadata and three WebP derivatives", async () => {
  const items = await manifest();
  assert.equal(items.length, 62);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  for (const item of items) {
    for (const field of ["id", "title", "summary", "category", "alt", "contrast", "saturation", "lighting", "texture", "geometry", "cameraFeel", "emotionalEffect", "caution"]) assert.ok(item[field], `${item.id} missing ${field}`);
    assert.ok(item.tags.length);
    assert.equal(item.palette.length, 5);
    assert.ok(item.source.originalFilename.endsWith(".png"));
    assert.equal(item.source.generated, true);
    assert.match(item.source.archive, /Bryan Harris legacy 24 Blocks mood-board archive/);
    for (const variant of ["thumbnail", "card", "full"]) {
      assert.match(item.image[variant], /\.webp$/);
      const file = new URL(`public${item.image[variant]}`, root);
      await access(file);
      assert.ok((await stat(file)).size > 0);
    }
  }
});

test("named-film boards are generalized rather than shipped as film presets", async () => {
  const items = await manifest();
  const titles = items.map((item) => item.title);
  for (const title of ["Rain-Soaked Futuristic Noir", "Whimsical Saturated European Romance", "Symmetrical Pastel Heritage Hotel"]) assert.ok(titles.includes(title));
  for (const forbidden of ["Blade Runner 2049", "Amélie", "The Grand Budapest Hotel"]) assert.ok(!titles.includes(forbidden));
  assert.equal(items.filter((item) => item.source.renamedFromFilm).length, 3);
});

test("Visual Bible separates Project Mood Board from Reference Library", async () => {
  const labs = await source("app/specialist-labs.tsx");
  const library = await source("app/visual-reference-library.tsx");
  assert.match(labs, /Project Mood Board/);
  assert.match(labs, /Reference Library/);
  assert.match(labs, /VisualReferenceLibrary/);
  assert.match(library, /Search/);
  assert.match(library, /Category/);
  assert.match(library, /Visual treatment/);
  assert.match(library, /recently viewed/);
  assert.match(library, /loading="lazy"/);
});

test("reference detail exposes palette, visual ingredients, accessibility and provenance", async () => {
  const library = await source("app/visual-reference-library.tsx");
  for (const phrase of ["Contrast", "Saturation", "Lighting", "Texture", "Shape and composition", "Camera feel", "Audience effect", "Copy", "Provenance and sharing caution"]) assert.ok(library.includes(phrase));
  assert.match(library, /alt=\{reference\.alt\}/);
  assert.match(library, /colour\.hex/);
  assert.match(library, /navigator\.clipboard/);
});

test("selecting a bundled reference stays behind the Visual Bible approval boundary", async () => {
  const library = await source("app/visual-reference-library.tsx");
  for (const phrase of ["Open in Visual Bible proposal", "The canonical project and bundled image remain unchanged", "no AI call was made", "Reference selection is a reviewable proposal", "Bundled imagery is not copied into the canonical project"]) assert.ok(library.includes(phrase));
  assert.match(library, /createSpecialistSuggestion/);
  assert.doesNotMatch(library, /onProjectChange/);
});

test("reference proposals support selective palette, ingredients and project scope", async () => {
  const library = await source("app/visual-reference-library.tsx");
  for (const scope of ["project", "character", "location", "block", "mini-block"]) assert.ok(library.includes(`value=\"${scope}\"`) || library.includes(`\"${scope}\"`));
  for (const phrase of ["selectedColours", "selectedIngredients", "writerNote", "scope", "targetId"]) assert.ok(library.includes(phrase));
});

test("Mood Colour and Visual Language learning opens the reference workflow without copying", async () => {
  const learning = await source("app/learning-mood-colour-visual-language.ts");
  for (const phrase of ["Mood, Colour and Visual Language", "Mood is the audience", "palette is a starting set", "Repetition with variation", "Reference, project asset and generated asset", "three colours", "what should not be copied"]) assert.ok(learning.includes(phrase));
  const studio = await source("app/learning-studio.tsx");
  assert.match(studio, /moodColourVisualLanguage/);
});

test("the reference library is static and offline with no AI, account or remote image dependency", async () => {
  const library = await source("app/visual-reference-library.tsx");
  assert.match(library, /\/visual-references\/manifest\.json/);
  assert.doesNotMatch(library, /https?:\/\//);
  assert.doesNotMatch(library, /\/api\/local-ai/);
  assert.doesNotMatch(library, /sign in|account required/i);
});
