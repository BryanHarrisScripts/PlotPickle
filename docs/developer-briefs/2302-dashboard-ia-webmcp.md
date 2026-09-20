# #2302 — Freeze seven-group Dashboard IA and align WebMCP

## Status

Human-approved and frozen for implementation on 2026-09-20.

This brief records the Dashboard information architecture, WebMCP impact, and seven-layer CI boundary before product implementation begins.

## Frozen Dashboard map

```text
PLOTPICKLE DASHBOARD
│
├── EXPLORE
│   ├── Learn
│   ├── Community
│   └── Library
│
├── DEVELOP
│   ├── Discover
│   ├── Write
│   └── Edit
│
├── VISUALIZE
│   ├── Story
│   ├── Outline
│   ├── Storyboard
│   ├── Previs
│   ├── Timeline
│   └── Production
│
├── REVIEW
│   ├── Feedback
│   ├── Refine
│   └── Analytics
│
├── PITCH
│   ├── Package
│   └── Deck
│
├── PLAY
│   ├── Identity
│   ├── Wyrmwood
│   └── Written
│
└── SYSTEM
    ├── Settings
    ├── Service
    ├── Legal
    ├── Log Off
    └── Shut Down
```

The order above is authoritative for #2302.

## Exact renames

- Writer's Craft → Learn
- Discovery → Discover
- Story Bible → Story
- Wyrmwood Game → Wyrmwood
- The Unwritten → Written
- Manage → Settings
- Bug Report → Service
- Notices → Legal
- Shut Down Node → Shut Down
- Log Off remains Log Off

## Exact moves

### EXPLORE
- Learn
- Community
- Library

### DEVELOP
- Discover
- Write
- Edit

### VISUALIZE
- Story
- Outline
- Storyboard
- Previs
- Timeline
- Production

### REVIEW
- Feedback
- Refine
- Analytics

### PITCH
- Package
- Deck

### PLAY
- Identity
- Wyrmwood
- Written

### SYSTEM
- Settings
- Service
- Legal
- Log Off
- Shut Down

## Pitch scope

PITCH is new and begins with exactly two Dashboard destinations:

1. Package
2. Deck

Do not add Creative Director, Audience, Trailer, Poster, Tagline, Campaign or other marketing rows to the Dashboard in this issue.

Package should reuse the existing Pitch Review / pitch-package authority where practical. Deck should reuse the existing pitch-deck / Graphic Novel deck authority. Do not create parallel pitch models.

## Visualize continuity

The Human is intentionally preserving this grouped flow:

```text
Story → Outline → Storyboard → Previs → Timeline → Production
```

The existing governed five-stage continuity beneath it remains:

```text
Outline → Storyboard → Previs → Timeline → Production
```

Do not split, reorder, or flatten this sequence.

## Current Dashboard authority

The canonical menu authority is:

- `app/skin-v1/dashboard-menu-registry.ts`

The existing detailed regression that hard-codes the old six groups is:

- `tests/issue-2026-dashboard-main-menu-reset.test.mjs`

That historical test must be updated for the new frozen IA, but it is not sufficient by itself because it is currently catalogued as manual-only.

## WebMCP requirements

WebMCP must learn the same new Dashboard authority in the same change.

Do not create a second Dashboard registry for WebMCP.

Update the existing canonical/compatibility projections and tests so they derive from or agree with the same Dashboard source.

Verification must prove:

- exactly seven groups: EXPLORE, DEVELOP, VISUALIZE, REVIEW, PITCH, PLAY, SYSTEM;
- group order is preserved;
- every frozen item appears once in the correct group/order;
- keyboard shortcuts remain unique;
- keyboard-first Dashboard navigation remains intact;
- connected/unwired state remains truthful;
- startup choices remain derived from Dashboard authority and continue excluding Log Off and Shut Down;
- WebMCP Dashboard capture recognizes the new labels/groups;
- existing governed destinations continue to resolve;
- Package and Deck are truthfully represented as wired or unwired;
- no active WebMCP assertion still requires DEVELOPMENT / PRE-PRODUCTION / PRODUCTION / WORKSHOPS / CALL SHEET / WRAP;
- Dashboard remains the canonical Skin V1 visual reference;
- the 30 authenticated Standard surfaces remain unchanged unless a separately approved governance change is required.

