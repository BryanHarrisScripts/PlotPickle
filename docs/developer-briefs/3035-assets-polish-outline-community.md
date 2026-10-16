# #3035 — Polished ASSETS presentation without altering creative truth

Based on Human screenshots October 16: bare folder controls, elongated poster dump, awkward positioning and giant Mind Map character media are poor end-user presentation. Reference existing polished Outline/Community (panel hierarchy, focused selected state, keyboard navigation, coherent Matrix typography and colors).

- One current-PFF header with Dashboard return and stable selected story.
- Five responsive category tabs: Sounds (Foley / Narration / Music), Characters, Collectibles (honest deferred), Posters, World.
- ASSETS overview landing with summary of saved project assets and project ownership. Image capability route selector in collapsed, discoverable provider details; no hidden route mutation when opening.
- Posters: one selected large contained preview, accessible thumb strip with saved draft vs approved, Generate → inspect → Save draft → explicit Approve for Library; do not overwrite Afterglow/Brotherly Love approved marketing art or expose raw manifest paths. Existing `lockedMarketingReference` remains authority in Library.
- World: read-only retained world reference gallery with one selected preview, status. Future location-image authoring remains a separate #3019 gate.
- Characters: keep existing polished roster/Truth and eight views plus new #3032 deliverable studio; no double-store or silent version lock.
- Accessibility: tab focus-visible, aria-current/pressed, keyboard-operable actual buttons, bounded image dimensions, responsive narrow viewport. No re-generations or paid provider calls for navigation.
- Verify current screenshots via Windows/visual readiness where selected; static W8/W9 source-bound tests, selected CI, build/test/fix/PR/green merge. Human UAT after all #3032/#3033/#3035, by explicit request.
## Regression review (October 16)
The #3019 original asset-folder test asserted five literal JSX buttons. Its normative requirement is preserved by the new five-entry mapped ARIA-labelled tab navigation, verified selected-state and intact Sounds/Characters/Posters/World/Collectibles boundaries. The legacy test now checks the equivalent folder IDs and selection affordance; its exact changed bytes and original approved W8/W9 requirements were re-admitted without deleting the test. The prior CI failed by design when its source fingerprint was stale; source admission is separately verified from actual runtime rendering.
