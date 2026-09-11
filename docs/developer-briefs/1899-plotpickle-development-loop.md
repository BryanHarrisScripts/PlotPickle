# Developer Brief — #1899 PlotPickle Development Loop

## Goal

Adopt a small PlotPickle-native spec-driven development loop inspired by GitHub Spec Kit while preserving PlotPickle's existing development authorities.

Canonical loop:

`IDEA -> ASSESS -> DEVELOPER BRIEF -> ISSUE -> PLAN -> BUILD -> TEST/FIX -> CONVERGE -> PR GATES -> MERGE`

## Existing owners to preserve

- `AGENTS.md` remains the project development constitution.
- GitHub Issues remain the Human-visible work tracker.
- `docs/developer-briefs/` remains the bounded change-specification location.
- Pi/Cline and Agent Skills remain worker/procedure layers under repository rules.
- focused UAT remains product evidence.
- PR Gate and Product Gate remain independent deterministic merge gates.
- `config/third-party-oss.json` remains the canonical OSS/influence registry.

## What to build

### 1. Development-loop architecture note

Document the canonical loop and explain when lightweight assessment/brief/convergence artifacts are appropriate.

### 2. Deterministic convergence evaluator

Add one repository-native script that can:

- load a convergence manifest;
- validate manifest structure;
- verify the developer brief exists;
- verify every acceptance criterion has declared evidence;
- verify declared evidence exists and, where requested, contains an expected contract string;
- compare actual changed files with the manifest's allowed change scope;
- report unrelated changes;
- emit deterministic JSON with `CONVERGED` or `NOT_CONVERGED`;
- write CI evidence under `.artifacts/development-convergence/`;
- never modify source files or create tasks.

The evaluator may inspect Git using `execFile`/`execFileSync` with `shell: false`; it must not run arbitrary manifest-provided commands.

### 3. CI integration

PR Gate should run convergence before the production build. The default changed-manifest mode should evaluate only convergence manifests introduced/changed by the current PR so historical manifests do not re-evaluate against unrelated future diffs.

A PR with no changed convergence manifest is not automatically a failure; tiny changes remain allowed. `AGENTS.md` defines when non-trivial work should carry a convergence manifest.

### 4. OSS attribution

Record GitHub Spec Kit as a `reference-only` methodology influence under its MIT licence. The architecture note must contain the repository's `PLOTPICKLE:OSS-INFLUENCE:<id>` marker so the existing OSS audit can verify the attribution.

Do not install Spec Kit, run `specify init`, copy its templates, or add it as a product/developer dependency.

## Convergence manifest contract

Schema version 1:

```json
{
  "schemaVersion": 1,
  "issue": 1899,
  "brief": "docs/developer-briefs/1899-plotpickle-development-loop.md",
  "allowedChanges": ["exact/file", "directory/prefix/"],
  "acceptance": [
    {
      "id": "A1",
      "criterion": "Human-readable criterion",
      "evidence": [
        { "type": "file-contains", "path": "path/to/file", "contains": "stable contract text" }
      ]
    }
  ]
}
```

Supported evidence types for the first implementation:

- `path-exists`
- `file-contains`

The evaluator checks evidence deterministically. It does not ask an LLM whether a criterion is complete.

## Result contract

A report contains:

- schema version;
- issue number;
- manifest/brief path;
- status: `CONVERGED | NOT_CONVERGED`;
- changed files;
- unrelated files;
- per-criterion evidence results;
- concise remaining items.

Do not include hidden reasoning, credentials, full prompts or unrelated repository content.

## Tests

Prove at minimum:

1. a complete synthetic manifest converges;
2. missing evidence produces `NOT_CONVERGED`;
3. an unrelated changed file produces `NOT_CONVERGED`;
4. unsupported evidence types fail closed;
5. the architecture note defines the canonical loop and independence rule;
6. `AGENTS.md` points non-trivial changes at the convergence process;
7. PR Gate invokes changed-manifest convergence;
8. GitHub Spec Kit is registered as a reference-only MIT influence and acknowledged publicly.

## Non-goals

- no `.specify/` directory;
- no Spec Kit CLI dependency;
- no duplicate task database;
- no replacement of GitHub Issues;
- no replacement of tests/UAT/build gates;
- no LLM self-certification;
- no mandatory heavyweight spec for tiny fixes;
- no source mutation during convergence.

## Acceptance

- the canonical PlotPickle Development Loop is documented;
- convergence is deterministic, bounded, machine-readable and CI-rerun;
- missing/stale evidence and unrelated scope fail closed;
- existing PR/Product gates remain unchanged in authority;
- Spec Kit is attributed truthfully as reference-only methodology;
- focused regression and both CI gates are green before merge.