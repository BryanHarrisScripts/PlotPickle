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

## Phase B — imported screenplay observations

The original brief's **Observed** state remains valid product direction, but it cannot be honestly displayed by the live modular BUILD yet.

The current modular `PPFProject` has Foundations, World, learning state, Creative Room state, and BUILD artifacts. It does not currently carry the legacy screenplay import evidence (`draftElements`, block assignments, import review state). The existing Final Draft/Fountain screenplay importer still targets the legacy `lib/projects` project model and is not mounted by the current Library/BUILD route.

Therefore the corrective implementation must not fabricate an Observed state or copy the legacy project into BUILD.

A subsequent modular import bridge must:

1. expose imported source evidence through the current canonical PPF/import contract;
2. preserve source provenance and review status;
3. keep direct observations separate from inferred story decisions;
4. avoid marking LEARN lessons complete;
5. feed the same live BUILD evidence surface;
6. migrate useful parser capability rather than creating a second importer.

Issue #1338 remains open until that Phase B path is implemented and verified.

## Verification contract

The corrective tests must prove all of the following:

- `app/page.tsx` mounts `FoundationsBuildWorkspace` for `workspace=build`;
- `FoundationsBuildWorkspace` mounts the Story Coverage component;
- coverage uses current canonical PPF Foundations answers/proposals;
- Defined, Emerging, and Missing remain distinct;
- course completion and generated images cannot inflate Story Coverage;
- the obsolete BUILD model no longer contains the #1339 evidence implementation;
- existing Foundations BUILD visual-workshop behavior still passes;
- production build passes;
- exact-head GitHub Actions remain authoritative.
