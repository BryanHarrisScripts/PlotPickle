# Developer Brief — #1908 DraftLens Reader Simulation Harness

## Purpose

Upgrade PlotPickle's existing **Fresh Reader Specialist** into a **Reader Simulation Harness owned by DraftLens**.

This is not a new standalone reader agent and not a second review architecture. It is an upgrade of the existing Fresh Reader capability so DraftLens can collect first-read evidence under enforced no-lookahead conditions before diagnosis begins.

The governing product decision is:

`Fresh Reader Specialist -> Reader Simulation Harness -> owned/orchestrated by DraftLens`

For PlotPickle's normalized feature profile, the canonical deterministic review boundary is the existing **Story Block**:

`24 Story Blocks x approximately 5 screenplay pages = approximately 120 pages`

The Block is the durable evaluation/persistence address. Inside the Block, reader exposure remains incremental and blind.

## Product rationale

PlotPickle already has the major architectural pieces needed for this capability:

- `24 Story Blocks -> 96 Mini-Blocks` as stable narrative coordinates;
- PPF as the project/canon authority;
- DraftLens as the whole-draft review and diagnosis engine;
- a registered Fresh Reader Specialist;
- a first-response-before-repair review philosophy;
- deterministic structural evidence through PlotPickle Score.

The missing layer is an enforceable reader-experience protocol.

A conventional LLM review normally receives the entire screenplay at once. That makes it impossible to know whether a reaction to page 10 was influenced by knowledge from page 90. Asking the model to "pretend you have not read ahead" is not sufficient because the future text remains present in context.

The Reader Simulation Harness solves that by controlling what evidence is released and when.

The aim is not to claim that an LLM becomes a Human reader. The aim is narrower and testable: create a bounded simulation in which the reviewer cannot access future screenplay evidence through the harness, then preserve its sequential reactions as review evidence.

## Architectural ownership

### Fresh Reader Specialist

The existing Fresh Reader Specialist remains the reader-facing capability and advisory persona contract.

Its responsibilities expand from a prompt/procedure into a harness-backed review capability that can:

- receive only the currently permitted screenplay evidence;
- record immediate response before diagnosis;
- maintain reader memory/state across Blocks;
- stop reading;
- participate in recall without reopening the screenplay;
- preserve identity across revision comparisons.

Do not register a second overlapping `First Reader`, `Beta Reader`, or equivalent standalone agent.

### DraftLens

DraftLens owns/orchestrates the Reader Simulation Harness because reader experience is evidence for whole-draft diagnosis.

DraftLens responsibilities:

- start and identify a reader run;
- select reader profile(s);
- invoke the sequential feed;
- persist raw reader observations;
- preserve the boundary between observation and diagnosis;
- perform diagnosis only after relevant blind-read evidence exists;
- compare reader behavior between revisions;
- present reader evidence alongside other DraftLens lenses.

DraftLens must not preload its diagnosis, future story metadata, or hidden future PPF fields into the reader context.

### PPF

PPF remains canon authority.

Reader simulation configuration and observations are review/development evidence. They do not silently change:

- Story Blocks;
- Mini-Blocks;
- character canon;
- ending;
- Pickle Turns;
- screenplay text;
- any Human-approved story decision.

Any move from review evidence into canon/revision data requires explicit Human action through existing PlotPickle authority boundaries.

## Canonical review boundary

### Block is the deterministic unit

For the default feature profile, PlotPickle already defines a 5-minute Story Block region. For the common screenplay approximation, this corresponds to roughly five screenplay pages.

The harness therefore uses the Story Block as the canonical:

- evaluation boundary;
- persistence address;
- comparison coordinate;
- evidence grouping unit;
- DraftLens navigation unit.

Do not create a parallel `reader chunk`, `chapter`, or arbitrary token-window coordinate that competes with Story Block identity.

### Exposure inside the Block

The Block is the storage/evaluation boundary, but it is not necessarily delivered to the reader in one payload.

The reader should encounter the Block sequentially.

Preferred exposure source order:

1. reliable rendered screenplay page boundaries, if available;
2. ordered screenplay scenes/passages already mapped to the Block;
3. Mini-Block-aligned material as a structural fallback.

The feed must release only the next permitted segment.

Example:

`Block 07`

