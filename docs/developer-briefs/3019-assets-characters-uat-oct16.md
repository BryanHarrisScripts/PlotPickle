# #3019 UAT continuation — screenplay roster, asset outputs, provider routing, and CMD confirmation

Date: October 16, 2026
Parent: [#3019](https://github.com/BryanHarrisScripts/PlotPickle/issues/3019)
Observed product: Brotherly Love selected PPF, image route ComfyUI local; OpenAI Images configured but **not verified**. Human tested Posters/Characters, supplied images of Command/ASSETS/Mind Map.

## Human intent, exact scope
1. **Cast names come from the screenplay.** The user must not retype names already present in imported screenplay dialogue/character cues. Current `mindMapCharacterRoster()` reads only `sourceEvidence.characterTruth` and may miss characters not yet made canonical. Show screenplay discoveries with retained passage refs, reconcile canonical IDs and aliases and enable explicit review into Character Truth; do not silently accept inferred identities or invent role descriptions.
2. **Full character sheet and square portrait are separate creative deliverables.** A production reference sheet (front/back/angle/expression/poses etc., reviewable layout) and a true 1:1 portrait (profile/Community/Library reuse). A composite single image should not count as eight independently saved/view-verified angles. Keep existing World Map 8-view/5-version lock contract until a separately reviewed migration establishes new asset kinds.
3. **Select Local/Cloud/Hybrid directly in ASSETS.** One clear in-workspace provider control can invoke existing verified authenticated connection routes; show current route, readiness and model, preview selected action and ask for cloud charges/data sharing authorization before requests. Do not invent a second routing config, auto-confirm CMD, silently fall back to paid compute, leak credentials or modify accepted story.
4. **Make exact connection-confirm action orange.** User missed confirmation in a long plain transcript. Highlight one-time `PlotPickle connections confirm <ephemeral 16-hex token> charges` (and share/performance variants) as high-contrast orange, distinct on its own line, while maintaining a real manual confirmation step and 120-second expiry. The Human's screenshot token is historical; do not hardcode it, transmit it to GitHub, or presume it is still valid.
5. **Polish ASSETS.** Use Outline/Community's keyboard-accessible selected item rail, responsive cards, clear preview/version tabs and readable status/disabled reasons; avoid huge columns of full poster sheets or unstyled buttons. Preserve working Posters/Afterglow Library behavior.

## Repository-grounded facts
- `app/skin-v1/assets-characters.tsx` is a dedicated Characters asset workspace; `modules/learn/model/mind-map-character-roster.ts` reads `sourceEvidence.characterTruth` only and existing `worldMap.characterVisuals`.
- `core/contracts/imported-screenplay-evidence/index.ts` preserves typed screenplay passages with source IDs, scenes and text; extraction must be deterministic and traceable, reviewed before canon mutation.
- `core/contracts/world-map/index.ts` owns eight character views, stable version identities and a complete-set Lock; draft generation is noncanonical.
- `app/_components/settings/connection-command.mjs` creates bounded, ephemeral Test→Preview→Confirm→Select operations; `app/skin-v1/global-dsdd-conversation.tsx` owns transcript presentation and must not mutate provider contracts to adjust visual emphasis.
- Current `config/verification/test-catalog.json` W8/W9 truth bindings need exact input hashes for any touched product source.

## PR slices and acceptance
| Order | Issue | Outcome | Authority and gates |
| --- | --- | --- | --- |
| 1 | #3034 | Orange dynamic confirmation instruction (no auto-confirm) | Only valid connection preview; synthetic tokens; Command focus/contrast/regression |
| 2 | #3031 | Screenshot-independent readable source-linked cast roster with accepted/candidate states | Exact PPF, deterministic screenplay parser, duplicate/alias and role review, save/reopen |
| 3 | #3032 | Character Sheet + 1:1 Portrait mode with independent asset IDs | Source-bound generation, aspect proof, actual image bytes, approval/lock, downstream select |
| 4 | #3033 | Local/Cloud/Hybrid route/status actions from ASSETS | Same `/api/ai-routing` authority, paid confirmation, no route drift or hidden spend |
| 5 | #3035 | Unified ASSETS UX and previews | Outline/Community design cues, desktop/mobile/keyboard captures, regression to posters |

## Gate & test discipline
Build → focused deterministic tests → fix → open PR → required architecture and selected Windows CI → independent review → squash merge **only green**. Human's real Brotherly Love UAT remains distinct from synthetic tests. Preserve project identity, originals and API secrets; no paid tests or real cloud calls from CI. Never classify merely visual composite sheets as independent 8-view canon. Mark inaccessible X reference as design inspiration **unverified** until user screenshot supplied.

### First bounded implementation #3034
Use presentation-only recognizer on trusted tool message text that begins with `CONNECTION PREVIEW -`. Match dynamic `PlotPickle connections confirm <16-hex>` and its exact optional charges/share/performance flags, split the confirmation span from surrounding tool text, render semantic highlighted action line with orange text/background/border under the skin palette. Other chat and raw user input should not highlight. No request is made by rendering. Test positive variants, invalid/expired/non-preview, plain text preservation and W8/W9 governance.