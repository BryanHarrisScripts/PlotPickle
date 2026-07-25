# Issue 57 — Offline Visual Reference Library

## Exact legacy inventory

The legacy README described the collection as approximately 63 boards. The reproducible filesystem scan found exactly 62 PNG mood boards.

- Source PNG boards: 62
- Retained boards: 62
- Generalized named-film boards: 3
- Omitted boards: 0
- Replacement boards: 0
- WebP derivatives: 186
- Missing manifest entries: 0
- Duplicate IDs: 0
- Zero-byte outputs: 0
- Conversion failures: 0
- Original PNG bytes: 129,425,194
- Converted WebP bytes: 33,558,852
- Size reduction: 74.07%

The original PNG files remain untouched in the private `BryanHarrisScripts/24-Blocks-OpenStoryStudio` archive. PlotPickle contains only optimized derivatives and reviewed metadata.

## Derivative strategy

Each retained board has:

- a full WebP preserving original aspect ratio;
- a card WebP with a maximum 960-pixel longest edge;
- a thumbnail WebP with a maximum 480-pixel longest edge.

The local Sharp pipeline applies rotation metadata, prevents upscaling, strips unnecessary metadata and uses quality settings of 86, 84 and 82 for full, card and thumbnail derivatives.

## Naming and rights review

Timestamped DALL·E filenames are preserved only in internal source metadata. Application assets use stable semantic slugs.

Three boards that named films were reframed:

- `Blade Runner 2049` → `Rain-Soaked Futuristic Noir`
- `Amélie` → `Whimsical Saturated European Romance`
- `The Grand Budapest Hotel` → `Symmetrical Pastel Heritage Hotel`

They are presented as general visual ingredients, never as official film presets. Every manifest entry identifies the legacy archive, original filename, recovered prompt, generated-image status and distribution-review caution.

## Static manifest

`public/visual-references/manifest.json` contains:

- semantic ID and title;
- summary, category, tags and meaningful alt text;
- full, card and thumbnail paths and source dimensions;
- five starting palette colours with approximate proportions;
- contrast, saturation, lighting, texture, geometry and camera observations;
- emotional effect and useful-for labels;
- cliché/copying caution;
- source repository, filename, prompt and rights note.

Palette values are starting points produced through quantized analysis, not a scientific or final production colour grade.

## Product boundary

Visual Bible & Mood Boards now has two explicit modes:

- Project Mood Board — existing character, location and storyboard assets owned or attached by the writer;
- Reference Library — bundled offline inspiration assets supplied with PlotPickle.

Opening or selecting a reference does not:

- copy its pixels into the project;
- claim it as a project-owned asset;
- change the project palette or visual language;
- alter characters, locations, Blocks, mini-blocks or storyboards;
- make an AI request.

The writer selects palette values, lighting, texture, geometry and camera ingredients; chooses project, character, location, Block or mini-block scope; adds a writer note; and opens a normal Visual Bible specialist proposal. Only explicit approval updates `world.visualLanguage` and creates the existing specialist-pass revision record.

## Search, filtering and performance

The static local library supports:

- free-text search across title, summary, category, tags, emotional effect, lighting, texture, geometry, camera feel and hex values;
- category filters;
- warm, cool, muted, high-saturation, monochrome, low-key, high-key, natural, practical and atmospheric filters;
- cinematic, sketch, watercolour, symmetrical, minimal, ornate and surreal treatment filters;
- title, category and recently viewed sorting;
- lazy-loaded thumbnail and card WebPs;
- keyboard-selectable cards with selected-state semantics;
- reduced-motion handling;
- colour labels and hexadecimal values rather than colour-only communication.

No account, AI provider or internet connection is required.

## Learning integration

The focused `Mood, Colour and Visual Language` deep dive teaches mood versus tone, palette versus colour grade, hue/value/saturation/contrast, contextual colour meaning, lighting, texture, shape, composition, camera feel, repetition with variation, opening/closing images and the distinction among references, project assets and newly generated assets.

Its exercise asks the writer to choose separate references for emotional atmosphere, world texture and lighting/camera feel; select three colours; identify one changing visual element; and open an editable Visual Bible proposal.

## Project-format compatibility

PlotPickle schema 1.7 remains unchanged. Reference choices travel through existing specialist-pass and revision-snapshot records. The pass preserves the reference ID, title, selected colours, selected ingredients, scope, target, writer note and source provenance, so the creative decision remains understandable even if a later installation does not include the bundled image.

## Validation

Regression tests verify inventory counts, manifest completeness, missing files, zero-byte assets, duplicate IDs, three WebP variants, film-title generalization, alt text, palette labels, search/filter controls, offline paths, selective application, provenance, approval boundaries and learning integration.