`page/segment 31 -> reaction -> page/segment 32 -> reaction -> page/segment 33 -> reaction -> page/segment 34 -> reaction -> page/segment 35 -> Block summary`

The exact internal segment size may vary with available screenplay evidence, but the persisted result remains attached to Block 07.

## Determinism definition

The phrase **deterministic reader review** must be used carefully.

PlotPickle does not claim that a generative model will produce identical subjective prose on every run.

The deterministic parts are:

- Story Block identity and order;
- permitted exposure order;
- no-lookahead access rules;
- feed state transitions;
- required evidence fields;
- quit/continue semantics;
- recall isolation;
- persistence shape;
- run identity and source fingerprint;
- provider/runtime metadata capture;
- revision-comparison coordinate rules;
- canon non-mutation rules.

Reader reactions are **observational evidence produced inside a deterministic protocol**.

This distinction must be preserved in code, tests, UI copy, and documentation.

## No-lookahead contract

No-lookahead must be enforced by mechanism, not prompt wording.

When the reader is working inside Block N, it may receive only:

- story/screenplay material it has already encountered from Blocks 01..N-1;
- its own prior notes or compact reader-memory state;
- the next permitted segment inside Block N;
- its persona/profile and output contract.

The reader must not receive:

- full PPF project serialization;
- full screenplay text;
- Block N+1 or later screenplay text;
- future Pickle Turns;
- future audience-expectation fields;
- future character outcomes;
- ending metadata not yet encountered;
- future DraftLens notes/diagnosis;
- future setup/payoff resolution records;
- structural summaries that reveal unreached events.

If implementation convenience requires project access at the orchestrator level, the orchestrator must explicitly construct a bounded reader payload rather than handing the entire project object to the reader model.

## Reader run state model

Recommended run states:

- `created` — run identity/config exists;
- `reading` — reader is inside the sequential feed;
- `quit` — reader voluntarily stopped; no later screenplay content may be released to that reader;
- `completed` — reader reached the end of permitted screenplay evidence;
- `recall` — recall is being collected from transcript/state only;
- `ready_for_diagnosis` — raw reader evidence is sealed and DraftLens may diagnose;
- `diagnosed` — DraftLens diagnosis exists separately from raw observations;
- `superseded` — a later draft/run exists while this historical run remains readable.

Invalid state transitions should be rejected by validation.

Examples:

- `quit -> reading` is invalid for the same run;
- `reading -> diagnosed` is invalid before evidence sealing;
- `recall -> reading future screenplay` is invalid;
- `completed -> recall -> ready_for_diagnosis` is valid.

## Reader profiles

Support persistent project-level reader profiles as review configuration, not canon.

Recommended defaults:

### Target Reader

A sympathetic member of the intended audience who wants the story to work but still records genuine confusion, attention loss, and emotional response.

### Skeptical Reader

Interested but impatient. This reader is permitted to skim or quit and is useful for identifying where the screenplay stops earning attention.

### Industry Reader

Reads quickly for clarity, momentum, visible/playable writing, character objective, and practical screenplay readability. This is not an automated producer verdict or commercial greenlight.

A project may customize, disable, or replace profiles.

Stable profile identity should persist across revisions so behavior can be compared meaningfully. The profile's stance should remain stable even when the underlying model/provider changes; runtime metadata records that environmental difference.

## Block evidence schema

Implement one canonical structured evidence schema outside the UI.

A conceptual shape:

```ts
type ReaderBlockEvidence = {
  runId: string;
  readerProfileId: string;
  blockId: string;
  blockOrdinal: number;
  sourceDraftFingerprint: string;
  segmentIds: string[];
  sourcePageRange?: { start: number; end: number };
  attentionTrace: Array<{
    segmentId: string;
    value: -2 | -1 | 0 | 1 | 2;
    note?: string;
  }>;
  emotionalResponse: string;
  expectationIn?: string;
  expectationOut?: string;
  openQuestion?: string;
  confusion: {
    kind: "none" | "productive-mystery" | "missing-or-unclear-information";
    note?: string;
  };
  strongestMoment?: {
    segmentId?: string;
    note: string;
  };
  characterPull?: string;
  momentum: "rising" | "holding" | "falling" | "mixed";
  memorableDetail?: string;
  readingDecision: "continue" | "skim" | "quit";
  quit?: {
    segmentId?: string;
    reason: string;
  };
  provider?: string;
  model?: string;
  runtime?: string;
  createdAt: string;
};
```

