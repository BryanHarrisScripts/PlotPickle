# PlotPickle Headless Experience Boundary

Issue: #1754

## Canonical terminology

- **Legacy Skin** — the current PlotPickle UI. It remains available for compatibility while capabilities are migrated, but it is not part of the new skin version sequence.
- **Skin V1** — the new primary interchangeable skin. It begins intentionally as a black-and-white 16-bit interface so architecture can be proven before visual complexity returns.
- **Skin V2** — reserved for a future alternative presentation such as mobile/minimal if needed.

The new skin version sequence begins at Skin V1.

## Architecture

```text
INTERCHANGEABLE SKIN
        | Semantic Intents
        v
BUSINESS USE CASE / EXPANDED EXPERIENCE LAYER
        | Governed actions / commands
        v
PLOTPICKLE HARNESS / BRAIN
        |
        v
AGENTS + STORY + CANON + PROVIDERS + STORAGE + COLLABORATION

HARNESS / CORE
        | Authoritative state / domain events
        v
EXPANDED EXPERIENCE LAYER
        | State / capabilities / events / normalized view models
        v
INTERCHANGEABLE SKIN
```

A Skin never becomes a second authority for story rules, authentication, persistence, capability decisions, revisions, provider execution, or collaboration policy.

## Golden rules

1. No PlotPickle business rule may depend on a particular Skin.
2. A Skin may request an action; only the Experience/Harness path decides its consequences.
3. Every PlotPickle capability must remain usable without a visual implementation.
4. No supported business mutation travels directly from a Skin to a Harness/Core owner.
5. Sensitive credentials are ephemeral use-case inputs and are never projected into general Experience state or events.

## Expanded Experience Layer responsibilities

The Experience Layer is the headless application layer. It owns:

- semantic business surfaces;
- semantic intent contracts;
- use-case validation and interception;
- capability projections and denial reasons;
- revision/reconciliation mediation;
- normalized view models;
- event projection;
- local-first/persistence mediation;
- surface topology.

The Skin owns only presentation and temporary visual interaction state.

## Surface registry

The initial registry is deliberately small:

```text
unauthenticated -> LOGON
authenticated   -> DASHBOARD
```

Known later surfaces remain inactive until their business cases are migrated:

- COMMUNITY
- STORY_WORKSPACE
- STORYBOARD
- SETTINGS

A Skin renders this topology; it does not independently decide which product capabilities exist.

## Phase 0 — LOGON to Dashboard

Skin V1 lives at `/skin-v1`.

The first vertical proof is intentionally minimal:

```text
Skin V1
  -> AuthenticateHuman / CreateFirstHumanProfile / CompleteFirstHumanProfileSetup
  -> Experience LOGON use case
  -> existing PlotPickle profile authority
  -> Experience LOGON/DASHBOARD projection
  -> 16-bit Dashboard menu
```

Skin V1 does not call `/api/auth/profile` directly. The browser adapter is the only browser-facing authentication seam and reuses the existing profile service, profile-private hydration, and legacy-project migration.

A fresh Node can remain entirely inside Skin V1 for:

- first Human profile creation;
- server bootstrap proof when required;
- recovery-secret acknowledgement;
- existing profile unlock;
- transition to DASHBOARD.

The Dashboard currently proves presentation and keyboard interaction only. Its rows are intentionally not connected to routes, `OpenSurface` intents, or Harness actions yet.

Canonical Skin V1 Dashboard rows, in order:

1. Dashboard
2. Community
3. Library
4. Plan
5. Storyboard
6. Previs
7. Write
8. Edit
9. Feedback
10. Refine
11. Reports
12. Settings
13. Profile
14. Learn - Education
15. Wyrmwood - Learning Game
16. Story - The Unwritten

Mouse click and Up/Down keyboard navigation may change the selected row. Selection remains temporary Skin state until each business case is migrated into the Experience Layer.

## Story Workspace boundary

The first story capability is Block/Mini-Block selection.

Existing deterministic 24/96 projection logic is reused rather than rewritten. A temporary browser adapter translates current project and Story Map persistence owners into the skin-neutral `StoryWorkspaceGateway` port.

```text
Skin / future adapter
  -> SelectBlock / SelectMiniBlock
  -> Story Workspace Experience use case
  -> StoryWorkspaceGateway
  -> existing 24/96 projection + profile-private remembered context
  -> lean StoryWorkspaceViewModel
```

The Experience use case owns:

- selected Block/Mini-Block projection;
- bounded selection;
- authoring capability projection;
- revision correlation;
- safe rebase of stale non-canonical selection intents;
- persistence request through the gateway.

It does **not** own:

- React state;
- URL/query-string synchronization;
- direct browser storage;
- direct provider/API calls;
- canon mutation.

A locked Block can still be selected for orientation. Authoring capability is denied beneath the Skin with reason `STORY_POSITION_LOCKED`.

## Reconciliation rule

Story selection is profile context, not canonical story mutation. If a `SelectBlock` or `SelectMiniBlock` intent was created against an older project revision, the Experience layer may deterministically rebase that selection onto the current revision and return:

```text
outcome: rebased
reason: SELECTION_REBASED_TO_CURRENT_REVISION
```

Canonical story mutations will use stricter revision/proposal authority and must never silently last-write-win.

## Existing mechanisms to reuse

ARCH-01 must reuse before inventing:

- canonical project revision/proposal/rebase history;
- lifecycle authority/capability decisions;
- profile-private project and Story Map persistence;
- existing deterministic 24/96 projection;
- provider/runtime routing;
- signed provenance and Human approval boundaries.

CRDT, Operational Transform, WebSocket, SQLite, or a second persistence system are not architectural requirements unless existing mechanisms cannot satisfy a demonstrated use case.

## Migration policy

The Legacy Skin is evidence of available capabilities, not a specification for future interaction flow.

Migrate one business capability at a time:

1. identify the authoritative current owner;
2. define a skin-neutral port and semantic intent;
3. move validation/mediation into the Experience use case;
4. project a lean view model;
5. connect Skin V1;
6. verify headlessly;
7. retire duplicate Legacy Skin business logic only after parity is proven.

## CI implication

Issue #1747 and PR #1753 remain parked while this boundary is established. The two-visible-gate direction remains useful, but verification should ultimately map to three responsibilities:

- Harness/Core contracts;
- Experience/use-case contracts;
- Skin/rendered product checks.

CI should validate those architectural layers rather than preserving the Legacy Skin's historical workflow topology.
