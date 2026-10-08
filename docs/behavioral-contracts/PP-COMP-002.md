# PP-COMP-002 — Truthful Local Writing and Bubble Execution

**Status:** Human-established truths recorded 2026-10-08; code acceptance is independent and unproven until verified.  
**Issues:** #2841 (Local/Hybrid readiness), #2855 (Bubble Agent)  
**References:** [PP-NARR-001](./PP-NARR-001.md), [PP-SAVE-001](./PP-SAVE-001.md).

## Human truths: programming truth rather than screens

**T1 — Collect comprehensively; retrieve selectively; decide precisely.**
- The **Collection Agent** accumulates and indexes expansive production evidence, source references and decisions from screenplay, world, character, 24-Block structure, Scene, Beat, Shot, images, camera, lighting, locations, sound, timing and continuity. This is a long-lived project-wide capability, *not* the Bubble Agent's input-size or approval-key budget.
- The **Bubble Agent** has a deliberately narrow responsibility: given one already saved and locked Storyboard image and the facts most useful to the audience at this moment, offer one short, meaningful printed expression that moves the story forward. It must not redo project understanding, generate a new image, invent dialogue or narrate technical shot metadata. An intentional **No Bubble** can be best.
- Story and verified source facts are authoritative. Relevant evidence can be retrieved from the larger collection; more context is not inherently a better decision. The Bubble Agent should receive a bounded **shot-decision packet**, including Shot address/locked image identity, immediate dramatic purpose, grounded screenplay dialogue where applicable, audience information/reveal boundary, and only required continuity/character facts. Secondary camera, lighting and sound facts may enter only when narratively relevant.
- Quality is creative and Human-reviewed; independent tests can prove brevity, grounding, source provenance, route, isolation, and exact Save & Lock/restart parity.

**T2 — 4,000 characters is not a creative-information cap.**
- The 4,000-character boundary previously discussed is a *persisted approval source-key limit*, not a limit on Collector records or permissible screenplay context. Save a bounded change-detection identity, not whole story text, in this field. Keep full provenance in its owning canonical stores without inventing a second source of truth.

**T3 — Discovery is not execution proof.**
- Hardware detected, runtime installed, model catalog listed, model fitting VRAM, a model automatically occupying a Quality slot, and connection reachability are separate facts. **Writing READY** requires the exact configured runtime, endpoint and model to produce a nonempty real text response with current verification evidence.
- Verification is tied to the execution-affecting identity: provider/runtime, endpoint and model. Changing these invalidates old proof. A failed response leaves readiness blocked with an actionable reason, never green.
- No inference of the Human's Windows machine readiness from a CI mock, catalog, SDXL image setup or LTX/ComfyUI video recommendations.

**T4 — Settings express one readiness truth.**
- Local → Writing gives a comprehensible view of the actual writing runtime/model, test action, latest verification and recovery guidance. Advanced model inventory is optional; SDXL/LTX are not Writing readiness evidence.
- Hybrid → Writing displays the **same verified readiness** for the matching local resource and separately shows which route is selected. Merely opening Local Setup, testing, refreshing status, or inspecting Hybrid may not change selection or activate anything.
- A selected-but-unverified route is selected **and blocked**, never silently replaced. No hidden provider fallback. Relevant diagnostics identify failed capability and actual model without exposing prompts or secrets.

**T5 — Bubble provider authority remains local for the approved pilot.**
- PP-NARR-001 v1.0 B2 explicitly approves the *configured working LOCAL writing provider*, without automatic paid Cloud or Hybrid override. This contract does not silently revise that approval. Local/Hybrid share **status and proof**; a Cloud Writing selection elsewhere must not move the Bubble pilot to Cloud.
- For the current code's automatic local Bubble implementation, the exact role is **Quality**. A Fast-slot or Ollama reachability check alone cannot certify a different Quality model. The Bubble route preflights the actual Quality execution identity against its successful text-generation proof and reports a truthful blocked reason.
- A future change to Bubble routing authority (including choosing a Cloud provider through Hybrid) requires an explicit Human contract amendment. A verified local model may happen to run through Ollama, llama.cpp, LM Studio or a supported compatible runtime.

## Deterministic state and invariants

```
UNCONFIGURED -> DETECTED -> CONFIGURED -> TEST_NEEDED -> TESTING
TESTING + matching real nonempty model response -> VERIFIED_READY
TESTING + timeout/error/empty answer -> BLOCKED (record reason)
VERIFIED_READY + model/endpoint/runtime change -> TEST_NEEDED
VERIFIED_READY + provider offline -> BLOCKED (retain config and selection)
```

- `WritingReady(route, identity) => Configured(route, identity) AND VerifiedResponse(identity) AND Reachable(identity) AND NoCurrentError(identity)`.
- `BubbleGeneration => SavedLockedImage AND GroundedShotPacket AND VerifiedLocalQualityWriter`.
- `RequestedBubbleProvider = VerifiedLocalWriter`; `ImplicitCloudFallback = FALSE`.
- `LocalWritingReadiness(identity) = HybridDisplayedLocalWritingReadiness(identity)`; `SelectedRoute` is independent.
- `ReadStatus` and `TestCapability` must not select a route; a test of Fast cannot certify Quality.
- `PrintedDecision` remains one caption or verbatim dialogue bubble, typically 5–8, maximum 12 words, or explicit No Bubble. No automatic rewriting of previous Human locks.
- `CollectorRecordSize` is independent of `BubbleInputSize` and `ApprovalSourceKeySize`.

## Independent acceptance, evidence classes

1. With a configured local Quality model: display runtime/endpoint/model on Local; execute one real text response via that exact identity; only then display VERIFIED/READY. Hybrid must show identical model and verification. Provider fixtures test wiring, not actual machine readiness.
2. With Ollama running but no eligible Quality model, show *Detected / model required*, not Ready. With a model selected but no successful response, show *Test needed*. With unreachable server, show *Blocked*, not an inferred green from the model catalog.
3. Test Fast while Bubble Quality differs: Fast may be verified; Quality remains **unverified** until separately tested.
4. Change Quality model/runtime/endpoint: the former test cannot make the new one ready. A failed test cannot erase a prior Human-approved Bubble or change provider selection.
5. Local Writing's primary UI does not present SDXL/LTX/ComfyUI image/video status as Writing success. Cross-capability hardware details may remain in clearly marked advanced inventory.
6. Generate a text-only Bubble using the **exact** verified local Quality profile; verify real request/response, Save & Lock, rejected stale source, true stop/start and matching Previs output. If actual Human hardware is inaccessible, mark that evidence **UNPROVEN**, not PASS.

## Ownership and scope

Reuse existing local runtime manager, Writing Assistant profile store/test handler, capability readiness endpoint and Hybrid status; do not introduce another persistence store, router or autonomous provider-choice agent. The Collection Agent data model, retrieval policy and bubble-decision packet are **contract scope for subsequent implementation**, not evidence of implemented end-to-end Collector infrastructure.
