# PP-NARR-001 — Storyboard Narration Truth

**Status:** PROPOSED FOR HUMAN REVIEW — not yet approved or implemented
**Proposal version:** 0.1.0
**Date:** 2026-10-08
**GitHub issue:** #2852
**Domain:** Storyboard locked Shot → short written narration/speech bubble → Human approval → Previs Graphic Novel
**Previous work:** #2839 text-only route; #2821/#2847 Save/session; approved [PP-SAVE-001](./PP-SAVE-001.md)
**Authority:** Human determines the intended outcome; implementation, provider selection and tests cannot silently redefine the promise.

## 1. Proposed Human promise (ordinary language)

> When I select a Saved and Locked Storyboard image and click **Create Narration**, PlotPickle must understand the moment from the **screenplay and written shot information**, not by analyzing the image. It should propose a **very short, meaningful caption or an authentic dialogue bubble** that belongs to this exact Shot. I can review it, approve it, regenerate it, or choose silence. When approved, that exact text must be preserved with the exact Shot and used unchanged by Previs, including after I close and reopen PlotPickle.
>
> If something prevents generation, PlotPickle must tell me **what is actually wrong** and what action is possible. It must not report that I need to sign in when I am already properly signed in, blame the image when the request is text-only, claim success when no text was produced, or silently change an existing approval.

**Interpretation offered for confirmation:** Here "narration" means short **printed Graphic Novel narration** (and, separately, a screenplay speech bubble). It does **not** imply text-to-speech, audio narration, image generation or video generation. This single-Shot contract is the unit that feeds a later coherent 25-Shot Graphic Novel sequence; it is not an instruction to invent 25 separate stories.

## 2. Supported inputs and eligibility

- **Scope:** Same signed-in profile and selected project; exact Act → Block → Mini-Block → Shot (1–25), saved and locked image candidate/version, and corresponding screenplay passages and authored shot facts.
- **Read-only story authority:** screenplay, Scene/Beat, Story intention, Camera, Performance/Blocking, Lighting/Look, Timing, Information Boundary and Continuity/Handoff. Empty, missing or speculative fields remain explicitly absent; camera/planning labels must not be printed as speech or invented plot.
- **Provider authority:** the writing/text route **actually selected** in Settings → Hybrid using providers successfully configured in Local or Cloud. Image-capable inference is **not** a prerequisite. Route readiness, consent and authentication are independently checked, not assumed from a settings badge.
- **Output:** one reviewable draft for one currently selected Shot, with at most one short caption and at most one speech bubble. Generate does not approve or mutate the image.

Prerequisites are divided so the UI can truthfully distinguish them:
1. `StoryEligible`: exact selected version is durably Saved and Locked, has sufficient mapped screenplay evidence, and project/Shot selection is still current.
2. `SessionAuthorized`: an actual valid same-profile session authorizes this request.
3. `TextRouteReady`: the selected text-writing route is authorized, configured, tested and actually executable.

If any prerequisite is false, the UI displays the **specific prerequisite** and prevents false generation; it does not quietly switch to an unselected or charged provider.

## 3. Output truths proposed for Human acceptance

**N1 — story-grounded brevity.** The result summarizes the important dramatic moment of **this Shot**. Aim for roughly **five to eight words** where possible; the hard existing boundary is at most **12 words and 100 characters** for a caption. Silence (empty text) is valid when chosen and distinguishable from a model or request failure. No invented story events, character actions, lighting, character identity or spoken words. The source screenplay governs what happens.

**N2 — dialogue is verbatim.** At most one bubble per Shot, up to 100 characters, uses a **contiguous exact excerpt** of supplied screenplay dialogue attributed to its actual speaker. No paraphrasing invented as a quote and no switching speakers. A Shot without supportable dialogue may receive narration alone or deliberate silence.

**N3 — text-only compute.** For Storyboard Create Narration, the request and model invocation depend on written story/Shot evidence only. Never fetch/encode image pixels, create a contact sheet, invoke visual inference, or fail merely because a vision model is unavailable. The existing *Previs* visual-adaptation route is a separate capability, not silently reused for this action.

