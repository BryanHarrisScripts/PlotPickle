# Skin V1 Surface Contract Matrix

Issue: #2270

Generated projection of the existing Skin V1 four-layer specification stack. This file is not an independent design authority.

Standard WebMCP surfaces: 30

| Surface | Parent | Shell | Frame | Layout | Cols | Menu | Keys | Typography | Footer | Local Nav |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| dashboard | — | dashboard-reference | layered-inset | directory-grid | profile | directory | menu-profile | standard-ui | required | profile/none |
| community | dashboard | standard | solid-standard | one-column | 1 | none/local | when-declared | standard-ui | required | profile/none |
| writers-craft | dashboard | standard | solid-standard | directory-grid | profile | directory | menu-profile | standard-ui | required | profile/none |
| library | dashboard | library-family | solid-standard | directory-grid | profile | directory | menu-profile | standard-ui | required | profile/none |
| library-new | library | library-family | solid-standard | one-column | 1 | none/local | when-declared | standard-ui | required | profile/none |
| library-import | library | library-family | solid-standard | one-column | 1 | none/local | when-declared | standard-ui | required | profile/none |
| library-load | library | library-family | solid-standard | directory-grid | profile | directory | menu-profile | standard-ui | required | profile/none |
| library-examples | library | library-family | solid-standard | directory-grid | profile | directory | menu-profile | standard-ui | required | profile/none |
| library-presets | library | library-family | solid-standard | directory-grid | profile | directory | menu-profile | standard-ui | required | profile/none |
| library-avery | library | library-family | solid-standard | one-column | 1 | none/local | when-declared | standard-ui | required | profile/none |
| library-archive | library | library-family | solid-standard | directory-grid | profile | directory | menu-profile | standard-ui | required | profile/none |
| story-map | dashboard | production | solid-standard | canvas-visual-workspace | profile | none/local | when-declared | project-workspace | required | profile/none |
| scene-timeline | storyboard | production-nested | solid-standard | timeline-workspace | profile | none/local | when-declared | project-workspace | required | profile/none |
| visual-story | storyboard | production-nested | solid-standard | canvas-visual-workspace | profile | none/local | when-declared | project-workspace | required | profile/none |
| profile | dashboard | standard | layered-inset | two-column | 2 | none/local | when-declared | standard-ui | required | profile/none |
| settings | dashboard | settings | solid-standard | directory-grid | profile | directory | menu-profile | standard-ui | required | profile/none |
| general | settings | settings | solid-standard | one-column | 1 | none/local | when-declared | standard-ui | required | profile/none |
| story-mode | settings | settings | solid-standard | directory-grid | profile | directory | menu-profile | standard-ui | required | profile/none |
| local-ai | story-mode | settings | solid-standard | settings-directory | profile | destination | menu-profile | standard-ui | required | profile/none |
| cloud-story-mode | story-mode | settings | solid-standard | settings-directory | profile | destination | menu-profile | standard-ui | required | profile/none |
| hybrid-story-mode | story-mode | settings | solid-standard | settings-directory | profile | destination | menu-profile | standard-ui | required | profile/none |
| node | settings | settings | solid-standard | one-column | 1 | none/local | when-declared | standard-ui | required | profile/none |
| agents | settings | settings | solid-standard | settings-directory | profile | destination | menu-profile | standard-ui | required | profile/none |
| issue-log | dashboard | standard-restrained | solid-standard | one-column | 1 | none/local | when-declared | standard-ui | required | profile/none |
| licensing | dashboard | standard | solid-standard | one-column | 1 | none/local | when-declared | standard-ui | required | profile/none |
| shutdown-node | dashboard | action | solid-standard | one-column | 1 | none/local | when-declared | standard-ui | required | profile/none |
| write | dashboard | production | solid-standard | editor-inspector | 2 | none/local | when-declared | project-workspace | required | profile/none |
| storyboard | dashboard | production | solid-standard | canvas-visual-workspace | profile | none/local | when-declared | project-workspace | required | profile/none |
| previs | dashboard | production | solid-standard | canvas-visual-workspace | profile | none/local | when-declared | project-workspace | required | profile/none |
| pageflow | refine | diagnostic | solid-standard | editor-inspector | 2 | none/local | when-declared | project-workspace | required | profile/none |

## Authority boundary

- tokens: app/skin-v1-definition.css
- composition: config/skin-v1-surface-composition-reference.json
- anatomy: config/skin-v1-surface-anatomy-contract.json
- declarations: config/skin-v1-surface-declarations/
- registry: config/skin-v1-surface-registry.json
- grammar: config/skin-v1-surface-grammar.json
- specSheet: config/skin-v1-spec-sheet-contract.json

## Measurement policy

- Browser execution: existing #2246 Browser Verification Broker.
- Rendered collector/verdict: existing Visual Director path.
- Four-column shell: prohibited until a future Human-approved grammar change; subordinate four-across content remains allowed.
- Geometry evidence: .artifacts/browser-diagnostics/skin-v1-visual-director/geometry/.
- Screenshots remain supporting evidence; expected state remains the existing token/composition/anatomy/declaration stack.