Names may adapt to current repository conventions, but the semantic contract must remain stable and testable.

Free-form reader commentary may exist beside the structured evidence. The structured evidence is the authoritative comparison surface.

## Attention scale

Use a bounded five-point attention scale or an equivalent enum.

Recommended semantics:

- `+2` — strongly leaning in;
- `+1` — engaged;
- `0` — neutral/steady;
- `-1` — drifting, doubting, or skimming;
- `-2` — done / would stop.

A `-2` does not have to force a quit automatically if the reader profile contract explicitly distinguishes "very low attention" from actual quitting, but the behavior must be deterministic and documented. Prefer explicit `readingDecision` rather than inferring quit solely from the numeric attention value.

## Expectation tracking

Reader expectation is a key reason to preserve sequential exposure.

For each Block, record:

- expectation entering the Block, if meaningful;
- expectation leaving the Block;
- what question the reader is waiting to have answered.

This creates direct evidence against existing PlotPickle concepts such as audience expectation and Pickle Turns without revealing those hidden planning values beforehand.

After the read, DraftLens may compare:

`planned audience expectation vs observed reader expectation`

and:

`planned Pickle Turn vs observed surprise/change`

The reader must never be shown the planned answer before recording its own expectation.

## Confusion classification

Fresh Reader already distinguishes useful mystery from missing information. Preserve that distinction structurally.

Use three states:

- `none`;
- `productive-mystery` — the reader notices a gap/question and wants to continue because of it;
- `missing-or-unclear-information` — the reader lacks information required to understand the current experience.

DraftLens may later diagnose the structural cause. The reader pass only records the experience.

## Quit behavior

Quitting is first-class evidence.

If a reader quits:

- persist the exact Block and segment boundary;
- persist the reason in the reader's terms;
- seal the run's screenplay exposure for that reader;
- never release later Blocks to that reader in the same run;
- recall, if requested, must use only accumulated state up to the quit point.

Do not silently force all reader profiles to finish the screenplay simply to produce complete analytics.

A finished read and a quit are both valid outcomes.

## Recall pass

Recall is collected only after screenplay exposure is sealed.

The recall agent/context must not receive the original screenplay text again.

It may receive:

- the reader's structured Block evidence;
- the reader's own accumulated transcript/memory state;
- reader-profile identity;
- recall questions.

Minimum recall questions:

1. What is the story about?
2. Who is it about?
3. What does the protagonist currently want?
4. What moment do you remember most?
5. What unresolved question remains strongest?
6. What do you believe changed across the story you read?
7. What would you tell someone else about this screenplay later?

For a quit run, answers naturally describe only material actually encountered.

Recall is evidence of retention, not a grade of artistic worth.

## Revision comparison

Reader runs must remain historical and comparable.

Each run needs:

- stable project ID;
- stable reader-profile ID;
- stable Story Block IDs;
- source draft fingerprint;
- run ID;
- provider/model/runtime metadata;
- timestamps.

A revised screenplay creates a new source fingerprint and a new run while preserving Block coordinates where the project structure still maps to the same canonical addresses.

Comparison should support questions such as:

- Did the reader finish this time?
- Did a quit point move later?
- Did Block 08 attention rise or fall?
- Did a confusion classification change?
- Did expectation match the intended dramatic turn more closely?
- Did a key setup/payoff survive recall?
- Did a memorable moment move to a different Block?

These are behavior/evidence comparisons, not automatic declarations that one draft is objectively better.

## DraftLens diagnosis boundary

Raw Reader Simulation Harness evidence and DraftLens diagnosis must be separate records/stages.

Required ordering:

`blind reader experience -> raw evidence sealed -> recall -> ready_for_diagnosis -> DraftLens diagnosis -> revision questions`

DraftLens can then connect a reader symptom to deeper PlotPickle evidence, for example:

- reader loses the protagonist's objective in Block 09;
- DraftLens checks goal/conflict/choice/action/consequence evidence;
- DraftLens identifies likely cause(s);
- DraftLens asks writer-facing revision questions.

