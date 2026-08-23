# Visual Writing Human Journey Gate

This gate is the final usability proof for the visual-writing programme.

Required behavioral loop:

1. Capture concept intent.
2. Attach a visual reference.
3. Create or import an exploration candidate.
4. Direct a revision with writer-facing controls.
5. Compare candidates.
6. Approve a human-selected result.
7. Reuse approved continuity.
8. Create an image-to-story proposal and explicitly accept, edit, reject, or defer it.

Required execution states:

- local generation;
- manual/no-AI path;
- provider unavailable with recovery and Settings handoff;
- paid cloud route before confirmation, which must remain blocked;
- paid cloud route after action-specific confirmation.

Required persistence proof:

- state resumes after reload;
- export/import retains the current approved package, lineage, continuity, contribution ledger and proposal state;
- project cloning does not introduce credentials or provider-private payloads.

Required visual/accessibility evidence:

- concept capture at desktop width;
- candidate comparison at desktop width;
- approval/continuity controls at mobile width;
- image-to-story proposal at mobile width;
- no clipped or unreachable primary actions;
- keyboard-focusable primary actions and meaningful accessible labels.

The behavioral gate must not be considered passing unless the repository UI/UX audit and applicable accessibility, persistence, visual-regression and repository-wide gates also pass.
