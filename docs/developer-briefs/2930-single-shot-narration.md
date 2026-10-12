# Developer brief — #2930: single-Shot images and truthful local narration recovery

Reference: Human October 12 screenshot of Storyboard Shot 01/25 showing INVALID_NARRATION_OUTPUT, OUTPUT_VALIDATION, first INVALID_DIALOGUE_SHAPE and second INVALID_SHOT_RESPONSE; prior request/screenshot for removing group-of-five/all-25 and the repeated checkbox. Builds on merged #2928/#2929. Parent PP-NARR-001 #2855 remains attended real-local-model acceptance.

## Problem and expected Human workflow
Create Storyboard Image Prompt → Create Storyboard Image → repeat image creation from the **same original** per-Shot prompt → choose/save/lock one image → Prepare Narration Brief → review brief → Create Narration → Human Save & Lock. The UI does not produce or expose a group-of-five or 25-image batch, nor a text editing/batch modal or redundant checkbox. The right-hand Storyboard Image Prompt remains visible.

## Boundaries
- A new original prompt is generated deterministically from the mapped screenplay, scene, beat, narrative Shot role, character truth and continuity. Save it with exact anchorRef and position in normalized project.production.storyboardImagePrompts, bounded to 2,400 Shots. Existing historical image prompts can be used unchanged. A recovered image missing its original prompt must NOT claim a recovered original; newly generated prompts are distinct and do not alter the locked visual.
- Further image candidates use the exact stored prompt. Only the current position can be sent for generation; candidates remain drafts until Save, then explicit Lock. Existing locked image persists untouched.
- Remove repetitive checkbox but require the existing common confirmation for each potentially charged cloud dispatch. Route readiness is read immediately before dispatch, and no request occurs without selected/ready route. Never silently send data or money to another provider.
- Narration remains exclusively on the verified Local Writing route, with 12-word/100-character printed limit, exact screenplay dialogue ownership, one Shot per response and no invented speech, image pixel assumptions, automatic approval or paid fallback. Single bounded correction reuses the same story packet but a shorter format-specific instruction, with a safe compatibility envelope for exact position numeric string/single-shot caption; wrong Shot/invented dialogue still produce safe 502 and do not modify approvals.

## Verification gates
- Tests: issue-2930 single-shot and narration regression included in the existing issue-2839 Windows narration gate, issue-2807 handoff, issue-2928 layout; historical Save/Lock/Previs identity tests; review normalized per-Shot prompt readback.
- Build and source code quality; exact-head GitHub Architecture layers, CodeQL and Windows Product Build including the rendered Storyboard proof. Failures must be fixed on the same branch and rerun; merge only green.
- Synthetic inference/CI does not claim the Human's own installed local model returned a valid creative caption; attended local inference and image creation remain part of #2855 / related UAT.
