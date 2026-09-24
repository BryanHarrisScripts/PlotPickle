# Skin V1 logon, Learn, Outline and Storyboard polish

## Observed evidence

The September 24 Full QA bundle at `312e342` passed Standard, Interaction, Resilience, Runtime and Surface Census. Continuity failed waiting for an obsolete five-stage rail on Outline. The six Human screenshots show a sparse logon, an Explore catalogue without a direct Dashboard return, a large gap in Outline, and Storyboard detail restricted to a narrow column with 25 long empty rows.

## Human intent and boundaries

- Make the first secure logon feel like PlotPickle's public site while retaining the profile/passphrase boundary and Dashboard's Matrix vocabulary.
- A visible PLOTPICKLE header action returns to Dashboard across the active Skin V1 surfaces. Learn Explore and Storyboard also expose working Dashboard returns.
- Entering Outline from Dashboard begins at Act 1, Block 1, Mini-Block 1, with disclosure chevrons closed. Human story content and progress remain intact.
- Outline uses its viewport meaningfully. Storyboard's Beat/Shot/Frame detail fills the available browser width and 25 frame positions remain discoverable without a very tall list.
- For an individual position, prepare an editable image prompt from existing Scene/Beat/Shot/screenplay evidence, request one image only after explicit consent, convert the generated result to WebP, and attach it as a draft candidate. No invented Beat/Shot and no automatic canon promotion.
- Continuity QA follows the actual governed routes and Dashboard navigation instead of the removed five-stage rail.

## Verification

Run focused navigation/Storyboard regressions and a prompt composition check locally. GitHub independently runs required build, focused UAT, architecture and product gates on the PR head. Verify secure logon, both Dashboard returns, Outline reset/collapsed state, full-width Storyboard detail, and one configured image route in the Windows app. The image request needs a configured route and must never silently switch to a paid provider.
