# #2825 — OpenPencil live reference, working experiment, review, and explicit approval workflow

## Objective

Make OpenPencil a safe visual experimentation and communication workspace for any registered PlotPickle surface without ever allowing an OpenPencil save to overwrite the running product or silently become implementation intent.

The Human workflow must support:

`open current PlotPickle surface → experiment in OpenPencil → save → discuss/review → refine intent → explicitly approve or keep exploring`.

The final developer brief, not the raw FIG delta, remains the authoritative implementation intent.

## Human contract

The Human has clarified the intended design loop:

- PlotPickle live UI is always the current product authority.
- OpenPencil is a visual design experiment.
- The Human may make only a few rough/fundamental changes in OpenPencil to communicate direction.
- The resulting implementation may become more refined through discussion with ChatGPT/DSDD.
- Saving a design means “preserve my experiment,” not “implement this.”
- No current running PlotPickle screen is overwritten by OpenPencil.
- The Human explicitly decides when a reviewed design direction should proceed.

A compact authority statement is:

> Current PlotPickle = product truth.

> OpenPencil working design = visual proposal / communication artifact.

> Approved developer brief = implementation intent.

## Existing architecture

PlotPickle already has a mature OpenPencil bridge.

### Command contract

Settings → Command recognizes:

- `OpenPencil open <surface name>`
- `OpenPencil review <surface name>`
- `OpenPencil publish <surface name>`
- `OpenPencil status`
- `OpenPencil connect <workspace>`
- `OpenPencil disconnect`

### Surface registry

`designs/openpencil/surfaces.json` currently registers 26 named surfaces:

Learn, Library, Community, Screening, Reports, Mind Map, World Map, Write, Edit, Refine, Outline, Storyboard, Previs, Timeline, Rough Cut, Deck, Package, Feedback, Identity, Wyrmwood, Unwritten, Foley, Narration, Music, Settings and Command.

Each surface currently has:

- an editable FIG target;
- a page name;
- a PEN bootstrap seed.

### Live capture proof

#2793 makes Timeline the first real live product capture:

- authenticated Human browser reveals Timeline;
- governed root/ready selectors are used;
- rendered DOM/CSS/geometry are serialized;
- the bounded snapshot is imported through the reviewed OpenPencil CLI;
- the result is editable in OpenPencil;
- WebMCP remains synthetic/isolated.

Timeline currently uses `rendered-live-v1`.

Other surfaces still rely on bootstrap behavior.

### Current publish behavior

#2800 added automatic design-review publication after an intentional OpenPencil edit:

- pre-open FIG hash is recorded;
- on PlotPickle refocus, closed OpenPencil document is detected;
- changed FIG can be published to an isolated design-review branch;
- a GitHub issue is created.

That behavior must be revised for #2825 because:

> close/save is not approval.

## Artifact model

Do not call the editable design “original.”

The true original/current authority is the live PlotPickle product.

For each surface, model three distinct artifact roles.

### Current reference

Example:

`settings-current.fig`

Purpose:

- generated from the current live PlotPickle Settings surface;
- represents the exact currently running product for comparison;
- can be regenerated;
- must never contain Human experiments;
- must never be used as the editable working file.

The current reference is disposable because PlotPickle can reproduce it.

### Working experiment

Example:

`settings-working.fig`

Purpose:

- Human-editable OpenPencil file;
- initially copied/materialized from the current reference;
- persists across OpenPencil sessions;
- may contain rough, partial, experimental or contradictory design ideas;
- may be saved repeatedly;
- must never modify the current PlotPickle product;
- must never be automatically overwritten when the live product changes.

### Approved evidence

Example:

`settings-approved.fig`

Purpose:

- created only after explicit Human approval;
- frozen evidence of the reviewed design direction;
- records exact current-reference and working-design hashes;
- can be published with the developer brief;
- remains design evidence, not executable product source.

The exact filenames may be registry-driven rather than literal, but these three authority states must remain explicit.

## Surface design session state

Each explicit OpenPencil design session should persist enough state to answer:

