# Issue #2023 — Open Source + Dashboard Help / Issue Log

## Human finding
The connected Open Source row is green but leaves Skin V1 through `location.assign("/legal")`. The standalone Legal / About / Suggest-Report chain introduces a second visual/navigation system, direct GitHub links and a support path that can strand the Human.

## Product rule
Open Source is one informational Dashboard surface. It is not a submenu and it does not own product support. Help / Issue Log is a first-class Dashboard destination directly below LOG OFF.

While this work is under Human review, Open Source and Help / Issue Log remain fully openable but use the yellow review marker. Promote each to green only after focused verification and visible Human acceptance.

## Open Source target
Render one Skin V1 panel inside Dashboard state with Human-language sections for:
- Your Work — the Human keeps whatever rights they hold in stories, characters, dialogue, images, notes, PPF projects and exports; PlotPickle does not take ownership.
- PlotPickle Software — AGPL-3.0-or-later; software may be run, studied, copied, modified and redistributed subject to that licence and notices.
- 24 Blocks + reusable instructional material — CC BY-SA 4.0 where identified.
- Privacy — local-first by default; only deliberate selected external actions send selected content to the chosen external service.
- Community — difficult fictional/educational subject matter is not itself misconduct; real harassment, threats, privacy violations, credential sharing and deliberate disruption remain outside the boundary.
- Server Operators — advanced operator-run deployments own their security/privacy/support obligations and AGPL network-source obligations for modified editions.
- Third-party material keeps its own licence/notice terms.

No Open Source submenu. No Help/Suggest action inside Open Source. No ordinary link to the PlotPickle GitHub repository. No legacy standalone-studio chrome.

## Help / Issue Log target
Add `[H] Help / Issue Log` immediately below `[X] Log Off` on the Dashboard. It opens inside Dashboard state and follows Skin V1 typography, focus and Back/Escape behavior.

The current runtime has no safe in-app ticket-submission backend. Do not claim a ticket was sent and do not open GitHub as the primary Human action. The first reviewable slice may prepare a sanitized issue draft inside PlotPickle and clearly state that submission/sync is not yet connected. Reuse the existing product-feedback redaction/diagnostic boundary rather than collecting project/story content.

## Navigation contract
- Enter/Space activates the selected row.
- Escape and the visible Back control return exactly one level to Dashboard.
- Returning restores a useful Dashboard focus target.
- Open Source and Help / Issue Log never call `location.assign`, `window.open` or direct the Human to GitHub in the ordinary path.

## Implementation boundary
Prefer Dashboard-owned local panel state in `app/skin-v1/dashboard-bbs-panel.tsx`, matching Settings/Writer's Craft surface ownership. Keep standalone `/legal`, `/about` and `/suggest-report` routes available only as compatibility/public references unless separately retired; they are no longer the ordinary Dashboard path.

## Verification
Add focused static/navigation regression coverage for:
- Help / Issue Log row immediately after Log Off.
- yellow/openable review status for Open Source + Help / Issue Log.
- in-app Open Source and Help panels.
- no `/legal` hard navigation from Open Source.
- no GitHub links or Help/Suggest controls on the Open Source panel.
- Back/Escape handlers for both panels.
- authoritative AGPL / CC BY-SA / user-work boundaries remain visible.

Run the exact-head Architecture Verification gate. Inspect only failed layers. Keep both surfaces yellow for Bryan's live test after CI is green.
