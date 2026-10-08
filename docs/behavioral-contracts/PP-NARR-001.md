# PP-NARR-001 — Storyboard Comic / Graphic Novel Bubble Truth

**Status:** REVISED PROPOSAL — Human corrections incorporated; final approval pending  
**Version:** 0.2.0 (supersedes unapproved proposal 0.1.0)  
**Date:** 2026-10-08  
**Issue:** #2852  
**Related:** #2839 text-only narration; approved [PP-SAVE-001](./PP-SAVE-001.md) for Storyboard Save/Lock/restore; #2849 saved-and-locked Previs handoff

## 1. Human's intended outcome

> For each saved and locked Storyboard image, PlotPickle uses a suitable **Bubble Agent** to understand the moment from **as much relevant information as needed**: screenplay, authentic dialogue, story, Scene/Beat, Camera, character performance, lighting, continuity, timing, information boundaries and, when helpful and available, information from the selected image. The Agent suggests a **short, meaningful comic-book or graphic-novel expression** of roughly **five to eight words, at most twelve**, as either a character **dialogue bubble** or a **scene-description caption underneath the image**.
>
> My actions are **Save & Lock**, **Regenerate**, and **No Bubble**. Save & Lock is an actual durable decision about the proposed printed text, not a temporary draft. No Bubble deliberately leaves the frame without printed text. After I restart PlotPickle and restore my local story changes, the exact locked image and my chosen printed text (or No Bubble) must remain unchanged in **both Storyboard and Previs**.
>
> Use the **already set up, working LOCAL writing provider in Settings**. Do not automatically route through Hybrid to another provider, switch to Cloud, require that I choose a provider for each Shot, or generate paid media.

This is the proposed **business truth**, not a claim that the current implementation already meets it.

**Terminology:** "Narration" in this contract is brief **printed** comic/graphic-novel text; it is not text-to-speech, audio narration, a new image, or video. "Save & Lock" concerns the **Bubble/Caption** decision and is distinct from saving and locking the underlying Storyboard image under PP-SAVE-001. "No Bubble" is proposed to mean an intentionally **text-free frame**: neither dialogue bubble nor caption. If a Human later wants a different meaning, the contract must be revised explicitly.

## 2. Information and priority

The agent receives the actual selected project's **Act → Block → Mini-Block → Shot (1–25)** and exact Saved+Locked Storyboard image version, plus all relevant authored facts:

- Screenplay passages, actual character identities and dialogue, story purpose, Scene and Beat.
- Shot/camera/staging, performance/blocking, lighting/look, time and duration, information to reveal or withhold, and continuity in/out.
- Relevant adjacent Shot context when it is already supported by the story.
- **Optional** locally available observations from the actual selected Storyboard image where needed for the printed expression.

**Authority order:** Human-authored screenplay and approved story > authored Shot facts > optional image observations > model suggestions. Pixels may help interpret what is visible but cannot invent plot, quotations, characters or override the screenplay. **Reading image pixels is allowed, not categorically prohibited; a vision model must not become mandatory** for generating a meaningful caption when adequate written evidence exists. No silent Cloud fallback for pixel reading.

The exact source identity should include `profileId`, `projectId`, `anchorRef`, `shotPosition`, `artifactId/version`, media identity, and a fingerprint of **all relevant narration inputs**, including camera/lighting/continuity (not merely screenplay text).

## 3. Proposed observable invariants

**B1 — Correct single-frame scope.** Create narration only for the currently selected **Saved and Locked** Storyboard image. Never claim that a different Shot or different image version supplied the final text. Generation does not change image Save or Lock.

**B2 — Real local writing execution.** Use the configured and working **local writing provider**. The interface need not explain routing when it works. Provider selection, readiness or a mocked green test cannot substitute for an actual successful local inference call. If the local provider is unavailable, **do not silently switch provider**; keep current work and show a short, truthful failure/retry message, with diagnostic detail in the existing logging harness.

