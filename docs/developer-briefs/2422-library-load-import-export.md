# Developer Brief — #2422 Library opens on Load

## Goal

Library opens directly on Load. Its directory order is Load, New, Import Export, Examples, Presets, Avery, Archive. A Back to Dashboard action returns directly to Dashboard from a Library destination.

## Implementation

- Select and render Load on entry. Preserve the existing single-surface keyboard directory, with shortcuts and arrow-key order matching the new menu.
- Combine Import and Export in one destination. Keep the existing legacy .ppf import gateway and add a canonical .ppf.json Library backup path in the existing core Library storage owner. Validate the backup before normalization, limit import size to 48 MB, and create a separate local working story. Export the active local Library project through a browser download without changing its content or active selection. Explain that local image files are separate from the backup.
- Change the Library return and Avery session return to Back to Dashboard. Keep the parent dashboard host's return behavior.
- Update the Surface Contract registry, capture target, visual candidate manifest, and menu audit to match the new menu and direct return. Preserve existing governance IDs where possible.

## Proof

Focused navigation regressions and canonical backup round-trip, followed by a production build. The current repository also has unrelated stale Avery/Story Mode assertions; report those separately. GitHub verifies the exact published head. Live visual observation remains needed for the updated Library menu.