## Seven-layer GitHub CI requirement

Architecture Verification remains the merge authority and must stay seven visible layers:

1. Layer 1 Experience Skins
2. Layer 2 Experience Contract
3. Layer 3 Production Orchestration
4. Layer 4 Agent & Skill Mesh
5. Layer 5 Story / Canon / Evidence
6. Layer 6 Provider Runtime
7. Layer 7 Validation & Operations

### Current routing already in place

- `app/skin-v1/**` is production-owned by **Layer 1 Experience Skins** with `skin/surface/navigation/visual/mcp` risk tokens.
- WebMCP verifier files are verification-owned but emit `surface/navigation/visual/mcp/test-harness` risk.
- the ordinary Layer 1 catalogue already contains:
  - `experience.skin-surface-contract`
  - `experience.navigation-continuity`
  - `experience.webmcp-live-observer`
- only Layer 1 is allowed the network required by the live WebMCP observer.
- all seven CI jobs remain visible even when only some layers select meaningful impacted tests.

### Required #2302 CI change

The canonical Layer 1 test:

- `tests/layer1-navigation-continuity.test.mjs`

currently hard-codes the old Dashboard order and the label `Story Bible`.

That test must be updated to the new seven-group authority so ordinary pull-request CI catches Dashboard IA drift.

Do not rely only on `tests/issue-2026-dashboard-main-menu-reset.test.mjs`, because that issue-specific regression is retained as manual/historical evidence after #2291.

If implementation changes the canonical surface registry, WebMCP compatibility registry, ownership map, or test catalogue, those changes must remain correctly owned and selected by Architecture Verification. Do not weaken selection merely to make CI green.

### CI acceptance

Before merge:

- exact PR head must run Architecture Verification;
- all seven layer jobs must be visible;
- Layer 1 must select and pass the canonical Dashboard/navigation contract;
- any changed WebMCP verification files must select the appropriate verification/observer coverage;
- no unmapped production file is allowed;
- BEN deterministic code-quality review remains part of Layer 7;
- inspect only failed CI layer logs;
- merge only when exact-head CI is green.

## Preserve

- current Skin V1 Dashboard visual design;
- existing shortcuts where possible;
- existing connected destination behavior;
- Story/Outline/Storyboard/Previs/Timeline/Production surfaces;
- existing pitch data authorities;
- Log Off semantics;
- graceful Shut Down behavior;
- WebMCP startup/profile ordering;
- current Standard WebMCP catalogue unless separately approved.

## Non-goals

#2302 does not:

- redesign Dashboard styling;
- implement the Creative Director skill;
- add marketing sub-tools to the Dashboard;
- redesign Package or Deck content;
- change story canon;
- change the five-stage visual continuity flow;
- invent new provider/agent/registry categories;
- replace WebMCP;
- change runtime shutdown behavior;
- make unwired destinations pretend to be wired;
- reduce the seven-layer Architecture Verification model.

## Acceptance checklist

- [ ] Frozen seven-group Dashboard IA is implemented exactly.
- [ ] All renames and moves are applied.
- [ ] PITCH contains only Package and Deck.
- [ ] VISUALIZE remains Story → Outline → Storyboard → Previs → Timeline → Production.
- [ ] Identity is under PLAY.
- [ ] Settings / Service / Legal / Log Off / Shut Down are under SYSTEM.
- [ ] Existing pitch authorities are reused.
- [ ] Historical Dashboard regression is updated.
- [ ] Canonical Layer 1 navigation test is updated.
- [ ] WebMCP projections/capture recognize the new Dashboard authority.
- [ ] No stale six-group active assertion remains.
- [ ] Focused tests pass.
- [ ] Exact-head Architecture Verification shows all seven layers and is green.
- [ ] Human reruns WebMCP after merge for rendered confirmation.