**B3 — Meaningful brevity.** Propose approximately **5–8 printed words**, hard maximum **12 words total for the selected single printed expression**. It must communicate a specific story moment, not repeat technical camera labels, shot numbers or filler. An excellent creative choice is subject to Human judgment; automated proof can enforce word count, provenance and state.

**B4 — Dialogue or caption.** Choose the form that makes sense:
- **Dialogue bubble:** a short **verbatim contiguous excerpt** from actual screenplay dialogue, attributed to its actual speaker. Never invent or paraphrase speech as if quoted.
- **Caption beneath the frame:** a concise scene description or dramatic observation grounded in screenplay and authored Shot facts. It is not attributed to a speaking character.

Do not add a second printed sentence as a workaround to evade the word maximum. A proposed "No Bubble" decision is a separate intentional outcome.

**B5 — Human decision controls.** Create Narration produces a reviewable **DRAFT**, not an approval. The three human-facing actions are **Save & Lock**, **Regenerate**, and **No Bubble**.
- **Save & Lock** commits the exact selected proposed text, form, optional screenplay speaker, selected image/version, source fingerprint and Human approval; show success **only when durability is confirmed**.
- **Regenerate** requests another draft **without altering the last locked text**, image or other Shots.
- **No Bubble** is a direct Human decision to leave the frame without printed text; persist the intentional choice so Previs distinguishes it from an ungenerated/failed bubble. Report success only after confirmed Save. If a prior result is locked, changing it requires an explicit Human-directed replacement, never an automatic overwrite.

**B6 — Correct stale/concurrent behaviour.** A model response arriving for a previously selected Shot/image or older story/Shot facts cannot become current or overwrite an approved decision. If authored camera, continuity, lighting, dialogue or other used facts change, previous approval is visibly **stale**, not deceptively current. Re-approval is explicit.

**B7 — Same in Storyboard and Previs after restart.** The exact saved-and-locked Bubble/Caption or intentional No Bubble is displayed consistently in both Storyboard and Previs, without rewriting, regenerating or replacing it. Reopen the same user project through **Library → Open Example with Your Changes**, after a supported normal stop/start, and independently compare associated image and text identities.

**B8 — No collateral effects or false success.** Failed local compute, failed/expired authentication, invalid model output, missing evidence, failed/unknown encrypted write, cancellation and stale results must leave previously locked text, story canon, underlying image/Lock and unrelated Shot/profile records intact. Do not blame missing image pixels or falsely require a new sign-in if actual auth is valid. Do not display “Saved & Locked” while persistence is unknown.

## 4. State model

```text
NOT_ELIGIBLE -- image not Saved+Locked / no grounded story source --> BLOCKED
ELIGIBLE + LOCAL_WRITER_READY --> READY
READY -- Create Narration --> GENERATING_LOCALLY
GENERATING_LOCALLY -- valid proposal --> DRAFT
GENERATING_LOCALLY -- invalid/failed response --> FAILED (previous lock intact)
DRAFT -- Regenerate --> GENERATING_LOCALLY (previous lock intact)
DRAFT -- Save & Lock --> COMMITTING --> LOCKED_TEXT (only after durable confirmation)
READY or DRAFT -- No Bubble --> COMMITTING --> LOCKED_NO_BUBBLE
COMMITTING -- failure/uncertainty --> FAILED_OR_UNKNOWN (never false success)
LOCKED_* -- Human elects replacement --> READY_TO_AMEND
Any current source/version change --> STALE_OLD_RESULT
```

Formal constraints:
- `LockedPrintedDecision(d) => ConfirmedDurableCommit(d) AND ExactCurrentShotAndSource(d)`.
- `PrintedWordCount(d) <= 12`, with **5–8 words** the creative target.
- `DialogueBubble(d) => VerbatimQuote(d.text, ScreenplaySpeaker(d))`.
- `Generate(d) => ActiveProvider(d) = ConfiguredLocalWritingProvider`.
- `CloudOrAutomaticRouteFallback(d) = FALSE`.
- `NoBubble(d) => DurableIntentionalTextFree(d)`, **not** GenerationFailure.
- `StoryboardPrintedResult(d) = PrevisPrintedResult(d)` for current matching Saved+Locked images.
- `FailureOrStaleResponse => NoMutation(ExistingLocks,StoryCanon,OtherShots,OtherProfiles)`.

