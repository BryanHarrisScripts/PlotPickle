## Purpose

Explain the user-facing problem and the smallest complete outcome.

## What changed

- 

## Validation

- [ ] Focused test added or updated
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] Public Readiness
- [ ] Phase 1 validation
- [ ] PlotPickle Quality
- [ ] Release Candidate when packaging or runtime behavior changes
- [ ] Repomix

## Privacy, security and rights

- [ ] No API keys, OAuth secrets, tokens, certificates or private keys are included
- [ ] No private story projects, backups, unpublished dialogue or personal information are included
- [ ] New dependencies and third-party assets have compatible licences
- [ ] Logs and screenshots are sanitized

## Interface changes

Include screenshots or a brief explanation of why screenshots are not applicable. Note keyboard, accessibility and Windows behavior where relevant.

### UI/UX & Continuity Compliance Checklist

> **Note for authors and reviewers:** Every PR modifying visual components, views or user workflows must pass every applicable check below before merging. Mark non-applicable items with a brief explanation in the PR body rather than silently skipping them.

- [ ] **1. Single Primary Action:** Every action-bearing view/screen contains exactly **one** primary CTA (solid/high-emphasis, highest contrast). Read-only status views may contain zero. Secondary and tertiary actions use outline, ghost, menu, icon or text-link variants.

- [ ] **2. Nav & Destination Grouping:** No view exposes more than **7 top-level interactive choices** simultaneously. Workflow options beyond this baseline use progressive disclosure such as grouped navigation, tabs, sub-menus, drawers or accordions.

- [ ] **3. Interactive Target Sizing:** Normal clickable/tappable controls maintain a minimum **44 x 44 CSS px hit target** using the PlotPickle `--pp-touch-target` contract, with at least **8px spacing** between adjacent independent targets. Any justified exception is documented.

- [ ] **4. Hardcoded Style Prohibition:** No new hardcoded product HEX/RGB/HSL values, arbitrary one-off spacing, independent radius/shadow systems or non-standard styling tokens are introduced. Product styling references established PlotPickle `var(--pp-...)` design tokens and the 4px/8px spacing grid.

- [ ] **5. Five-State Coverage:** Every altered or new data-driven component explicitly handles all applicable UI states:
  - [ ] Ideal State — full content
  - [ ] Empty State — first-time/no-data guidance with a useful first action
  - [ ] Loading State — skeleton/progress treatment with no avoidable layout shift or blank frozen-looking surface
  - [ ] Partial State — sparse/single-item/incomplete content remains useful
  - [ ] Error State — human-readable message plus actionable recovery path

- [ ] **6. Color Contrast & WCAG 2.2 AA:** Text/background contrast meets or exceeds **4.5:1** for normal text and **3:1** for large text; applicable UI boundaries/non-text contrast meet WCAG requirements. Color is never the sole indicator of state or error.

- [ ] **7. Keyboard & Focus Management:** The complete normal workflow is operable by keyboard alone. `focus-visible` indicators remain visible and unobscured, focus order is logical, dialogs manage focus correctly, and users are never unintentionally trapped.

- [ ] **8. Screen Reader & ARIA Contract:** Interactive controls without a visible text name have a valid accessible name (`aria-label`, `aria-labelledby`, or another semantic naming source). ARIA references resolve to real IDs, native semantics are preferred, and dynamic status updates use live/status regions only where appropriate.

- [ ] **9. Destructive Action Safeguards:** Destructive operations such as delete, overwrite, purge or destructive reset use the danger token at the point of decision, require an explicit confirmation boundary when irreversible/high-impact, and are never the default-focused confirmation action.

- [ ] **10. Audit & Test Gate Pass:** Existing UI/UX code audit, continuity tests, accessibility checks, Playwright/UAT journeys and applicable visual-regression checks pass without bypassing, suppressing or weakening rules merely to make the PR green.

## Release note

Describe what a writer will notice, or write `No user-facing release note`.