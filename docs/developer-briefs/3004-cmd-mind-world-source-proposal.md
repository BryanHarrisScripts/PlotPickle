# #3004 Phase 2 — CMD screenplay-bound Mind Map and World Map unaccepted proposals

## Outcome
Advance saved **Brotherly Love** end-to-end Command production without manufacturing accepted story canon. Phase 1 (#3007) exposed read-only workflow inventory. Phase 2 adds a first real *durable draft change* through Settings → Command: a Human chooses a canonical Mind/World field and a specific retained imported screenplay passage; Command previews an exact source-linked excerpt and writes it **only as an unaccepted field proposal** after one-use explicit confirmation.

This is a bounded production phase, **not** a claim that the 25 Storyboard shots, Previs, Timeline, Rough Cut or real Brotherly Love Story Architect assessment exists.

## Supported grammar
- `PlotPickle mind-map fields foundations` (also `world`, `character`, `theme`, `structure`): full canonical field IDs and existing proposal/accepted metadata; no changes.
- `PlotPickle world-map fields`: canonical *textual World story-development fields* (NOT visual character package or image generation).
- `PlotPickle mind-map source Block 01 Mini 01` (or `world-map source`): 1–24 Blocks, 1–4 Minis, original retained passage IDs, types, scene, count. Does not print full private imported passages to inventory.
- `PlotPickle mind-map propose <canonical-field-id> from <passage-id>` (or `world-map propose`): exact current selected PPF, canonical field registry and complete imported source checked; preview a literal excerpt as an **unverified field draft**. No model called. The output is not inferred canon, a character bio, a world fact or a polished field answer.
- `PlotPickle mind-map confirm <fresh-16hex-token>` or corresponding World Map form: one-use, 120s, project/profile/revision/source/field bound; invokes **existing** `writeStoryDevelopmentFieldProposal`, `saveFoundationProjectDurably`; demands exact proposal and sourceRef read-back at new revision and unchanged acceptance metadata. It never changes approved field values.
- `PlotPickle mind-map cancel` (or `world-map cancel`): invalidates pending draft.

## Authority and security
- `modules/learn/model/story-development-fields.ts` + current curriculum owns field identity/valid topics. `core/project/story-development.ts` owns the proposal slot. `core/contracts/imported-screenplay-evidence/index.ts` owns original imported passages, `saveFoundationProjectDurably` owns revision-safe encrypted write/flush, `core/storage/project-library-browser` owns active project.
- On every action ensure current unlocked local Human profile and selected current Library PPF. Confirm checks project ID, revision, source filename, passage exact text and field identity before the single PPF revision advance. Ambiguous/duplicate IDs, partial/truncated retention, malformed passages or existing draft overwrite all BLOCK; no silent data replacement or hidden fallback.
- The draft is a bounded literal **source excerpt with an explicit unverified warning**, not AI-generated fiction and not a field answer from approved Writer. The Human must edit/review separately and approve using existing GUI authority. World Map **visual package remains unchanged**; no image, narration, video, charges, DSDD issue, Pi or Story Architect task is started.
- No private screenplay, actual Brotherly Love project ID, provider key or protected checkpoint committed in tests/CI. Only synthetic imported 3-passage fixture.

## Independent tests
`tests/issue-3004-cmd-source-proposals.test.mjs` exercises bounded parser, read-only field+passage inventory, exact source preview, one use confirmation, previous accepted field preserved, source/visual immutability, durable receipt shape, truncation/count/duplicate ID negatives, stale source/revision/profile/project, wrong topic, existing proposal overwrite, cancellation and no DSDD/paid inference. White Paper v3 W8/W9 truth catalogue binds fixture evidence; authentic Windows Settings Command proof is separate. Green CI does not certify a real Brotherly Love stored draft without on-device Human trial.

## Remaining end-to-end #3004 work
- Actual Windows Brotherly Love Human starts by updating main, `PlotPickle open Brotherly Love`, lists fields and source IDs, stages and confirms one draft, then reopens Mind Map/World Map to review state. Repair any mismatches.
- Script-to-canon **creative** agent draft beyond literal evidence: requires independent Human-authorized inference, structured field schema and approved proposal semantics. Character roster and World Map visual references remain separate.
- #2999 protected Story Architect recovery and actual current seven-dimension assessment, Outline four Human plan approvals and saved Write.
- Storyboard Shot 01 image prompt/candidate Save/Lock, Previs locked-sourced flipbook/narration, Timeline video and Rough Cut playable MP4, each with independent real artifact/playback acceptance.
- All phases maintain W8/W9 truthful behavior; **do not close issue #3004 merely because this phase merged**.