## 5. Independent acceptance tests

| Situation | Expected human-visible outcome | Independent evidence |
| --- | --- | --- |
| Afterglow Saved+Locked Shot with working local writer | Short meaningful Shot-specific draft | Actual local provider called and answered; rendered draft |
| Writer works without vision capability | Still produces grounded printed caption from screenplay/Shot | Actual local text route, no forced pixels / no Cloud switch |
| Image is readable by existing authorized local visual capability | Optional additional observation can inform a grounded draft | Same image version, no invented dialogue, no Cloud |
| Actual screenplay dialogue | Short authentic bubble with the correct speaking character | Compare contiguous quote/speaker to source |
| No suitable dialogue | Grounded caption beneath the image | Compare to screenplay + Shot information |
| Regenerate after an earlier saved/locked result | New draft; previous lock remains intact | Compare encrypted before/after |
| Save & Lock | Exact current printed decision gets durable confirmation | Read current encrypted decision, not UI state alone |
| No Bubble | Intentional, durable text-free frame | Reopen image; still No Bubble, not “pending” |
| Local writer missing/failing | Existing work kept, concise failure | Actual error logged; no provider switch |
| Camera/dialogue/Shot changes before delayed response | Stale response cannot change current decision | Inject change/race, compare identities |
| Application stops/restarts; open Afterglow with local changes | Identical locked image and printed text in both Storyboard and Previs | Real process, readback and visible two-surface comparison |

## 6. Existing implementation — gaps to verify, not assumed root cause

Source inspected October 8, 2026:
- `app/_components/preproduction/storyboard-locked-shot-handoff.tsx` currently uses **Create Narration / Approve text / Regenerate / Set silent**. It does **not yet implement** the revised Save & Lock / Regenerate / No Bubble Human wording and associated printed-decision semantics.
- `app/api/previs/narration/route.ts` currently sends Storyboard through a **text-only** agent and calls `resolveConfiguredAgentExecutionProfile`, which currently uses a **Hybrid-selected writing route**, not exclusively the user's configured working Local writer. Its generic text-compute error can conceal the actual failure source.
- `app/_components/previs/previs-graphic-novel-presentation.ts` currently computes a source key from screenplay, story context and presentation data but does not explicitly include **every authored Shot fact** used by the generation request.
- #2839 tests use injected successful model responses and isolated durability fixtures. A green test does **not** prove the Human's live local model can generate a bubble.

Do not assume a root cause, weaken auth, create another router/agent subsystem, install paid models, change media Save/Lock or promise every caption is artistically perfect.

## 7. Next proof sequence

1. **Human confirms this revised contract.** Nothing here authorizes implementation until approved.
2. Independently reproduce the actual Storyboard narration failure on the existing Local writing path. If no usable local model is available in CI, mark that particular real-compute test **BLOCKED**, not PASS based on a stub.
3. Capture concrete failing expectations at the true owning boundaries: local execution, original quoted dialogue, render location/form, No Bubble, exact identity, durable Save & Lock, staleness and two-surface recovery.
4. Repair only demonstrated gaps in the existing Bubble/Graphic Novel presentation, writing-provider authority and authenticated storage. Reuse existing diagnostics, agent interfaces and test harness.
5. Verify real local generation, actual rendered draft + Save & Lock/Regenerate/No Bubble, close/restart/restore and Previs consistency. Preserve explicit PASS/FAIL/BLOCKED/UNPROVEN, and require a separate Human device acceptance.

**Approval record:** User corrected initial draft on 2026-10-08: use all needed relevant information (including image information when appropriate); generate a roughly five-to-eight-word bubble or description beneath the image, no more than twelve; use only the already working configured **Local** writer, not Hybrid's alternate routes; use **Save & Lock**, **Regenerate**, **No Bubble**; display unchanged in both Storyboard and Previs after restart. The user immediately clarified **“log = lock”**. These corrections have been incorporated, but an explicit final acceptance has **not** yet been inferred.
