# Issue #167 — Navigation and automatic AI comic Pitch

## Product contract

The primary workflow has exactly ten steps:

1. Dashboard
2. Learn
3. Plan
4. Storyboard
5. Write
6. Pitch
7. Build
8. Feedback
9. Refine
10. Reports

The first six belong to **Discovery & Pre-Production**. The final four belong to **Production & Polishing**. Project actions and Settings remain utilities outside that sequence.

Settings is grouped as Workspace, Integrations, Data Storage and Security. The destinations and their order match the product brief exactly.

## Comic Pitch model

The deck lives at `project.review.pitchPackage.comicDeck`; it is not a second story model. A plan contains 24 pages with four panels each, mapping Block 1–24 and mini-block 1–4 directly to all 96 canonical story positions.

Each panel records:

- its Block and mini-block;
- canonical or explicitly marked derived narration;
- editable dialogue linked to screenplay elements where possible;
- characters, locations and directed shot;
- the image prompt and local generated-asset reference;
- generation status, provider, model and timestamp.

Interrupted `generating` state normalizes to a resumable paused deck. Older projects receive a blank deck during normalization, and `comicDeck` remains optional in the raw 1.7 schema so existing files still validate.

## Generation boundary

Complete generation never starts implicitly. The writer must:

1. connect and verify an image-capable provider;
2. lock every recurring character identity used by the deck;
3. review the 96-panel preflight;
4. acknowledge that the run may make up to 96 paid image API calls;
5. choose Generate.

The client saves after each panel. A writer can pause, resume only incomplete panels, retry failures, or regenerate one panel. Three consecutive provider errors pause the batch without discarding completed work.

Approved character references are sent only to the private local AI gateway. OpenAI generation with references uses the Images edit endpoint; the project stores local asset paths and non-secret provenance, never API credentials.

## Visual and dialogue rules

Prompts request black-and-white graphite-and-ink comic panels with directed cinematic composition. They explicitly exclude words, letters, captions and speech balloons because image models do not reliably preserve exact text.

Canonical screenplay dialogue is placed above the art as editable HTML speech balloons. This makes text correctable, selectable, accessible and exportable without regenerating pixels.

## Export

The deck exports as a self-contained landscape HTML document. Local panel images are embedded as data URLs, dialogue remains real text and print CSS supports Save as PDF. Missing panels are identified rather than hidden.

## Verification

`tests/issue-167-navigation-ai-pitch.test.mjs` protects:

- the exact ten-step navigation and two group boundaries;
- the exact four-group Settings structure;
- 24 × 4 canonical panel planning;
- directed shots and approved identity references;
- explicit cost consent, pause/resume/retry behaviour and incremental saves;
- editable HTML dialogue, portable export and non-secret provenance;
- OpenAI multi-reference edit requests and schema migration.
