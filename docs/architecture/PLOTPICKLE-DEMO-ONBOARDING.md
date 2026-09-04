# PlotPickle DEMO onboarding boundary

Issue #1692 adds a first-run DEMO experience without changing the existing Human profile or Guest authority model.

## Purpose

DEMO is a disposable, synthetic PlotPickle runtime that lets a new Human experience a small prepared STORY scenario before creating or unlocking a private local profile. It reuses production STORY projections and UI concepts but owns no private Human state, durable canon, provider authority, connector authority or host credentials.

DEMO is not Guest. Guest remains the existing isolated ephemeral-notes surface and does not mount the private PlotPickle application. DEMO is a separate bounded product surface backed only by synthetic demo-owned data.

## Authority contract

The executable contract lives in `modules/demo-onboarding/demo-boundary.mjs`.

A DEMO runtime has authority class `synthetic-demo-runtime`, storage scope `demo-owned-disposable`, no authenticated Human and no Human profile id. Its allowed capabilities are deliberately narrow: read/propose/resolve/reset against synthetic STORY state and read-only Sage explanation projection.

The contract explicitly denies Human profile/project access, Human Wyrmwood state, BUZZ private identity/context, provider credentials, GitHub/Google connectors, host filesystem access, PPF direct canon writes and any ability to install skills or grant agent authority.

A feature that requires one of those capabilities does not belong inside DEMO.

## Data ownership and storage

All DEMO state is synthetic, disposable and owned by the DEMO sandbox. The runtime may hold only the prepared scenario, its deterministic session state, demo-local projections, bounded explanation state and reset metadata.

DEMO storage must never share a namespace, encryption key, active-project selector, browser authorization state or server-side private profile store with Human profiles. It also must not reuse Guest notes storage as a shortcut.

Reset means delete the current demo-owned mutable state and recreate it from the known prepared seed/snapshot. Reset does not touch Human-private data and does not touch Guest state. Exit may delete the entire DEMO sandbox.

## STORY and PPF relationship

DEMO does not contain a second STORY engine. It must call the same deterministic STORY rules/session contracts used by production through a synthetic-data adapter.

DEMO may explain PPF/canon authority and may show synthetic examples of proposed durable outcomes, but it cannot read private canon or perform a PPF canon admission. Any apparent canon shown in DEMO is scenario-owned synthetic data.

## Sage Show Me boundary

Sage may produce read-only explanatory projections such as before/after state, decision-to-consequence flow, knowledge partitions, relationship maps or authority diagrams. This mode receives only the current demo-legal projection and gains no additional tools or write authority.

## Make This Mine handoff

DEMO cannot become a Human session in place. `Make This Mine` must cross the existing profile boundary explicitly:

1. leave or freeze the disposable DEMO runtime;
2. create or unlock a real local Human profile using the existing profile flow;
3. create a fresh Human project;
4. copy only explicitly approved portable starter content;
5. discard DEMO runtime authority and synthetic identity artifacts.

The handoff contract rejects privileged fields such as AuthContext/session material, CSRF tokens, profile ids, credentials, connector scopes, BUZZ identity, PPF/canon authority, agent authority, installed skills and host filesystem paths. A handoff requires explicit Human approval.

## First-run behavior

On a fresh desktop installation, the eventual UI may offer two primary choices: `DEMO — See PlotPickle work` and `ENTER PLOTPICKLE — Create your local profile`. Returning users may continue to see the existing safe profile chooser first while DEMO remains available as a secondary action.

Server-network mode keeps its existing fail-closed authentication/bootstrap behavior. DEMO must not accidentally become an anonymous remote application surface unless a later issue explicitly designs and secures that mode.

## Invariants

1. DEMO is separate from Guest and separate from authenticated Human runtime.
2. DEMO owns only synthetic disposable data.
3. DEMO never gains private profile, credential, connector, filesystem or PPF write authority.
4. DEMO uses production STORY contracts rather than a duplicate engine.
5. Sage explanation is projection-only.
6. Reset is deterministic and deletes only demo-owned mutable state.
7. Exit can leave no retained private state.
8. Make This Mine requires explicit Human approval and a fresh Human profile/project boundary.
9. Portable starter content is data, never authority.
10. Returning-user profile behavior and existing Guest behavior remain unchanged unless a later implementation phase deliberately changes presentation only.

## Phase 0 exit

Phase 0 is complete when the architecture contract is documented, executable boundary constants/guards exist, tests prove denied capabilities and privileged handoff fields fail closed, and existing profile/Guest tests remain unchanged.
