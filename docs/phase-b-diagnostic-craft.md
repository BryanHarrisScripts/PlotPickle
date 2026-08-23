# PlotPickle 0.14 — Phase B Diagnostic Craft Layer

Phase B turns the canonical schema 1.7 story model into a craft-diagnostic system. It does not create a second outline format and it does not grade artistic quality. It examines recorded story evidence, identifies the dramatic function that is weak or absent, explains why that weakness matters to the audience, and asks repair questions without prescribing one replacement scene.

## Act I Launch

Act I Launch evaluates twelve functions across Blocks 1–6: Primary Presence, Revealing Contrast, Opposing Pressure, Pressure Multiplier, Disruption Lands, Problem Named, Outside Push, Inner Lock, Counterstrike, Emotional Anchor, Personal Threat and Irreversible Step. The functions are flexible; another movement may perform a signal when the evidence is clear. The diagnostic also tracks Act I setups and unresolved Story Threads as downstream promises for Blocks 7–24.

## Opening Move

Opening Move evaluates seven first-contact effects in Block 1: Anchor, Grip, Compass, Question, Imprint, Echo and Handoff. It combines the existing hook, world rules, theme, audience question, first scene, final block and ending. The opening passes when it establishes forward motion, creates a promise the film keeps, and is causally, emotionally, visually or thematically inseparable from the story.

## Scene Pulse

Scene Pulse diagnoses the micro-structure of each flexible scene. It examines the scene's indispensable job, immediate objective, opposing result, Cut Line, pivot, value change and handoff pressure. Findings distinguish missing description from a dramatic defect: for example, an objective without opposition produces information transfer, while an unchanged entry and exit condition suggests the scene did not create a live value flip.

## Story Thread overlays

Each Story Thread is projected across all 24 blocks and linked scenes. The overlay identifies inactive threads, long unexplained gaps, unresolved threads that disappear before the resolution act, and resolved threads without a payoff or resolution milestone.

## Setup, Payoff and Reflection Ledger

The ledger reads every block's setup and payoff fields, matches likely pairs through shared language, and looks for a later emotional, relational or thematic reflection. It distinguishes an open setup, an unearned payoff and a plot payoff that has not been absorbed by the characters or theme.

## Character Arc checkpoints

The Arc Matrix becomes a view from opening state through midpoint shift, crisis choice, climax choice and ending state, with custom block- and scene-level checkpoints preserved. Diagnostics ask for behavioural evidence of strategy change rather than accepting a prose description of an arc as proof.

## Chronology versus presentation

The chronology view uses the ordered scene plan. Presentation order uses the first appearance of each stable scene ID in the screenplay draft. PlotPickle flags planned scenes missing from the screenplay and nonlinear displacement without a readable temporal signal or dramatic reason.

## Workspace integration

- Structure shows focused diagnostics for the selected block and scene beside Scene Health.
- Writer shows Scene Pulse and related root findings beside the current screenplay position.
- DraftLens combines its reader-experience notes with computed cross-story evidence.
- `/diagnostics` provides the complete Opening, Act I, Thread, Ledger, Arc and Timeline views.

## Completion standard

PlotPickle 0.14 passes Phase B when it can state what function is weak, why that function matters, what project evidence supports the diagnosis, and which questions should guide revision for a story movement, scene, thread or character arc.

The release must pass the standard PlotPickle lint, production build, smoke-test and complete regression pipelines on the exact merge candidate. The permanent merge candidate contains no temporary migration, lint-capture or repair workflow files.

The clean Phase B implementation completed lint, the verified production build and all 76 regression tests before entering the standard repository merge gates.
