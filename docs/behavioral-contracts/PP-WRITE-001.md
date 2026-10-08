# PP-WRITE-001 — Verified Writing Capability and Minimal Bubble Decisions

Status: proposed executable behavioral contract, 2026-10-08. Owners: Settings Local/Cloud, Hybrid route harness, Storyboard Bubble Agent, Collection Agent. Related: #2841, #2855, PP-NARR-001.

## Human truths (authority over incidental screens)
- **T1 — Collect comprehensively:** The Collection Agent can retain the full versioned, provenance-linked story and production understanding (script, world, characters, continuity, location, camera, lighting, sound, creative decisions). The 4,000-character approval-key storage limit does **not** limit collected knowledge. Collection is not a Bubble writing request.
- **T2 — Retrieve selectively:** A Bubble request is grounded in the exact selected Shot, approved locked frame, relevant beat, screenplay/dialogue and audience-information boundary. Only the information necessary for this moment's narrative advancement crosses into the writer prompt; do not dump the complete Collection corpus.
- **T3 — Decide precisely:** For one approved Shot, propose **one short** speech bubble grounded in real speaker/dialogue, or a short non-dialogue caption, or no text; do not invent dialogue, speakers, camera facts or previously unseen canon. Human Save & Lock is authoritative. Regenerate does not overwrite that decision. Previs plays the decision and never writes narration.
- **T4 — Discovery is not verification:** A running runtime, installed model, automatically populated model slot, hardware-capability estimate or connection probe is **not** successful Writing execution. Configured, reachable, suitable, tested and selected are separate observations. A green Ready marker requires current successful **text-generation proof** for the exact runtime, endpoint, model and relevant writing role.
- **T5 — Route and role truth:** Settings Local Writing, Hybrid Writing and Storyboard narration must identify and agree about the *actual execution provider/model*. Local setup never silently activates Hybrid selection. If Bubble generation uses a dedicated Local Quality writer independently of Hybrid, the UI must explicitly say so and verify **that same Quality model**; otherwise Bubble must consume the verified Hybrid Writing route. This precedence must be resolved explicitly, not hidden.
- **T6 — Single test, faithful effect:** Test Writing must execute a bounded real text-generation request through the same configured adapter and model used by narration, persist verified configuration identity and timestamp, and display meaningful failure reasons. Changing model, endpoint or runtime invalidates only relevant verification. Synthetic CI fixtures prove wiring, never the Human's installed model.
- **T7 — Isolation:** Image/video software and catalog items (ComfyUI, SDXL, Qwen Image, LTX, H3) cannot satisfy Local Writing readiness. Primary Writing setup shows only the selected text runtime/model and actionable Writing test; optional full hardware inventory belongs in advanced cross-capability diagnostics.
- **T8 — Fail closed without surprise costs:** If selected Writing cannot execute, narrating is blocked with exact readiness explanation and Settings destination. There is no silent paid cloud fallback. Settings status reads cannot select/activate a provider or grant consent.
- **T9 — Source identity and recovery:** Bubble approvals reference exact Shot and approved image via bounded stable source identity. Relevant edits invalidate them; unrelated edits do not. Save & Lock survives encrypted unload/reopen and actual process restart; Storyboard and Previs show the same text.
- **T10 — Verification governs merge:** Automated verification separately exercises state transitions, actual authenticated provider test/dispatch, invalidation, Local↔Hybrid agreement, Storyboard request, durable recovery and rendered UI. Build-green alone is not proof the Human's local Windows model ran.

## Required state transitions
`not configured → configured/unverified → verifying → verified/ready`; failures become `unavailable` or `test failed` with bounded diagnostics; configuration change returns to `configured/unverified`. `selected` is orthogonal. A selected route may become blocked but must not silently switch.

## Phase sequencing
1. Implement a bounded Local Writing readiness/read-only presentation and clear model-role preflight; remove misleading cross-media main-panel evidence.
2. Exercise a real text response test for the exact Bubble execution role, unify Local/Hybrid semantics, and prove invalidation.
3. Demonstrate the actual installed Windows model, then full Storyboard→Previs Save & Lock and distinct-process reopen. Do not claim phase 3 from mocked CI.

## Counterexamples that must fail
- Detected Ollama or Quality model with no successful Writing response is shown Ready.
- Fast model test grants Quality model narration readiness.
- Model or endpoint changed while prior Ready remains green.
- Bubble executes a different provider/model from the one displayed as verified.
- SDXL/LTX video presence implies a text-writer exists.
- Model request auto-uses paid Cloud after Local fails.
- Old approved Bubble reappears after changing its Shot or approved image.
