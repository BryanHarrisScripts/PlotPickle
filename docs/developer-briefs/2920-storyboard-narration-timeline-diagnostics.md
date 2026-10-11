# #2920 — Storyboard narration and Timeline selected-route diagnostics

**Human observation (2026-10-11):** “Check the Storyboard saving of narration—does it connect to these new routes? Check Timeline too. If they fail, give more diagnostic information in red text.”

## Governing truths
- [PP-NARR-001](../behavioral-contracts/PP-NARR-001.md) B2 is already approved: one saved+locked Shot generates a 5–8-word Bubble/Caption via an **already-working local writing provider**. A general-purpose Cloud Writing selection or Off does not disable verified Local Quality narration and cannot authorize off-device Bubble generation. Explicitly choosing verified Ollama under Connections → Writing allows the alternate **local** narration provider, but no implicit cloud or background job.
- [PP-CONNECT-001 / issue #2918](https://github.com/BryanHarrisScripts/PlotPickle/issues/2918): selected capability/route, actual capability proof and encrypted owner authority are separate; Join is not a generation event and cannot certify unsupported inference.
- Timeline reads `/api/ai-routing/status` and dispatches the unique selected/verified Video route; no implicit fallback. Its trim path must produce physical 72 frames at 24fps over ~3 seconds; paid calls require explicit Human confirmation, and a submitted job receipt must be resumed without a second bill.
- Any failure leaves approved text, locked images, saved jobs and story canon intact. Red diagnostic text is not optional, but contains only safe stage/route/code, bounded reason and next step—not keys, prompt/story text, source media, private profile paths or raw provider HTTP bodies.

## Source audit
| Surface | Connection before #2920 | Gap | Bounded repair |
| --- | --- | --- | --- |
| Storyboard / Create Narration | `/api/previs/narration` → `resolveConfiguredLocalNarrationProfile()` pinned to `localTextExecutionProfile("quality")` | Explicit Ollama selected and verified under Connections did not participate | Ollama selected → validated model+reachable/verified profile; all other general-purpose routes → local Quality per PP-NARR B2 |
| Storyboard / Save & Lock | `saveFoundationProjectDurably` + source fingerprints + approval | Error plain uncoloured small text | In-place red `role=alert` with PERSISTENCE code, Shot index, reason and safe retry advice |
| Narration API | Validates authenticated session, screenplay evidence, provider response, output | Provider exceptions masked as generic strings; browser could not distinguish setup vs execution vs invalid output | Safe `code`, `stage`, `route`, HTTP status, next action |
| Timeline / Generate Motion | Selected `video` from `/api/ai-routing/status`, route-specific strategy, consent, save receipt, poll and FFmpeg trim | Most failure states neutral; route and stage sometimes missing | Route/stage/configured/verified in preflight errors; red row/global alerts; save and observation failures preserve receipts |
| Timeline / Export | Uses approved locked images/Previs bubbles; renders MP4 | Separate export path, not provider generation | Preserve current behaviour; no hidden cloud model selection |

## Evidence and safety equations
- `StoryboardNarrate(Shot) ⇒ SavedLocked(Shot) ∧ LocalVerified(provider) ∧ (provider=SelectedOllama ∨ provider=LocalQuality)`.
- `CloudOrOffGeneralWriting ∧ LocalQualityVerified ⇒ LocalQualityStoryboardNarration` (no cloud).
- `StoryboardFailure ⇒ Δ(lockedImage, approvedBubble, storyCanon, cloudJobs)=0`.
- `TimelineGenerate(Shot) ⇒ SelectedVideoReady ∧ EligiblePacket ∧ Verified72FrameTrim ∧ HumanConsentIfPaid`.
- `TimelinePreflightFailure ⇒ Δ(paidJobs, acceptedMedia)=0`.
- `SubmittedJobUncertain ⇒ PreserveReceipt ∧ NoAutomaticSecondCharge`.
- `FailureVisible ⇒ RedAccessibleAlert ∧ DiagnosticStage ∧ RouteOrUnknown ∧ NextAction`.
- `DiagnosticPayload ∩ {APIKey, StoryPrompt, SecretProfile, RawProviderBody}=∅`.

## Test gates
1. Pure/vm local Writing selection cases: Ollama vs Off vs Cloud (Local Quality preserved, no implicit paid call).
2. Existing `tests/issue-2839-storyboard-text-narration.test.mjs` model contract, one-Shot context, auth, provider and Save; new regression validates alert details.
3. Existing `tests/issue-2841-capability-harness.test.mjs` real profile/CSRF routing, no paid fallback and restart.
4. Windows rendered Save/Lock/Previs and Connections lanes; full architecture, Windows build and exact-head CI. Failures remain actionable; merge only green.
5. Attended Windows provider inference and Visual acceptance are still **PENDING**; synthetic CI cannot prove model availability on a Human PC.

Developer brief status: proposed implementation and CI verification; does not change approved cloud-use policy or authorize provider charges.
