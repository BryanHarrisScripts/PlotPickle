# #2189 — Pre-UAT Convergence, Self-Service UAT and Visible UAT Guide

## Status

Pre-UAT umbrella brief.

This brief records the final convergence requirements before broad Human testing begins.

## Background

The recent Writer-to-Screen rebuild is internally healthy. The rebuilt chain now includes:

- Story Cards;
- Block-native Write;
- Afterglow 24/96 evidence;
- Storyboard convergence;
- Previs convergence;
- Scene Workspace synchronization;
- bounded revision propagation;
- provider-neutral Production convergence;
- deterministic Afterglow Story-to-Screen acceptance.

The remaining risk is at the boundary between the rebuilt system and older PlotPickle surfaces.

A Human should not be able to start in the current profile-owned PPF workflow, follow a reasonable link, and unknowingly fall back into a legacy project store or visibly inconsistent interface.

## Confirmed legacy seams

### Outline / Structure

The current pre-production navigation routes Outline to `/structure`.

That route still reads and writes:

```text
plotpickle.project.v1
```

and uses the older `PlotPickleProject` model.

The route may also display a blank legacy project when old storage is absent.

It must not remain a silent handoff from the canonical PPF workflow.

### Reports / Production

The global Reports destination points to `/production`.

That route still:

- reads and writes `plotpickle.project.v1`;
- uses the older Production/Preproduction workspace model;
- uses older PlotPickle visual tokens rather than the current Skin V1 surface grammar.

The current #2173 provider-neutral Production convergence must not be confused with this older page during UAT.

### PageFlow

#2180 remains required.

PageFlow is visually close to current Skin V1 but still consumes legacy `plotpickle.project.v1` and `scriptExcerpt` state.

It must become a read-only diagnostic over the current Write-owned screenplay at the canonical Block / Mini-Block address.

### Other contextual legacy tools

The audit also found legacy project ownership in contextual tools including:

- CraftLoop;
- DraftLens;
- Resonance;
- Diagnostics / Refine;
- Pitch Review / Feedback.

These tools do not invalidate the current Writer-to-Screen rebuild, but they must not masquerade as canonical current-state destinations during the acceptance path.

## Canonical UAT path

The acceptance path should be safe to explore in order:

```text
Login
→ Dashboard / Story Cards
→ Write
→ Outline
→ Storyboard
→ Visual Story
→ Previs
→ Scene Workspace
→ Production inspection
→ PageFlow / Refine when migrated
→ return to the same story address
```

Every supported transition preserves:

- authenticated Human profile boundary;
- active project identity;
- PPF authority;
- Block / Mini-Block address when applicable;
- Skin V1 surface grammar;
- candidate / accepted / missing truth;
- explicit return navigation.

## Canonical routing fence

Before broad Human UAT, every outbound link from the rebuilt surfaces must be classified.

Allowed categories:

1. current canonical PPF destination;
2. current contextual tool;
3. explicitly fenced legacy destination;
4. public/startup exception.

A canonical UAT route must never silently read or write `plotpickle.project.v1`.

If a destination is still legacy, the implementation should either:

- route to an existing current replacement; or
- clearly fence it out of the canonical UAT path until migration is complete.

Do not create a second story router, PPF store or canon model.

## #2180 PageFlow migration

#2180 remains a direct dependency of #2189.

PageFlow must:

- read current profile-owned project state;
- use the exact current Write-owned screenplay text;
- preserve Block / Mini-Block address;
- distinguish immutable imported source evidence from working screenplay state;
- preserve the existing deterministic diagnostic passes;
- remain read-only;
- never auto-rewrite or auto-approve;
- preserve current Skin V1 presentation;
- preserve contextual LEARN and return navigation.

## Self-service Start UAT

### Human experience

After authentication, an eligible Human may opt into UAT tools and see a deliberate entry such as:

```text
START UAT
```

or:

```text
START UAT GUIDE
```

The control begins a bounded local acceptance run.

On Windows, the run may open a dedicated command/status window so the Human can visibly see that the test system is active.

### Authentication and authorization

The control belongs to the authenticated Human experience.

Visibility must not be based on:

- display name;
- hard-coded personal identity;
- Windows username;
- GitHub identity;
- BUZZ identity.

The preferred boundary is:

- authenticated PlotPickle Human session;
- explicit profile-owned UAT opt-in;
- local desktop-loopback execution;
- server-owned authorization for any mutation that starts a run.

The exact profile preference mechanism should reuse existing profile-private settings if available. Do not invent a parallel login or role system solely for UAT.

### Isolation

Starting UAT from a Human account does **not** authorize an autonomous browser to inherit that Human's private session.

The autonomous scan should continue to use:

