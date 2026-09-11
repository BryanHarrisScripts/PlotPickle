# Sequence Evidence — deterministic verification for 24 / 96 / 2,400

## Decision

Sequence Evidence is one bounded evidence layer under the existing Sequence Director:

```text
PLAN -> STORYBOARD -> PREVIS -> RENDER PLAN -> GENERATE
                                                |
                                                v
                                      SEQUENCE EVIDENCE
                                      ANALYZE -> COMPARE
                                             -> FINDINGS
                                             -> HUMAN REPAIR / APPROVE
```

It does not own story canon, Storyboard, Previs, creative Production Shots, the technical render grid, generation providers, approval, or repair authority.

The evidence discipline is:

```text
code measures objective facts
model annotates only bounded visual facts
code compares both with approved PlotPickle intent
```

This methodology was inspired by the Apache-2.0 `eternityspring/reelbench-skills` project. PlotPickle's implementation is native code; no ReelBench source code, demo media, or report assets are copied in this implementation.

## Canonical owners reused

### Creative shots

`core/contracts/previs/index.ts` owns `ProductionShotIntent`.

Creative shot count remains variable. Sequence Evidence only references Production Shot IDs and their current Storyboard dependency keys.

### Technical render addresses

`core/contracts/previs/index.ts` owns `RenderClipSlot` and `renderClipSlotsForAnchor()`:

- 3 seconds per technical clip;
- 25 clips per Mini-Block;
- 75 seconds per Mini-Block;
- 2,400 derived technical addresses for the two-hour preset.

Sequence Evidence consumes these addresses. It never materializes another 2,400-address database and never interprets 25 technical clips as 25 creative shots.

### Generated media and provenance

`lib/projects/persistence/project-assets.ts` is the canonical generated-media identity/provenance store.

Sequence Evidence reads `ProjectAssetRegistry` / `ProjectAssetVariation` information including:

- stable asset + variation identity;
- source / portable path;
- content/source fingerprint;
- media type;
- provider/model;
- generation timestamp;
- provenance IDs;
- Human approval state;
- bounded variation extensions such as a generation base revision when supplied by the generation route.

`VisualMediaVersion` and older `lib/video-production.mjs` records remain compatibility inputs. They are not promoted into a second Sequence Evidence media authority.

### Current revision

`lib/projects/persistence/project-revisions.ts` remains the current PPF revision owner. Sequence Evidence compares output generation revision/provenance with the current revision and the Production Shot Storyboard dependency. Stale media remains inspectable but cannot certify current intent.

### Cinematography intent

`lib/cinematography-grammar.ts` and the existing Sequence Director cinematography compiler remain the vocabulary owner. Sequence Evidence reuses reviewed camera-movement primitives and applies a deliberately one-sided contradiction rule.

### Autonomous QA

The existing `AutonomousQaFinding` shape remains the downstream QA handoff. Sequence Evidence findings can be projected into that format; autonomous QA does not become Evidence authority and cannot self-certify a repair.

## Machine evidence and annotation are separate

`core/contracts/sequence-evidence/index.ts` keeps machine evidence and model annotation as different immutable objects.

Machine-owned facts include source identity/hash, duration, dimensions, frame rate, codec/container, measured motion, A/B frame refs, canonical render address, revision/provenance refs, analyzer identity/version, and measurement state.

The first model vocabulary is intentionally small:

- shot size;
- shot category;
- camera movement;
- concise visible description;
- bounded continuity observation.

Annotation cannot supply or replace timing, addresses, hashes, machine measurements, project revision, or generation provenance.

## Local media measurement boundary

PlotPickle already has an optional Lazy Frames managed-tool path whose doctor checks ffmpeg readiness, but the repository did not have a canonical ffprobe owner.

`lib/sequence-evidence-media-probe.mjs` therefore provides the minimal reviewed measurement adapter:

- local files only;
- `spawn(..., { shell: false })`;
- fixed ffprobe/ffmpeg argument grammar;
- bounded runtime and captured output;
- optional explicit `PLOTPICKLE_FFPROBE_PATH` / `PLOTPICKLE_FFMPEG_PATH` overrides;
- SHA-256 source identity;
- ffprobe metadata measurement;
- representative non-edge A/B frame times;
- optional bounded A/B JPEG extraction;
- normalized 64x36 grayscale A/B frame difference for motion evidence;
- no npm install, binary download, provider request, or cloud fallback.

If ffprobe/ffmpeg is missing, Sequence Evidence reports `unavailable`. It does not silently install tooling or treat a skipped check as a pass.

Lazy Frames remains a separate optional animatic tool; Sequence Evidence does not depend on installing it.

## VERIFY mode

For one selected Mini-Block:

1. derive the canonical 25 `RenderClipSlot` addresses;
2. bind actual generated media to those addresses through current project assets/provenance;
3. measure available local media;
4. optionally attach bounded model annotation;
5. run deterministic gates;
6. emit exact-address findings and a compact A/B review index.

Generated media cannot replace or renumber canonical RenderClipSlot addresses.

## CONTINUITY mode

Continuity uses exact address lineage:

```text
C01-B -> C02-A
C02-B -> C03-A
...
C24-B -> C25-A
```

A claimed continuity pass requires the exact prior-end and next-start evidence refs. Missing neighboring output or missing boundary evidence is not fabricated.

The Mini-Block report's compact `contactSheet` array is the first PlotPickle-native lazy review representation: address + A + B refs. A UI can render these thumbnails without loading all 25 full-resolution videos.

## REFERENCE mode

REFERENCE mode accepts measured source identity/duration plus deterministically discovered shot boundaries. It reports factual statistics such as shot count, average/median duration and cuts per minute.

The report hard-codes `canonAuthority: false`. It has no PPF mutation input and no route that imports story, dialogue, characters, or extracted frames into accepted canon.

Unknown reference media may use boundary detection because its shot structure is unknown. PlotPickle-generated media may not use detected cuts to replace the canonical render grid.

## Gate contract

| Gate | Deterministic rule |
| --- | --- |
| G1 Address coverage | Required canonical output exists; noncanonical claimed addresses fail. |
| G2 Duration | Measured technical clip duration agrees with canonical 3-second timing within reviewed tolerance. |
| G3 Mini-Block coverage | 25 canonical technical clips prove 75 seconds of technical coverage; this says nothing about creative shot count. |
| G4 Machine integrity | Normalized machine evidence is immutable and structurally separate from annotation. |
| G5 A/B evidence | Required A/B refs exist or the check is explicitly skipped/unavailable; placeholders are never invented. |
| G6 Camera motion | Meaningful camera movement + near-zero measured motion may block. Static + high image change is advisory only. |
| G7 Continuity | Exact N-B -> N+1-A lineage must exist for a claimed handoff pass. |
| G8 Revision/provenance | Current certification requires compatible generation base revision and Storyboard dependency. |
| G9 Annotation schema | Optional annotation must use reviewed bounded vocabulary. |
| G10 No silent skip | Unavailable/skipped measurement is never converted into `passed`. |

## One-sided motion rule

Pixel change can contradict an expected meaningful camera move when virtually nothing changes. It cannot prove that a supposedly static camera moved, because actors, props, lighting, effects or the environment can produce large pixel change under a locked camera.

Therefore:

```text
move expected + near-zero change -> blocker candidate
static expected + high change    -> advisory only
```

A false deterministic blocker is worse than an explicit advisory.

## Findings and repair

A finding carries the mode, current project revision, Block/Mini-Block, Production Shot when available, exact render address/address pair, expected/observed/measurement/annotation refs, gate/version, severity, blocker/advisory classification, analyzer provenance, optional model provenance and disposition.

Sequence Evidence can recommend repair or regeneration but cannot:

- mutate PPF;
- approve media;
- select a provider;
- spend money;
- silently regenerate outputs;
- mark its own repair successful.

After a repair, new output must be remeasured and the same deterministic gates rerun.

## Scale boundary

Evidence is lazy and selected-unit scoped. PlotPickle does not create 2,400 empty evidence records and does not scan media at core startup.

Normal units of work are one creative shot, one Mini-Block, one Sequence, or an explicitly requested batch.