- surface;
- current reference path/hash;
- working design path/hash;
- working base/reference hash;
- whether working design differs from current reference;
- whether live product changed since the experiment began;
- approved artifact path/hash if approved;
- session timestamps;
- OpenPencil document/open state;
- review state;
- publication state.

Suggested conceptual states:

- `current-only`
- `working-clean`
- `working-changed`
- `baseline-drifted`
- `review-ready`
- `approved`
- `published`

Do not allow implicit transitions to `approved`.

## Open command

Target experience:

```text
OpenPencil open Settings
```

The command should:

1. resolve Settings through the repository registry;
2. reveal the live Settings surface in the authenticated Human browser;
3. wait for its governed ready selector;
4. capture the live rendered surface;
5. create/update the regenerable current reference;
6. inspect whether a working experiment already exists;
7. if no working experiment exists, create it from current reference;
8. if a working experiment exists, preserve it;
9. launch OpenPencil on the working experiment, not the current reference.

### Existing working experiment

If a working design exists:

- do not replace it;
- compare its base reference hash to the new current reference hash;
- if they differ, report baseline drift;
- still allow the Human to continue the old experiment;
- offer deliberate choices later for reset/rebase/new experiment.

## Save/close contract

Saving in OpenPencil means only:

> Preserve this design experiment.

Closing the document means only:

> The current editing session ended.

Neither event is implementation approval.

After PlotPickle detects that a working design changed, present a review state with explicit actions.

## Post-edit actions

### Keep Exploring

- preserve working design;
- no GitHub implementation issue;
- no source changes;
- no design approval;
- next `OpenPencil open <surface>` resumes this design.

### Review Changes

- generate current-vs-working design evidence;
- show/summarize proven design changes;
- place the result into the Human/DSDD discussion path;
- allow conversation and refinement;
- no source implementation;
- no automatic approval.

### Use This Design

This is the explicit approval boundary.

It should:

1. require direct Human action;
2. freeze approved design evidence;
3. capture exact current-reference hash;
4. capture exact working-design hash;
5. capture current `origin/main` base SHA;
6. generate/attach semantic design evidence;
7. create or prepare the developer brief;
8. publish the developer brief/GitHub issue only after the existing Human review/DSDD authority chain permits it;
9. never create implementation source changes in this action;
10. never merge code.

### Reset Working Design to Current PlotPickle

- requires explicit confirmation;
- destroys/replaces the working experiment only;
- refreshes working design from current reference;
- does not modify PlotPickle.

## Review discussion model

The Review step must not treat OpenPencil geometry as literal implementation requirements.

The Human may move only a few objects to communicate direction.

Example intent:

- “this should be more compact”;
- “this belongs over here”;
- “this needs more prominence”;
- “simplify this section”;
- “the visual hierarchy feels wrong.”

The review process should use the OpenPencil changes as evidence, then allow the Human and ChatGPT/DSDD to refine:

- layout hierarchy;
- spacing;
- typography;
- repeated component behavior;
- design-system consistency;
- accessibility implications;
- related surfaces that should stay visually aligned;
- responsive behavior;
- current product constraints;
- anything not explicitly modeled in the rough design.

The final approved developer brief should describe the intended product behavior, not blindly replay every node coordinate.

## Semantic design evidence

Current #2800 publication can detect binary FIG changes. #2825 should add a bounded semantic review package where supported by OpenPencil CLI/MCP.

Potential evidence:

- nodes added/removed;
- node hierarchy changes;
- geometry/position/size changes;
- frame/layout changes;
- gaps/padding/spacing;
- typography changes;
- colors/fills/strokes;
- buttons/controls introduced/removed;
- text content changes;
- image placement;
- repeated component clusters;
- alignment;
- page/node identifiers;
- contrast/target-size findings where supported;
- current-reference screenshot;
- working-design screenshot;
- exact artifact hashes.

No inferred intent should be reported as fact.

Use categories such as:

- proven change;
- likely intent for discussion;
- unknown / requires Human confirmation.

## Universal live capture

Generalize #2793 rather than adding bespoke capture logic for every surface.

The surface registry should be able to declare a capture descriptor such as:

