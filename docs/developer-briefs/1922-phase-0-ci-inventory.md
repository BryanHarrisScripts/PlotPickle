# #1922 Phase 0 — CI Inventory and Measurement

## Scope

Phase 0 does not change required checks. It records what the two normal gates currently do, what the work costs, where verification ownership is mixed or duplicated, and which specialized workflows may already own reusable evidence.

Machine-readable inventory: `config/verification/phase-0-inventory.json`.

## Stable future check names

The future seven visible PR checks are:

- `Layer 1 Experience Skins`
- `Layer 2 Experience Contract`
- `Layer 3 Production Orchestration`
- `Layer 4 Agent & Skill Mesh`
- `Layer 5 Story / Canon / Evidence`
- `Layer 6 Provider Runtime`
- `Layer 7 Validation & Operations`

These display names map to the seven canonical IDs in `architecture/plotpickle.architecture.json`. They do not replace the old two gates during Phase 0.

## Measured normal-gate cost

The inventory uses exact-head green runs from commit `daaff1d422cc89a7ad799848807f5417cbb82e31`.

### PR Gate

Run `34691257098` completed in about **63 seconds**.

The main measured costs were dependency setup, core auth/storage (~12s) and the web build (~18s). Most deterministic contract checks completed in 0-2 seconds at GitHub's timestamp resolution.

### Product Gate

Run `34691257033` completed in about **7m59s**.

The two dominant steps were:

| Step | Approx. time | Provisional owner | Recommendation |
| --- | ---: | --- | --- |
| Pi 0.85.1 managed compatibility | 2m37s | Layer 4 Agent & Skill Mesh | impact/release selected |
| whisper.cpp native smoke | 3m47s | Layer 6 Provider Runtime | impact/release selected |
| Combined | **6m24s** | — | roughly 80% of Product Gate |

The same Product Gate spent only about 1s each on Skin startup, security-closeout and local-video contracts, ~12s on focused UAT contracts, ~20s on the Windows build, and ~1s on the installer source contract.

This is strong evidence that the largest performance win does not require weakening verification. It requires running expensive proof when the architecture boundary actually changes.

## Duplicate execution found

Two clear duplicates exist today:

- current security-closeout tests run in both PR Gate and Product Gate;
- bundled local-video tests run in both PR Gate and Product Gate.

These are not automatically deleted. Phase 1+ must identify the authoritative owner and any genuine platform-specific reason for repetition before duplicate execution is removed.

## Mixed-owner bundles found

Several current steps combine different architectural responsibilities:

### Experience architecture boundary
The current PR Gate command mixes semantic Experience contracts, Skin/WebMCP source contracts and provider/local-video checks. It should eventually split into owned catalog entries rather than remain one opaque command.

### Security closeout
The current bundle spans production authority, auth/storage/credential boundaries, developer/MCP process boundaries and verification hardening. Security remains cross-cutting, but the individual tests need primary architecture owners.

### Focused UAT contracts
The UAT harness itself belongs to Layer 7. The contracts it executes should be cataloged under the product layers they observe. This lets the harness remain reusable without making Layer 7 own the entire product.

## Runtime evidence lesson from Profile

#1920 and #1923 give two complementary examples.

#1920 showed **verification drift**: static gates were green while the live WebMCP verifier still expected the removed Profile hierarchy.

After that drift was repaired, the next live WebMCP run reached the real Profile surface and found a genuine **rendered presentation defect**: five configuration controls measured 25.25px while the Skin token requires at least 34px.

That second defect is tracked in #1923 and belongs to `Layer 1 Experience Skins`.

The future selection rule should therefore be deterministic:

`Skin / surface / visual-token / WebMCP-verifier change -> live WebMCP evidence`

Static source-contract tests remain useful, but they are not a substitute for observing a rendered boundary when rendered behavior is what the contract protects.

## Specialized workflows already present

The repository already has specialized workflows such as `visual-readiness.yml`, `writer-e2e-observer.yml`, `full-verification-synthetic-human.yml`, `windows-installer.yml`, `hardware-aware-local-ai.yml`, `pi-managed-install.yml`, `learn-validation.yml`, `plotpickle-auth.yml`, `profile-private-storage.yml`, `repository-architecture-inventory.yml`, `runtime-weight-inventory.yml` and `uat-repair-handoff.yml`.

This is important for scalability. The seven-layer mesh should coordinate or reuse existing evidence rather than recreate every test inside a new monolithic workflow.

Phase 1 should determine which specialized workflows become catalog-owned executors, which remain release/manual workflows, and which are redundant after the verification core exists.

## Provisional ownership summary

Layer 1 owns Skin rendering, visual token conformance, visual readiness and rendered observers.

Layer 2 owns semantic Experience intents, topology, routing, keyboard/navigation and skin-neutral client contracts.

Layer 3 owns Human/profile/project authority, auth/session/storage, trust, consent, connector/egress and credential boundaries.

Layer 4 owns Agents, Skills, Agent Plugins, Pi/Cline worker contracts and Agent harness behavior.

Layer 5 owns story/canon/evidence, Sequence Evidence, curriculum integrity and other deterministic durable knowledge boundaries.

Layer 6 owns provider/native runtime such as local AI, video, ComfyUI, voice and whisper.cpp.

Layer 7 owns verification infrastructure, convergence, evidence, builds, packaging/release and CI architecture—not every product test simply because CI runs it.

## Phase 0 conclusion

The two-gate model is not mainly slow because PlotPickle has too many valuable tests. It is slow because unrelated evidence is serialized under generic gates and expensive runtime proof is unconditional.

The evidence supports proceeding to Phase 1 with no reduction in confidence:

- retain cheap deterministic baselines;
- give every test one primary architecture owner;
- split mixed bundles;
- deduplicate only after equivalence proof;
- impact-select expensive browser/native/provider proof;
- reuse existing specialized workflows;
- fail closed on unknown production ownership;
- keep the old gates authoritative until seven-layer shadow checks prove equal or stronger coverage.
