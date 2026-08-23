# PlotPickle Creative Writer acceptance checklist

Use this checklist for the end-to-end visual-writing acceptance path. The quick `smoke` UAT remains the fast navigation gate; this journey tests the product thesis.

## Persona and safety

Act like a first-time visual creative writer/director. Start with a story idea, not an AI provider. Use visible controls first. Work only in the isolated local Playwright browser. Do not use real credentials, paid generation, external writes, repository edits, or silent canon changes.

## Required journey

1. Enter PlotPickle and create a new disposable project.
2. Confirm New Project opens a blank editable Story Setup.
3. Give the project a title and audience container.
4. Use Concept Canvas for concept seed, emotional purpose, audience experience, desired visual impact, must-keep constraints and open exploration.
5. Create the World visual language and at least one reusable Location.
6. Create the protagonist with narrative and visual identity information.
7. Develop Act 1 / Block 1 as one canonical story moment and attach the character and location.
8. Reload the browser and prove project, character, location and story moment persist.
9. Storyboard: carry the same story into visual direction and exercise Keep / Change / Compare when the current local material exposes those decisions. Do not silently trigger generation.
10. Write: create representative screenplay material for the same story moment.
11. Edit: review the canonical screenplay and exercise revision controls when a candidate exists. A missing candidate is a product warning, not permission to call cloud AI.
12. Graphic Novel: carry the same story context into visual storytelling; exercise candidate review and explicit approval when a local candidate exists.
13. Build: verify the same story context remains available for assembly.
14. Feedback: create disposable anchored feedback, classify it, and confirm the source story is not changed automatically.
15. Continue that same feedback into Refine.
16. Return to Graphic Novel and confirm project identity, character/world context and screenplay material remain coherent.

## Creative-direction contract

The observable loop is Concept -> Explore -> Compare -> Direct -> Refine -> Approve -> Reuse. Character identity and Location/World direction are writing. Provider, model, endpoint and billing configuration remain in Settings.

## Verdict rules

PASS means the writer completed the creative action through understandable user-facing controls and the expected story context survived. WARN means recovery navigation was required, a candidate-dependent creative action was unavailable, or the workflow was confusing but still recoverable. FAIL means the writer could not continue, project/story context was lost, persisted data disappeared, source material changed without explicit approval, or a required deterministic creative action could not be completed.

## Evidence

Capture a screenshot for every major stage and every WARN/FAIL. The report must separate Product Flow findings from Runner / Infrastructure findings. Record project title, active workspace, Block 1 title, character count, location count and screenplay element count as continuity evidence.

## Visual intent fixtures

Use the committed screenshots under `tools/agent-plugins/plotpickle-workflow-tester/` as product-intent references, not pixel-perfect golden masters. Fresh screenshots from the current run are authoritative for the acceptance result.
