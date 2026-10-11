# #2924 — Evidence-aware Timeline Motion Director

Human requirement (2026-10-11): “We have video, images and text and the whole story and more. The agent or harness should determine if we use text to video or image to video and supply the correct info.”

## Accepted authority and inputs
A provider-neutral **Timeline Shot Generation Packet** is assembled from a locked Storyboard frame, ordered screenplay, authored Block and Mini-Block dramatic responsibility, 24-Block story orientation, saved Foundations and accepted story decisions, current Human-approved Bubble/caption (or explicit No Bubble), current Shot visual/camera direction, verified character identity/continuity and neighbouring Shot context. The actual first/last-frame authority is **not** established by the next separate Storyboard image.

Only an approval whose `graphicNovelTextSourceKey` equals the exact current Storyboard-source snapshot is included; stale or pending drafts never enter a motion prompt. All pack fields are bounded. The persisted `sourceFingerprint` is a compact, deterministic 128-bit mixing identity, not a screenplay or credential dump.

## Workflow selection
1. Resolve the selected Video route and exact currently verified provider capability; an available model or saved-but-unverified Join is insufficient.
2. A verified image-to-video workflow + actual locked Shot image → supply that image as `sourceAssetUrl`, plus story/shot/camera/continuity instructions. For first-last-frame, an independently approved last frame must also exist; the next Shot is **not** one.
3. A verified text-to-video-only workflow (e.g. LTX 2B local) → build story-grounded text prompt; **do not** send unsupported source image, and disclose to the Human that it produces a new visual interpretation instead of animating the locked still. Not an image fidelity guarantee.
4. MiniMax through ComfyUI must use the real tested `workflowFamily` returned from `/api/ai-routing/status`, **not** a hardcoded image-to-video assumption. Unknown/in-place-edit → fail before request. MiniMax direct can bind an approved image where its adapter accepts image input.
5. Explain selection and source usage in Timeline per-shot generation confirmation. Selection is deterministic and governed: never pick an unselected paid provider without a separate Human authorization, never self-upgrade untested capability. No inference until Human confirmation; no second bill on job polling/resume.
6. Provider completion requires existing exact 72-frame/24fps/~3s local trim and durable Production Take/Shot receipt. Images/Story/Narration stay untouched by automatic planning.

## Tests and limits
`tests/issue-2803-timeline-shot-generation-packets.test.mjs`: genuine strategy combinations text/image/unknown, source bindings and no invented next Shot end frame, bounded full-story/approved Bubble, durable fingerprint. Existing Storyboard Save/Lock, media route, Windows product and native media proof remain gates. The 2B LTX installation currently implements **text-to-video only**. Generating the precise locked image into motion still requires a different actually verified image-to-video workflow and its provider's capable hardware. No remote control of the Human's live Windows provider is asserted by CI.

Truth: `Mode = f(ApprovedShotPacket, SelectedVerifiedProviderWorkflow)`; `Mode=image-to-video ⇒ ActualApprovedImageSent`; `Mode=text-to-video ⇒ ImageInputOmitted ∧ DistinctReinterpretationDisclosure`; `NoValidatedModality ⇒ NoDispatch`; `StaleBubble ⇒ NotSent`; `BillingSubmission ⇒ HumanConfirmation∧SavedReceipt`.