Do not overwrite raw reader testimony after diagnosis.

## Relationship to PlotPickle Score

PlotPickle Score V1 remains unchanged.

Its current numeric contract is deterministic structural evidence: Alignment, Verbosity, Erosion, Progression, Coverage.

Reader Simulation Harness evidence is a different class of evidence and must not be injected into the V1 headline score.

The UI may place them beside one another because both use the same Story Block coordinates, but:

- Score remains deterministic structural measurement;
- Reader Harness remains bounded simulated-reader evidence;
- Human judgment remains final.

Any future score formula that consumes reader-simulation evidence requires a separate versioned issue and explicit score-version change.

## Persistence guidance

Prefer extending existing project development/review evidence structures over creating a new independent database.

The persisted design must clearly separate:

1. source screenplay/canonical story evidence;
2. reader profile/configuration;
3. raw reader observation;
4. recall evidence;
5. DraftLens diagnosis;
6. Human-approved revision/canon changes.

Do not duplicate the screenplay text merely to support the reader harness unless a bounded immutable snapshot is technically required for audit/replay. If snapshotting is required, store the minimum necessary evidence with clear provenance and retention rules.

## Provider and runtime behavior

The harness may use a configured local/private/cloud language-model route according to existing PlotPickle provider policy.

Requirements:

- no silent local-to-cloud fallback;
- no silent paid request;
- capture provider/model/runtime metadata for each run;
- provider failure produces a truthful failed/interrupted run state;
- changing providers between revision runs is allowed but must remain visible in metadata;
- provider/model choice must not grant canon authority.

A future implementation may allow reader profiles to select different models, but that is not required for V1 and should not expand this issue into a new provider-management surface.

## UX direction

V1 should prove the harness and evidence before building a large new visual feature.

A minimal DraftLens presentation can expose a 24-Block strip:

`01 +1 | 02 +2 | 03 +1 | 04 0 | 05 -1 | ...`

Selecting a Block may show:

- page/segment range;
- attention trace;
- emotional response;
- expectation in/out;
- open question;
- confusion classification;
- strongest moment;
- character pull;
- momentum;
- memorable detail;
- continue/skim/quit;
- previous-run comparison.

Skin V1 governs presentation. Do not create a Reader-Harness-only visual language.

## External methodology reference

Reference implementation studied:

`Shubhamsaboo/awesome-llm-apps/agent_skills/first-reader`

License: Apache-2.0.

Useful methodology ideas:

- sequential no-lookahead feed;
- reader can quit;
- skim/attention evidence;
- recall from prior reading state rather than rereading;
- persistent reader identity;
- comparison after revision;
- reader reports experience rather than rewriting the draft.

PlotPickle should implement these ideas natively inside its existing TypeScript/PPF/DraftLens architecture rather than vendor the external Python scripts by default.

If implementation copies or adapts source code rather than only applying methodology, update PlotPickle's canonical OSS registry/attribution and preserve applicable Apache-2.0 notices.

## Existing repository surfaces to reuse

Implementation should inspect/reuse rather than duplicate:

- `.agents/skills/writer-in-residence/references/specialists/reader-review.md`;
- `config/resident-writer-specialists.json`;
- `docs/architecture/draftlens-engine.md`;
- `docs/architecture/PLOTPICKLE-SCORE.md`;
- existing screenplay import and Story Block mapping code;
- existing PPF/development notes structures;
- existing AI/provider routing and consent boundaries.

Do not introduce a second specialist registry, second screenplay representation, second Block model, or parallel canon store.

## Recommended implementation sequence

### Phase 1 — Contract

- define canonical reader-run / Block-evidence types;
- add validators and state-transition rules;
- add source fingerprinting and runtime metadata;
- add focused tests for schema/state behavior.

### Phase 2 — Sequential feed

- build the Block-aware bounded evidence selector;
- expose one permitted segment at a time;
- enforce no-lookahead in code;
- implement continue/skim/quit;
- test future-material isolation.

### Phase 3 — Fresh Reader integration

- upgrade existing Fresh Reader Specialist to consume the harness;
- keep its advisory behavior and writer-facing boundaries;
- ensure no duplicate agent registration.

### Phase 4 — Recall and persistence

