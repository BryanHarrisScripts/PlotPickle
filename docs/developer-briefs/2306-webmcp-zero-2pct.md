# Developer Brief — WebMCP Zero-Finding / 2% Acceptance Convergence

## Purpose

Converge the current post-#2302 WebMCP Full QA result from a PASS-with-advisories state to a machine-enforced clean acceptance state:

- 0 blockers;
- 0 advisories;
- 0 UI conformance violations;
- governed visual/geometry deviation no greater than 2%;
- functional, accessibility, navigation, continuity, resilience and runtime correctness remain zero-tolerance.

This issue is intended to provide the final bounded acceptance layer needed to close #2302, #2272 and #2226 once the resulting exact-head gates and Human WebMCP rerun are green.

## Starting evidence — 2026-09-20 post-#2302 Human WebMCP rerun

FULL QA: PASS

- STANDARD: 0 blockers, 2 advisories
- INTERACTION: 0 blockers, 5 advisories
- RESILIENCE: 0 blockers, 0 advisories
- CONTINUITY: 0 blockers, 0 advisories
- RUNTIME: 0 blockers, 15 advisories
- UI conformance: 117 governed rendered elements, 0 violations
- Standard catalogue: 30 surfaces
- Visual Director: 29 submenus compared against Dashboard
- Dashboard remains the canonical Skin V1 visual reference

Observed Standard advisories:
- LOCAL_AI structural-dead-space: 282px vs current <=240px peer-derived limit
- CLOUD_STORY_MODE structural-dead-space: 282px vs current <=240px peer-derived limit

The Interaction findings collapse to a shared keyboard/focus-entry condition on menu/settings family surfaces.

The Runtime findings largely collapse to detector/contract ownership:
- global Back/Return controls measured outside a content root despite belonging to the governed shell;
- intentional horizontal scrolling treated as clipping/overflow;
- one Storyboard horizontal-overflow discrepancy requiring confirmation/root repair rather than suppression.

## Governing acceptance model

### 1. Zero findings is the merge target

For the WebMCP Full QA aggregate:
- STANDARD = 0 blockers / 0 advisories
- INTERACTION = 0 blockers / 0 advisories
- RESILIENCE = 0 blockers / 0 advisories
- CONTINUITY = 0 blockers / 0 advisories
- RUNTIME = 0 blockers / 0 advisories
- UI conformance = 0 violations

Do not satisfy this by globally silencing categories or deleting useful verification.

### 2. 2% applies only to governed visual/geometry variance

Introduce one explicit normalized visual tolerance:
- visual/geometry measurements may deviate by at most 2% from the declared contract/reference dimension where relative tolerance is semantically valid.

Examples:
- width/height alignment;
- gutters;
- spacing;
- offsets;
- panel/control sizing;
- frame alignment.

Where a measurement is inherently absolute or semantic, retain the stronger contract instead of forcing a percentage.

### 3. Zero-tolerance categories remain zero-tolerance

Do not apply the 2% allowance to:
- broken media;
- keyboard/focus failure;
- inaccessible controls;
- navigation failure;
- state/continuity failure;
- runtime errors;
- missing required controls/regions;
- genuine page-level horizontal overflow;
- malformed/failed resilience scenarios;
- required shell/return ownership.

These either satisfy the contract or fail.

## Work packages

### A. Fix real rendered/UI defects
- Fix Tab-entry/focus behavior on the affected Library/Settings/Story Mode/Local Story Mode/Cloud Story Mode family so the first Tab enters a meaningful interactive control.
- Resolve the two 282px structural dead-space findings through governed structure/layout, not detector suppression, unless investigation proves the detector is measuring an intentional declared structure; if intentional, encode the structure contract explicitly.
- Confirm the Storyboard 18px runtime horizontal-overflow discrepancy and remove the actual overflow if real.

### B. Correct runtime geometry ownership
- Teach rendered/runtime inspection that canonical shell Back/Return controls may live outside the content workspace root while remaining inside the governed surface shell.
- Do not emit overflow/root-boundary advisories for such declared shell-owned controls.
- Preserve detection for genuinely escaped/overlapping content.

### C. Correct intentional scroll-container semantics
- Recognize declared horizontal scrolling containers such as Visual Story scene/shot strips.
- Content extending inside a valid overflow-x scroll container is not page clipping.
- Page-level overflow or undeclared clipped content remains a finding.

### D. Add the 2% visual tolerance authority
- Define a single reusable 2% visual geometry tolerance in the existing Surface Grammar/verification authority rather than scattering local magic numbers.
- Normalize relative measurements against the relevant declared/reference dimension.
- Keep absolute minimums only where the contract semantically requires them.
- Add deterministic tests for pass at <=2% and finding at >2%.

### E. Tighten Full QA acceptance
- Full QA may report PASS only when all five governed profiles are zero-blocker/zero-advisory under this convergence gate.
- Aggregate evidence must include the visual tolerance result and zero-finding assertion.
- Do not create a second WebMCP runner or second visual authority.

## Preserve
- Dashboard as canonical Skin V1 visual reference;
- current 30-surface Standard catalogue;
- current Surface Registry + Surface Grammar authority;
- Browser Verification Broker;
- existing WebMCP five-profile architecture and Full QA option 6;
- #2302 seven-group Dashboard IA;
- PPF/story/project authority;
- existing intentional scroll experiences;
- current shell/navigation semantics.

## Non-goals
- no visual redesign;
- no new surface registry;
- no second geometry inspector;
- no blanket advisory suppression;
- no arbitrary 2% allowance for functional behavior;
- no new agent;
- no expansion of the 30-surface catalogue solely to satisfy this issue;
- no baseline promotion without Human approval.

## Acceptance criteria
- [ ] Developer brief exists in docs/developer-briefs and matches this issue.
- [ ] A single existing verification authority exposes the 2% governed visual tolerance.
- [ ] <=2% visual/geometry deviation passes; >2% produces a deterministic finding where relative tolerance applies.
- [ ] Functional/accessibility/navigation/runtime invariants remain zero-tolerance.
- [ ] Five affected menu/settings-family surfaces have valid Tab-entry focus.
- [ ] LOCAL_AI and CLOUD_STORY_MODE no longer emit structural-dead-space advisories for the current governed design.
- [ ] Shell-owned Back/Return controls no longer emit false runtime root-boundary findings.
- [ ] Declared horizontal scroll containers no longer emit clipping/overflow findings.
- [ ] Storyboard page-level horizontal overflow is 0 or is proven to be a detector error and corrected at the detector root.
- [ ] WebMCP Full QA acceptance requires 0 blockers and 0 advisories in all five profiles.
- [ ] STANDARD = 0 / 0.
- [ ] INTERACTION = 0 / 0.
- [ ] RESILIENCE = 0 / 0.
- [ ] CONTINUITY = 0 / 0.
- [ ] RUNTIME = 0 / 0.
- [ ] UI conformance = 0 violations.
- [ ] Focused deterministic tests pass.
- [ ] Exact-head Architecture Verification is green.
- [ ] PR merges only when required checks are green.
- [ ] Post-merge Human WebMCP Full QA is expected to report literal zero findings.
- [ ] Once confirmed, #2302, #2272 and #2226 may close as completed.

## Closure rule

Do not close #2302, #2272 or #2226 until this issue is merged green. #2302 already has its post-merge Human WebMCP evidence; this issue converts that evidence into the final zero-finding acceptance contract shared by the older convergence work.
