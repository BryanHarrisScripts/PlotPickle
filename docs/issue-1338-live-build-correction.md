# Issue #1338 — live BUILD correction

## Why the issue was reopened

PR #1339 added visible story-evidence UI to `app/build-health-map.tsx` and evidence derivation to `modules/build/build-workspace-model.ts`.

Real-machine verification showed that this was not the BUILD screen reached through the current application shell. The live route is:

```text
app/page.tsx
  -> ?workspace=build
  -> modules/build/ui/foundations-build-workspace.tsx
  -> current core PPFProject
```

The older `app/build-workspace.tsx` / `app/build-health-map.tsx` surface remains legacy migration source and is not the current modular product route. New #1338 behavior must therefore live in the modular BUILD feature and read the current core PPF.

## Architecture correction

The accepted modular-foundation rule remains authoritative:

```text
app shell
  -> core contracts / canonical PPF
  -> feature modules
  -> adapters
```

The correction does not add another project model, database, graph, or cross-feature state store.

The #1339 evidence additions to the legacy BUILD model are removed. The live Foundations BUILD now derives story coverage directly from `PPFProject.foundations` through a module-owned read-only projection.

## Phase A — visible current-PPF coverage

The live Foundations BUILD shows three evidence states that the current modular PPF can prove today:

- **Defined** — a usable Human-approved PLAN answer is saved in the canonical PPF.
- **Emerging** — a usable draft proposal exists, but it has not become a saved story decision.
- **Missing** — neither a usable saved answer nor a usable proposal supports the decision.

Story Coverage is deterministic:

```text
defined Foundations decisions / expected Foundations decisions
```

Emerging proposals do not raise the score. LEARN completion and generated wireframe frames do not raise the score. BUILD remains a view over canonical project state and does not silently turn generated visuals into story truth.

## Phase B — Library-owned screenplay import observations

The original brief's **Observed** state remains valid product direction, but the missing implementation belongs to **Library**, not BUILD.

The current modular `PPFProject` has Foundations, World, learning state, Creative Room state, and BUILD artifacts. It does not currently carry the legacy screenplay import evidence (`draftElements`, block assignments, import review state). The existing Final Draft/Fountain screenplay importer still targets the legacy `lib/projects` project model and is not mounted by the current Library route.

The ownership rule is:

```text
LIBRARY
  -> import Final Draft / Fountain / screenplay
  -> convert into current modular PPF
  -> preserve direct source evidence + provenance + review status
  -> persist as a normal Library story

BUILD
  -> open the already-canonical PPF
  -> read preserved screenplay evidence
  -> render direct imported evidence as Observed
  -> render importer interpretation as Emerging
```

BUILD must not own file import, parser lifecycle, or conversion into PPF. It consumes the result.

The Library import bridge must:

1. expose Final Draft/Fountain import from the current Library surface;
2. migrate/reuse useful parser capability rather than creating a competing importer;
3. create a current modular `PPFProject`, not a legacy `lib/projects` project;
4. preserve direct source evidence, source format/file identity, block/scene linkage where available, and import review status;
5. keep direct observations separate from inferred story decisions;
6. never mark LEARN lessons complete merely because a screenplay was imported;
7. persist the imported project through the same profile-owned Library authority as native stories;
8. feed the same live BUILD evidence surface after the imported story is opened.

Issue #1338 remains open until that Library-owned Phase B path is implemented and verified.

## Library archive lifecycle

Library also owns reversible story archiving:

- the `...` menu on a real story card can archive it;
- archive is metadata on the same canonical project registry, not a copied PPF;
- archived stories leave the active Library shelf and appear under Archive → Stories;
- Settings links to the same Archive surface/data rather than owning another archive list;
- restore returns the same project to Library;
- if no active stories remain, Library shows one non-persisted ghost/coming-soon card rather than creating a fake project;
- archive remains distinct from destructive deletion.

## Verification contract

The corrective tests must prove all of the following:

- `app/page.tsx` mounts `FoundationsBuildWorkspace` for `workspace=build`;
- `FoundationsBuildWorkspace` mounts the Story Coverage component;
- coverage uses current canonical PPF Foundations answers/proposals;
- Defined, Emerging, and Missing remain distinct;
- course completion and generated images cannot inflate Story Coverage;
- Library owns Final Draft/Fountain import and current modular PPF conversion;
- imported direct evidence survives Library persistence and becomes BUILD `Observed` evidence;
- imported suggestions remain `Emerging` until reviewed;
- screenplay import does not mark curriculum lessons complete;
- Archive/Restore use the same profile-owned Library registry without copying projects;
- Settings and Library read the same Archive data;
- zero active Library stories renders a non-persisted ghost card;
- the obsolete BUILD model no longer contains the #1339 evidence implementation;
- existing Foundations BUILD visual-workshop behavior still passes;
- production build passes;
- exact-head GitHub Actions remain authoritative.