- seal reading transcript/state;
- run recall without source screenplay access;
- persist run evidence under stable project/Block/profile IDs;
- test canon non-mutation.

### Phase 5 — DraftLens diagnosis and comparison

- expose sealed raw reader evidence to DraftLens;
- keep diagnosis separate;
- implement revision-run comparison by Block/profile;
- add minimal 24-Block evidence navigation/presentation if needed.

### Phase 6 — Convergence and gates

- run focused #1908 regressions;
- run Development Convergence against the exact acceptance criteria;
- require `CONVERGED`;
- require PR Gate green on exact head;
- require Windows Product Gate green on the same exact head before merge.

## Required tests

### No-lookahead

- Block N reader payload cannot contain screenplay material from Block N+1.
- reader cannot request future screenplay segments outside the feed contract.
- future `pickleTurn`, ending, character outcome, audience-expectation answer, or DraftLens diagnosis cannot appear in an earlier payload.

### Quit

- a reader quitting in Block 06 receives no Block 07+ screenplay text;
- quit boundary/reason are persisted;
- recall from a quit run only uses encountered material.

### Recall isolation

- recall receives transcript/state only;
- screenplay source is not supplied to recall code path;
- tests fail if the original screenplay payload is passed into recall.

### Stable coordinates

- unchanged source preserves project/Block/profile coordinates;
- revised source receives a new source fingerprint;
- stable Block IDs remain comparable across runs when the project structure is unchanged.

### Canon authority

- creating reader evidence does not change screenplay text or canonical Block fields;
- DraftLens diagnosis does not overwrite raw reader observations;
- no reader output is promoted into canon without explicit Human action.

### Provider safety

- provider failure does not silently switch to a cloud/paid route;
- provider/model/runtime metadata is retained for the run.

### PlotPickle Score isolation

- identical source story evidence produces the same PlotPickle Score before and after Reader Harness evidence is attached;
- no V1 score dimension reads subjective reader evidence.

### Registration

- existing Fresh Reader Specialist remains the single reader-specialist registration;
- no duplicate `First Reader` registration exists.

## Acceptance criteria

1. A canonical Reader Simulation Harness schema exists outside the UI and is machine-testable.
2. PlotPickle's existing Fresh Reader Specialist is upgraded to use the harness; no duplicate standalone First Reader agent is created.
3. DraftLens is the owning/orchestrating review engine for the harness.
4. Story Blocks are the canonical review/persistence boundary for the default feature profile.
5. Exposure inside each Block is incremental and no-lookahead is enforced by mechanism.
6. Future screenplay text and hidden future PPF/DraftLens information are excluded from reader context.
7. Every reviewed Block emits the common structured evidence contract.
8. Reader profiles can persist across revision runs without becoming canon.
9. Quit behavior stops future screenplay exposure for that reader/run.
10. Recall uses accumulated reader evidence only and does not reopen the screenplay.
11. Revision comparison uses stable Story Block and reader-profile identity.
12. DraftLens diagnosis occurs only after raw reader evidence is sealed and remains separate from that evidence.
13. Reader evidence never mutates PPF canon automatically.
14. PlotPickle Score V1 remains unchanged and source-equivalent scores are unaffected by attached reader evidence.
15. Provider/runtime metadata and source fingerprints make runs auditable.
16. Focused regressions prove no-lookahead, ordering, schema validity, quit behavior, recall isolation, revision comparison, provider safety, Score isolation, and canon non-mutation.
17. Development Convergence reports `CONVERGED`.
18. PR Gate and Windows Product Gate are green on the exact same head before merge.

## Non-goals

This issue does not:

- add a second reader agent;
- replace DraftLens;
- replace PPF;
- alter PlotPickle Score V1;
- let AI approve canon changes;
- require a new provider architecture;
- prove that simulated readers are equivalent to Human test audiences;
- create a commercial-readiness score;
- automatically rewrite screenplay pages;
- require copying the external First Reader implementation.

## Definition of done

The work is done when PlotPickle can run its existing Fresh Reader capability through an enforceable Block-aware no-lookahead harness, preserve structured reader evidence and recall by stable Story Block coordinates, hand sealed evidence to DraftLens for later diagnosis, compare behavior across revisions, and prove through focused tests that future-story leakage, canon mutation, Score contamination, and silent provider fallback do not occur.