**N4 — actual capability delivery or transparent non-delivery.** When StoryEligible, SessionAuthorized and TextRouteReady hold and the route returns a valid bounded response, one matching draft must appear for Human review. If they do not hold or the remote/local provider fails, the UI must state the reason and preserve existing work. Distinguish, at minimum: unsigned/expired authorization; no active Hybrid writing route; configured route not ready or consent blocked; missing story/Shot evidence; provider execution failure/time-out; malformed/ungrounded output; rejected persistence; stale source/Shot. Do not invent a "ready" state from a passing mocked test. Numeric response limits are engineering policy to be measured and verified, not assumed here.

**N5 — approve is a separate durable decision.** Create/Regenerate only produces a **DRAFT**. Only pressing **Approve text** (or **Set silent**) may commit a current narrative decision. Announce approval only after confirmed encrypted durable write. A failed or pending approval retains the original approved text and the user's draft/retry path. Saving text cannot alter image bytes, Save/Lock, unrelated Shot approvals, screenplay or provider route.

**N6 — correct identity and staleness.** Each draft/approval belongs to the exact `profileId, projectId, anchorRef, shot position, storyboard artifactId/version` and a **source fingerprint** covering the screenplay passages, supplied authored Shot facts and story context. If the selected image/version, story evidence, camera, information boundary or other narration input changes while generation is underway or after approval, a result for the old source may not overwrite/masquerade as the current one. Stale content remains distinguishable until the Human explicitly re-approves current text.

**N7 — recover and hand off unchanged.** After a supported normal restart and Library "Open Example with Your Changes", the Human finds the same approved text or approved silence associated with the same Saved+Locked Shot. Previs receives and presents exactly that current approval; it must not silently swap a stale draft, different shot, model regeneration, or an old image version. No additional narration generation or paid compute is required to play approved content.

**N8 — no collateral effects.** Failed auth, no route, model failure, malformed text, timeout, cancellation, stale response and persistence failure must leave previously approved text, image state and unrelated story/profile identities unchanged. Any generated text is a proposal, never canonical screenplay truth without a separate Human decision.

## 4. Minimal observable state machine

```text
UNAVAILABLE (not Saved+Locked / missing screenplay / no authorized text route)
    -- prerequisites satisfied --> READY
READY -- Create Narration --> PREFLIGHT --> GENERATING
GENERATING -- valid text --> DRAFT
GENERATING -- dependency/error/invalid text --> FAILED (reason; no changed approval)
DRAFT -- Regenerate --> GENERATING (old approval intact)
DRAFT -- Approve text --> APPROVAL_PENDING --> APPROVED (durable acknowledgement)
DRAFT -- Set silent --> APPROVAL_PENDING --> APPROVED_SILENCE (durable acknowledgement)
APPROVAL_PENDING -- rejected/unknown --> SAVE_FAILED_OR_UNKNOWN (no false approved claim)
Any draft/approval -- source identity changed --> STALE (not current)
```

Formal invariants (proposed):

- `PresentedAsCurrentApproved(n) ⇒ DurableApproved(n) ∧ SourceFingerprint(n)=Fingerprint(CurrentShot)`
- `StoryboardGenerate(n) ⇒ TextOnlyRequest(n) ∧ ImagePayload(n)=∅`
- `ApprovedBubble(b) ⇒ ContiguousScreenplayQuotation(b.text,b.speaker)`
- `GenerationFailure ⇒ NoMutation(PreviouslyApprovedText,ImageApproval,Screenplay,OtherShots)`
- `PrevisCurrent(n) ⇒ SavedAndLocked(AssociatedArtifact(n)) ∧ DurableApproved(n) ∧ MatchingSource(n)`

These constraints define the required behaviour, **not** proof that the current implementation satisfies it.

## 5. Acceptance examples and deliberately failing scenarios