- the existing synthetic verification Human;
- isolated browser/session state;
- no PMK access;
- no Human cookies;
- no provider credentials;
- no private BUZZ signer;
- no private project data by default.

The default acceptance fixture may use deterministic reference material such as Afterglow.

Testing a private Human project requires an explicit separately reviewed consent path and is not implied by this button.

## UAT Guide

The UAT Guide is a Human-facing narrator, not a new creative or verification authority.

It projects already-authoritative operational events into plain language.

Reusable sources already exist:

- Agent Activity;
- Responsibility Runs;
- run telemetry;
- UI Continuity Agent;
- WebMCP Testing;
- Full Verification;
- Verification Inbox;
- agent command-window status functions.

### Example narration

```text
UAT Guide started. I’m checking the current PlotPickle workflow.

UI Continuity Agent is checking Storyboard.

Storyboard kept Block 17.1 and the current project.

Moving to Previs.

Previs loaded the current PPF project successfully.

This destination still belongs to the legacy project model. I stopped before entering it.

Scene Workspace found Dialogue, Action and Shot evidence. Audio has no authored evidence yet.

Production reached the provider-neutral compiler. No provider was called and no credits were spent.

Scan complete: 11 surfaces checked; 10 passed; 1 needs attention.
```

### Required Human-facing fields

The live guide should be able to expose:

- current run;
- current agent/check;
- current surface;
- current Block / Mini-Block when applicable;
- current bounded action;
- PASS / FAIL / BLOCKED / waiting-for-Human;
- safe reason;
- next expected action;
- final summary;
- Verification Inbox/evidence reference.

### Command/status window

Windows may mirror the same sanitized event stream into a visible command window.

The command window is a presentation surface only.

It must not become:

- the source of PASS/FAIL;
- the agent orchestration authority;
- a shell prompt with unrestricted developer authority;
- a place where credentials or story secrets are printed.

## Privacy and reasoning boundary

The UAT Guide may expose observable operational facts.

It must never expose hidden chain-of-thought.

Do not print or persist:

- private model reasoning;
- raw prompts/responses where the existing observability contract excludes them;
- passwords;
- PMKs;
- session cookies;
- provider keys;
- OAuth credentials;
- private BUZZ signer material;
- sensitive filesystem paths.

Allowed examples include:

- agent/check identity;
- sanitized route/surface;
- provider/runtime label already considered public-safe;
- duration;
- deterministic stage result;
- bounded error reason;
- remediation hint;
- evidence reference.

## WebMCP / UI Continuity expansion

The existing WebMCP startup mode is the base implementation.

Do not create another competing UAT framework.

Extend the current standard-surface coverage to include at least:

- authenticated entry;
- Dashboard;
- Story Cards;
- Write;
- current Outline projection;
- Storyboard;
- Visual Story;
- Previs;
- Scene Workspace;
- provider-neutral Production inspection;
- PageFlow after #2180;
- return navigation.

For each transition verify:

- intended current route;
- no legacy project store on the canonical path;
- Skin V1 header/shell/palette/geometry;
- project continuity;
- Block / Mini-Block continuity;
- expected control/content presence;
- truthful empty/loading/error/partial states;
- console/runtime errors;
- screenshot/evidence capture;
- exact failing surface and transition.

Dashboard remains the visual reference.

Visual baselines remain Human-approved; the scanner cannot bless its own regressions.

## Recommended implementation order

1. Routing and legacy-boundary audit/fence.
2. #2180 PageFlow PPF migration.
3. Complete WebMCP/UI Continuity coverage for the rebuilt chain.
4. Profile-owned Start UAT entry after authentication.
5. UAT Guide plain-language projection over existing activity evidence.
6. Optional Windows command-window mirror.
7. Full autonomous scan against current main.
8. Stop pre-UAT feature development and begin structured Human UAT.

## Acceptance criteria

#2189 is complete when:

- no canonical Writer-to-Screen transition silently enters `plotpickle.project.v1`;
- supported transitions preserve active project and Block/Mini address;
- canonical surfaces obey Skin V1;
- #2180 is complete;
- the complete rebuilt chain is included in autonomous WebMCP/UI Continuity testing;
- an authenticated opted-in Human can deliberately start UAT;
- the scanner remains isolated from private Human credentials/state;
- the UAT Guide narrates sanitized operational facts in layman's terms;
- the same event stream can be mirrored to a Windows status window;
- deterministic verification owns PASS/FAIL;
- results link to Verification Inbox/evidence;
- default acceptance uses no paid provider calls;
- no candidate is promoted to canon;
- no second router, store, verification authority or agent authority is created.

## Stop condition

Once the complete canonical chain passes the autonomous acceptance run, hand the build to the Human for broad structured UAT and stop adding pre-UAT features.