- capture mode;
- browser root selector;
- ready selector;
- node limit;
- HTML/CSS limit;
- optional initialization action/state;
- current-reference artifact;
- working artifact.

The generic browser capture should remain bounded and privacy-preserving.

### Initial proof surfaces

Before broad rollout, prove:

1. Settings — good generic/product-settings case.
2. Storyboard or Outline — complex filmmaking UI.
3. Timeline — preserve existing #2793 behavior.

Then expand to other eligible registry surfaces.

## Browser/privacy boundary

Preserve #2793 rules:

- the authenticated Human browser is the only source for private current-story rendered UI;
- WebMCP remains an isolated synthetic verification observer;
- no Human cookies/profile data are passed to WebMCP;
- capture excludes runtime/script tags;
- capture remains selector/node/size bounded;
- OpenPencil remains optional and non-blocking.

## Current reference refresh rules

The current reference may be regenerated whenever the Human asks to open the surface.

If product source changed since last experiment:

- generate a new current reference;
- preserve the old working experiment;
- compare the stored working base hash with current hash;
- mark `baseline-drifted`;
- never silently “update” the Human working design.

Offer options such as:

- Continue Existing Experiment;
- Review Against New Current;
- Reset Working Design;
- Start New Experiment.

A future rebase/merge UX may be added, but no automatic design-tree merge is required for initial acceptance.

## #2800 behavior change

The existing automatic close → design branch → GitHub issue behavior is superseded.

New rule:

> Automatic change detection is allowed. Automatic approval/publication is not.

On close/refocus:

- detect working-design change;
- preserve local design session;
- report changed/unchanged state;
- show review actions;
- do not automatically create a GitHub design issue.

Explicit `OpenPencil publish <surface>` may remain as a retry mechanism only for a design already explicitly approved for publication, not as a shortcut around approval.

## Git/GitHub workflow

### Experimental save

No Git action is required.

### Review

May create local evidence and DSDD draft material.

No implementation branch/PR.

### Explicit approval

Approved evidence may be published to an isolated design-review branch.

The developer-brief issue should include:

- surface;
- current-reference hash;
- working/approved hash;
- base SHA;
- semantic diff summary;
- design artifact path;
- Human approval marker;
- discussion/refinement summary.

### Implementation

Begins as a separate normal PlotPickle issue/PR cycle.

`build → test → fix → PR → exact-head verification → merge when green`.

## External visual references

Keep screenshot/vision reconstruction available for UI that does not already exist in PlotPickle.

For PlotPickle-owned surfaces, prefer live DOM/CSS/geometry capture because:

- structure is available;
- exact text is available;
- computed styles are available;
- dimensions are available;
- image references are available;
- screenshot-only reconstruction would discard information.

## Required implementation phases

### Phase 1 — Design artifact authority/state

- extend surface/session contract;
- introduce current/working/approved artifact separation;
- persist hashes and base relationship;
- update GUI launch to open working artifact;
- disable implicit #2800 publication.

### Phase 2 — Generic rendered surface capture

- generalize Timeline snapshot contract;
- move selectors/limits into registry/config;
- make capture surface-neutral;
- add Settings proof;
- retain Timeline compatibility.

### Phase 3 — Post-edit design state UI

Add:

- Keep Exploring;
- Review Changes;
- Use This Design;
- Reset Working Design to Current PlotPickle.

Show baseline drift when applicable.

### Phase 4 — Semantic diff/evidence

- inspect current vs working through reviewed OpenPencil CLI/MCP capabilities;
- generate deterministic bounded evidence;
- include visual snapshots where useful;
- explicitly separate proven change from inferred intent.

### Phase 5 — DSDD discussion handoff

- feed review evidence into PlotPickle conversation/DSDD;
- support Human refinement;
- create final developer brief only after approval;
- freeze approved evidence.

### Phase 6 — GitHub publication

- publish only explicitly approved design evidence;
- preserve existing isolated design-review branch policy;
- keep publication idempotent;
- no implementation PR from the design workflow.

### Phase 7 — Surface rollout