| Human action / situation | Expected result | Independent observation |
| --- | --- | --- |
| Click Create Narration on eligible 3-second Shot with usable screenplay and ready text route | One short draft capturing its story moment; not automatically approved | Real selected provider executes text-only request; inspect rendered draft and authoritative passages |
| Play Shot with actual dialogue | Correct screenplay speaker and exact dialogue excerpt, or a grounded caption | Compare quote directly to canonical passages, reject invented speaker/words |
| Camera/lighting/continuity changes before generation returns | Stale response cannot replace current draft/approval | Inject delayed model response, modify exactly one shot fact, observe no current approval mutation |
| Writing route OFF/unconfigured in Hybrid | Clear blocked reason; no silent switch to another provider | Exercise configured route resolver and diagnostics, verify provider was not invoked |
| Authenticated session is valid but endpoint produces 403 | Report actual session/CSRF boundary and operation reason, not an invented sign-in requirement | Real local profile/session HTTP interaction; recorded request ID/code with secrets redacted |
| Text model returns invalid JSON, invented dialogue or overlong caption | Honest output validation failure; prior approval unaffected | Inject defective provider response through actual endpoint |
| Approve text / Set silent with successful encrypted vault write | Durable current approval, independent of image Lock | Inspect real persistent store and UI, repeat after logout/process restart |
| Save fails or response arrives for old Shot | No false approved banner; draft or old approval remains recoverable | Inject write failure/selection race; compare before and after identifiers |
| Reopen example with local changes, then Previs | The exact approved printed text/bubble appears on the right Shot | Use the same version/identity and compare rendered Storyboard and Previs |
| No useful screenplay evidence | Explain unavailability without fabricating an event | Remove mapped evidence, verify blocked/silence remains an intentional Human choice |

**Special note on creative correctness:** deterministic tests can prove provenance, input/output shape, timing, scope and exact quoted dialogue. They cannot mathematically prove every poetic caption is narratively excellent. Use a small independently reviewed Afterglow example set with explicit accepted/rejected captions and retain Human approval as the final creative authority.

## 6. Known code and verification gaps (source inspection, not proven live cause)

- Existing Storyboard request already sends text-only data and current parser limits short caption and verbatim dialogue (`core/media/previs-narration.mjs`, #2839). Preserve these correctly functioning constraints.
- Narration API collapses exceptions from `resolveConfiguredAgentExecutionProfile` and model invocation into a single `TEXT_COMPUTE_UNAVAILABLE` response. This can hide a missing Hybrid writing selection, missing consent, unreadiness or provider failure. The actual cause of the Human's current error is **not yet independently observed**.
- Storyboard's pre-request `/api/auth/profile` and the narration endpoint's separate mutation authorization may disagree; compare both under an authenticated live session before changing security boundaries.
- `graphicNovelTextSourceKey` currently covers passages, story context and panel presentation, but not every `shotFacts` field passed to narration. A camera/lighting/continuity edit may fail to invalidate a stale approval. Do not assume that a changed project revision alone closes this gap.
- #2839 handler/endpoint tests use mocked text-model execution; Windows rendered narration proof injects a successful endpoint reply. Green tests therefore do **not** establish an actual selected Hybrid writing model answering Storyboard narration on the Human's device.

## 7. Verification sequence and limits

1. **Human accepts/corrects this truth first**; preserve original Human language. Until accepted, it is a *proposal*, not PP-NARR-001 compliance authority.
2. Independently baseline the real failure using current route/status diagnostics and an isolated authorized writing route. Do not spend cloud credits without prior route authorization; if no executable provider is available, record **BLOCKED** rather than inventing PASS.
3. Add red-capable tests exercising real authentication/Hybrid route selection, no image payload, exact reply validation, stale identity, failed approval, and independent persistent readback.
4. Implement only measured owning repairs in Storyboard, existing writing route, agent gateway and approval owner; no new agent framework, state store, compatibility bridge or separate verifier.
5. Green build/CI is necessary, **not sufficient**. Run rendered Storyboard → Human Approve → restart/Library recovery → Previs; compare current source identity and content. Record PASS/FAIL/BLOCKED/UNPROVEN **per rule** and keep Human local-device acceptance separate.

## 8. Human decisions needed

1. Does "Create Narration" mean **brief printed caption/actual dialogue bubble**, with silence allowed, rather than spoken audio? *(Proposed based on the previous discussion and current Storyboard button.)*
2. Is **roughly five to eight words preferred, 12 words maximum**, a good first output boundary? The words are not required to be exactly five or six when a complete thought needs more room.
3. Should **both** an eligible Saved+Locked Shot and a genuinely selected, ready **Hybrid writing route** be mandatory before an attempt? If the latter is missing, the system gives one precise setup instruction and does not pretend to generate.

**Contract state:** awaiting the Human's explicit approval or correction. No runtime code is authorized by this proposal alone.
