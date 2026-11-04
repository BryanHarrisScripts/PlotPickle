# PP-STUDIO-001 — Saved Storyboard Handoff and Single Studio Workspace

**Status:** APPROVED by the Human on 2026-11-03 for issue #3398 and PR #3397.  
**Contract version:** 1.0.0  
**Scope:** The selected saved PPF's Outline-to-Storyboard navigation and the Storyboard and Previs workspace presentation.

## Approved behavior

**S1 — Preserve the selected saved story at the Storyboard handoff.** Clicking the Outline's Storyboard link preserves the selected saved PPF identity and its source evidence in the destination workspace. The destination must show the same selected project, rather than an untitled or substitute story. This navigation does not import, rewrite, or approve screenplay content.

**S2 — Present one usable Studio workspace.** Storyboard and Previs each show one Studio shell, one Elara room, and a usable canvas. A nested shell or duplicate Elara room does not satisfy the contract. The canvas must remain accessible for inspecting the selected story's production records.

## Independent evidence and limits

Focused regression can check navigation identity and route composition. Authenticated Windows browser review must independently confirm the selected project and source evidence after navigation, count the visible shells and rooms, and inspect canvas usability. A passing regression or build does not verify saved media bytes, image generation, provider execution, screenplay completeness, or a playable film.
