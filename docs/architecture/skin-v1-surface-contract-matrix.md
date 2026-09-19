# Skin V1 Surface Contract Matrix

Generated projection of the existing Skin V1 four-layer specification stack. This file is evidence, not a fifth design authority.

| Surface | Shell | Frame | Layout | Cols | Menu | Orientation | Keys | Typography | Footer | Return |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| Dashboard | dashboard-reference | layered-inset (2px + 1px inset) | directory-grid | — | directory | profile-defined | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | none |
| Community | standard | solid-standard (1px) | one-column | 1 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → dashboard |
| Writer's Craft | standard | solid-standard (1px) | directory-grid | — | directory | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → dashboard |
| Library | library-family | solid-standard (1px) | directory-grid | — | directory | horizontal | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → dashboard |
| Library · New | library-family | solid-standard (1px) | one-column | 1 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → library |
| Library · Import | library-family | solid-standard (1px) | one-column | 1 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → library |
| Library · Load | library-family | solid-standard (1px) | directory-grid | — | directory | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → library |
| Library · Examples | library-family | solid-standard (1px) | directory-grid | — | directory | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → library |
| Library · Presets | library-family | solid-standard (1px) | directory-grid | — | directory | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → library |
| Library · Avery | library-family | solid-standard (1px) | one-column | 1 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → library |
| Library · Archive | library-family | solid-standard (1px) | directory-grid | — | directory | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → library |
| Story Map | production | solid-standard (1px) | canvas-visual-workspace | — | inherited | inherited | required when menu profile exposes shortcuts | project-workspace / JetBrains Mono | required | right → dashboard |
| Scene Workspace | production-nested | solid-standard (1px) | timeline-workspace | 3 | inherited | inherited | required when menu profile exposes shortcuts | project-workspace / JetBrains Mono | required | right → storyboard |
| Visual Story | production-nested | solid-standard (1px) | canvas-visual-workspace | — | inherited | inherited | required when menu profile exposes shortcuts | project-workspace / JetBrains Mono | required | right → storyboard |
| Identity | standard | layered-inset (2px + 1px inset) | two-column | 2 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → dashboard |
| Manage | settings | solid-standard (1px) | directory-grid | — | directory | profile-defined | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → dashboard |
| General | settings | solid-standard (1px) | one-column | 1 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → settings |
| Story Mode | settings | solid-standard (1px) | directory-grid | — | directory | profile-defined | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → settings |
| Local Story Mode | settings | solid-standard (1px) | settings-directory | — | destination-navigation | vertical | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → story-mode |
| Cloud Story Mode | settings | solid-standard (1px) | settings-directory | — | destination-navigation | vertical | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → story-mode |
| Hybrid Story Mode | settings | solid-standard (1px) | settings-directory | — | destination-navigation | vertical | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → story-mode |
| Node Info | settings | solid-standard (1px) | one-column | 1 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → settings |
| Agents | settings | solid-standard (1px) | settings-directory | — | destination-navigation | vertical | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → settings |
| Bug Report | standard-restrained | solid-standard (1px) | one-column | 1 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → dashboard |
| Notices | standard | solid-standard (1px) | one-column | 1 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → dashboard |
| Shut Down Node | action | solid-standard (1px) | one-column | 1 | inherited | inherited | required when menu profile exposes shortcuts | standard-ui / JetBrains Mono | required | right → dashboard |
| Write | production | solid-standard (1px) | editor-inspector | 2 | inherited | inherited | required when menu profile exposes shortcuts | project-workspace / JetBrains Mono | required | right → dashboard |
| Storyboard | production | solid-standard (1px) | canvas-visual-workspace | — | directory | profile-defined | required when menu profile exposes shortcuts | project-workspace / JetBrains Mono | required | right → dashboard |
| Previs / Graphic Novel | production | solid-standard (1px) | canvas-visual-workspace | — | inherited | inherited | required when menu profile exposes shortcuts | project-workspace / JetBrains Mono | required | right → dashboard |
| PageFlow Diagnostics | diagnostic | solid-standard (1px) | editor-inspector | 2 | inherited | inherited | required when menu profile exposes shortcuts | project-workspace / JetBrains Mono | required | right → refine |

## Shared measurement variables

- Shell: max width, left/right gutters, document/viewport dimensions, horizontal overflow.
- Frames: outer/inset border thickness, frame-to-content containment, clipping and accidental intersections.
- Columns: semantic workspace column count, rendered grid tracks, ratios, gaps and undeclared four-column shell detection.
- Menus: family, orientation, visible labels, order, active state, keyboard cues and Return relationship.
- Typography: canonical family plus computed size, weight, line height, letter spacing and colour by semantic role.
- Scroll structure: major panel coordinates, sticky/fixed controls and total scroll height.
- Evidence: expected value, rendered value, delta, tolerance, severity and screenshot/JSON references.

Four-column subordinate card/metric groups remain valid composition details. A four-column shell is not an approved Skin V1 archetype.