- Settings;
- Storyboard/Outline;
- Timeline;
- remaining eligible registry surfaces.

## Behavioral acceptance

### Experiment

1. Human opens current Settings via OpenPencil.
2. Current reference is generated.
3. Working copy opens.
4. Human makes changes and saves.
5. PlotPickle Settings remains unchanged.
6. Human closes OpenPencil.
7. PlotPickle reports a changed experiment.
8. No GitHub issue is created automatically.

### Continue experiment

1. Human chooses Keep Exploring.
2. Working FIG persists.
3. Later OpenPencil open Settings resumes that file.
4. Current reference remains separate.

### Review

1. Human chooses Review Changes.
2. PlotPickle produces structured design evidence.
3. Human discusses changes with ChatGPT/DSDD.
4. Additional/refined requirements may be added.
5. No implementation occurs.

### Approve

1. Human chooses Use This Design.
2. Approved evidence is frozen.
3. Exact hashes/base SHA are recorded.
4. Developer brief reflects both design evidence and discussion.
5. GitHub issue is published.
6. Implementation is a separate workflow.

### Reset

1. Human chooses Reset.
2. Confirmation is required.
3. Working design is replaced from current reference.
4. Product is untouched.

### Baseline drift

1. Working experiment exists.
2. PlotPickle source changes.
3. New live reference hash differs.
4. Working experiment is preserved.
5. UI reports baseline drift.
6. No automatic overwrite/rebase occurs.

## Regression requirements

Tests must prove:

- live reference and working design use separate paths;
- GUI never opens current reference as the Human-editable artifact;
- save/close cannot overwrite current reference;
- existing working design is preserved;
- #2800 automatic publication no longer fires merely because a FIG changed;
- Keep Exploring performs no Git publication;
- Review Changes performs no product mutation;
- Use This Design requires an explicit approved state;
- Reset requires confirmation;
- approved evidence is content/hash bound;
- product baseline drift is detected;
- Settings live capture works;
- Timeline live capture still works;
- generic capture validates registered selectors/limits;
- unknown surface remains fail-closed;
- Human browser privacy boundary remains intact;
- WebMCP remains synthetic;
- OpenPencil absence/failure never blocks normal PlotPickle startup;
- no OpenPencil action directly modifies or merges PlotPickle implementation source.

## Likely files

Primary areas:

- `designs/openpencil/surfaces.json`
- `config/openpencil-design-snapshot.json` or successor registry contract
- `app/skin-v1/openpencil-design-snapshot.ts`
- `app/skin-v1/dashboard-bbs-review-host.tsx`
- `app/_components/settings/openpencil-command.ts`
- `app/_components/settings/openpencil-command-panel.tsx`
- `build/openpencil/openpencil-gui-runtime.mjs`
- `build/openpencil/openpencil-gui-gateway.ts`
- `build/openpencil/openpencil-design-review-publisher.mjs`
- OpenPencil design session persistence/evidence modules
- #2793 and #2800 tests
- new #2825 behavioral coverage.

## Non-goals

- no FIG-to-React direct source authority;
- no direct OpenPencil source mutation;
- no approval on save;
- no automatic implementation issue for every experiment;
- no automatic merge;
- no overwrite of a Human experiment when product changes;
- no screenshot reconstruction requirement for PlotPickle-owned surfaces;
- no OpenPencil startup dependency;
- no weakening of DSDD/WebMCP/GitHub/exact-head gates.

## Completion criteria

#2825 is complete only when a Human can safely:

`OpenPencil open Settings → visually experiment → save → close → Keep Exploring or Review → discuss/refine → explicitly Use This Design`

while:

- current PlotPickle remains untouched until implementation;
- current reference remains regenerable;
- working experiment remains persistent and protected;
- approval is explicit;
- discussion can refine beyond literal OpenPencil changes;
- approved evidence is deterministic;
- implementation remains a separate governed development cycle.

## Delivery sequence

Developer brief → phased implementation → focused behavioral tests → build → test → fix → PR → exact-head verification → merge when green.

Related: #2778, #2780, #2782, #2787, #2791, #2793, #2800.
