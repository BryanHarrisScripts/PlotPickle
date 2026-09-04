# PlotPickle DEMO onboarding boundary

Issue #1692 adds a first-run DEMO experience without changing the existing Human profile or Guest authority model.

## Purpose

DEMO is a disposable, synthetic PlotPickle runtime that lets a new Human experience a small prepared STORY scenario before creating or unlocking a private local profile. It reuses production STORY projections and UI concepts but owns no private Human state, durable canon, provider authority, connector authority or host credentials.

DEMO is not Guest. Guest remains the existing isolated ephemeral-notes surface and does not mount the private PlotPickle application. DEMO is a separate bounded product surface backed only by synthetic demo-owned data.

## Authority contract

The canonical executable contract lives in `core/demo-onboarding/demo-boundary.mjs` because it is a public cross-feature authority contract. `modules/demo-onboarding/demo-boundary.mjs` is a compatibility bridge to that core-owned contract so existing Phase 0 callers do not break.

A DEMO runtime has authority class `synthetic-demo-runtime`, storage scope `demo-owned-disposable`, no authenticated Human and no Human profile id. Its allowed capabilities are deliberately narrow: read/propose/resolve/reset against synthetic STORY state and read-only Sage explanation projection.

The contract explicitly denies Human profile/project access, Human Wyrmwood state, BUZZ private identity/context, provider credentials, GitHub/Google connectors, host filesystem access, PPF direct canon writes and any ability to install skills or grant agent authority.

A feature that requires one of those capabilities does not belong inside DEMO.

## Data ownership and storage

All DEMO state is synthetic, disposable and owned by the DEMO sandbox. The runtime may hold only the prepared scenario, its deterministic session state, demo-local projections, bounded explanation state and reset metadata.

DEMO storage must never share a namespace, encryption key, active-project selector, browser authorization state or server-side private profile store with Human profiles. It also must not reuse Guest notes storage as a shortcut.

Reset means delete the current demo-owned mutable state and recreate it from the known prepared seed/snapshot. Reset does not touch Human-private data and does not touch Guest state. Exit may delete the entire DEMO sandbox.

## STORY and PPF relationship

DEMO does not contain a second STORY engine. It must call the same deterministic STORY rules/session contracts used by production through a synthetic-data adapter.

The prepared STORY adapter lives at `modules/story-the-unwritten/demo/world.mjs`. That placement is deliberate: feature modules do not import sibling private implementations, and the STORY module's already-wide root does not gain another top-level file. STORY owns the scenario adapter because it directly composes STORY's private action, resolution and session mechanics; the adapter consumes the public DEMO authority contract from `core/`.

DEMO may explain PPF/canon authority and may show synthetic examples of proposed durable outcomes, but it cannot read private canon or perform a PPF canon admission. Any apparent canon shown in DEMO is scenario-owned synthetic data.

## Deterministic demo world

Phase 1 bundles one scenario, `The Lantern at the Fork`. It is exactly five STORY scenes and exposes two prepared decisions per scene.

The adapter does not implement story mechanics. Each choice becomes a normal STORY action, production STORY rules derive the consequences, the production resolver commits the state change, and the production five-scene session machine advances the scene. Location, private knowledge, object custody, relationship strength, turn count and unresolved-thread changes therefore use the same authoritative mechanics as the real STORY runtime.

The bundled seed is `plotpickle-demo-lantern-v1`. Reset recreates the initial runtime and mechanical state from that known seed. Replay accepts the same ordered decision ids and produces the same authoritative runtime, state and decision history even when proposal timestamps differ. No model, network provider or external credential is required.

Every runtime, world, scene, game, Story Piece and PPF-facing reference in the scenario is synthetic and uses a `demo:` reference. The required STORY `ppfProjectRef` points only to `demo:ppf-projection:lantern-at-the-fork`; it is not a real project or canon admission path.

Character knowledge projection reads `knowledgeByCharacter` from the production STORY mechanical state. An audience receives public scenario knowledge only; a character receives public knowledge plus only that character's own private refs. The DEMO layer does not create a second knowledge graph.

## Sage Show Me boundary

Sage Show Me is a read-only explanatory projection, not a second Sage agent, knowledge graph or visualization authority. Phase 3 lives at `modules/story-the-unwritten/demo/show-me.mjs` because it translates the existing synthetic STORY world into small human-readable views while reusing the production STORY knowledge projection and the executable DEMO capability contract.

The DEMO exposes four bounded views:

1. `What changed?` compares the replayed world before and after the latest prepared decision and shows only state fields that actually moved.
2. `Who knows what?` uses the existing STORY knowledge projection to separate shared audience knowledge from Mara-only and Rowan-only knowledge.
3. `Story map` renders a temporary relationship view directly from current STORY character-location, object-custody and relationship state. It stores no graph of its own.
4. `What is allowed?` derives its allowed/read-only/blocked rows from the executable DEMO allowed/forbidden capability lists rather than maintaining a second policy description.

The browser never imports the Show Me authority or STORY mechanics. It asks the already-local `/api/demo/story` Node route for `action: show-me` with the current ordered demo decision ids and a supported view name. The route deterministically replays the synthetic world, reconstructs the immediately previous world where needed for before/after comparison, and returns only a human-facing explanation projection. Unsupported views fail closed.

`createStoryDemoShowMe` asserts the existing `sage.explain.read` capability before projecting anything. It performs no model call, provider request, retrieval, persistence, profile access, canon admission, connector access, skill installation or authority grant. As a result the shipped DEMO can explain its deterministic state fully offline with no AI credential, while the normal Sage conversation architecture remains unchanged.

## Make This Mine handoff

Phase 4 implements `Make This Mine` as an explicit authority crossing rather than converting the DEMO runtime into a Human session.

The action appears only after all five prepared STORY scenes are complete. Clicking it is the Human's explicit approval to carry a small amount of portable creative material forward. The browser then leaves the DEMO surface and mounts the existing local profile create/unlock flow unchanged. The pending handoff exists only in React memory; it is not placed in localStorage, sessionStorage, Guest storage or profile-private storage before authentication.

While the handoff is pending, the wrapper watches the existing read-only profile status. It does not create profiles or perform login itself. Once the existing profile boundary establishes a real authenticated Human session and CSRF proof, the wrapper sends one mutation to `/api/demo/handoff`.

The handoff route is Node-owned, same-origin and `desktop-loopback` only. It authorizes the request through the existing profile boundary with `{ mutation: true }`. Server-network requests fail with `DEMO_LOCAL_ONLY`.

The server reconstructs the completed synthetic STORY path from the known seed and the five submitted decision ids. `modules/story-the-unwritten/demo/handoff.mjs` converts that path into only two portable fields: a human-readable project title and a human-readable Foundations brief containing the five choice labels as creative prompts. The portable payload does not contain decision ids, synthetic Story Piece refs, hidden knowledge, DEMO authority, profile/session data, credentials, connector scopes, BUZZ identity, canon authority or agent authority.

The shared `createApprovedDemoHandoff` contract continues to reject privileged fields and now also rejects any raw starter-content string beginning with `demo:`. The authenticated route performs a second fail-closed check and refuses to save a project whose serialized normal project data still contains `demo:`.

The destination is created with the normal `createEmptyProject`/`normalizeFoundationProject` contracts and saved through the existing profile-private storage service as a fresh active Human project. No existing Human project is mutated. The browser-generated transaction UUID itself becomes the normal Human project UUID, so durable identity carries no DEMO prefix or synthetic provenance marker. A retry reuses that same UUID and reopens the same imported project instead of creating duplicates; if the UUID already contains different Human project data, the handoff fails closed rather than overwriting it.

After a successful save, PlotPickle reloads the Dashboard and the normal profile-private hydration path opens the newly active project. DEMO runtime authority and synthetic identity artifacts are discarded.

## First-run behavior

Phase 2 mounts a thin `DemoOnboardingBoundary` outside the existing `ProfileAccessBoundary`. The wrapper performs a read-only local profile-status probe and does not implement login, profile creation, Guest, persistence or authority decisions itself.

On a fresh desktop installation it presents two primary choices: `DEMO — See PlotPickle work` and `ENTER PLOTPICKLE — Create your local profile`. Choosing ENTER simply mounts the unchanged existing profile boundary. Choosing DEMO mounts only the synthetic demo experience; the normal PlotPickle workspace and overlay hosts remain unmounted until DEMO is exited or the Human chooses to enter PlotPickle.

The browser DEMO surface is projection-only and does not bundle STORY's Node-owned resolver. It calls the same-origin local `/api/demo/story` route, which runs in the Node runtime, is available only when PlotPickle is in `desktop-loopback` mode, reconstructs the synthetic world from the known seed plus the submitted ordered decision ids, and returns only the bounded fields needed by the DEMO UI. This is local application IPC over the existing loopback server, not an Internet or provider dependency. Server-network receives `DEMO_LOCAL_ONLY` and cannot use the route as anonymous remote application access.

Returning locked desktop users continue to receive the existing safe profile chooser first, with `Try DEMO` available as a secondary action. Authenticated Humans and active autonomous Guest runs are not interrupted by DEMO onboarding.

Server-network mode keeps its existing fail-closed authentication/bootstrap behavior. The onboarding wrapper never offers DEMO from `server-network`, so Phase 2 does not create anonymous remote application access.

The interactive Phase 2 surface exposes explicit reset and exit controls. Reset reconstructs the Phase 1 world from the known seed; exit returns to the appropriate fresh-entry or existing-profile surface. The UI does not request provider setup, BUZZ identity, GitHub, Google or Internet access.

## Invariants

1. DEMO is separate from Guest and separate from authenticated Human runtime.
2. DEMO owns only synthetic disposable data.
3. DEMO never gains private profile, credential, connector, filesystem or PPF write authority.
4. DEMO uses production STORY contracts rather than a duplicate engine.
5. Public cross-feature DEMO authority is core-owned; STORY-private mechanics remain STORY-owned.
6. Sage explanation is projection-only.
7. Reset is deterministic and deletes only demo-owned mutable state.
8. Exit can leave no retained private state.
9. Make This Mine requires explicit Human approval and a fresh Human profile/project boundary.
10. Portable starter content is data, never authority.
11. Returning-user profile behavior and existing Guest behavior remain unchanged unless a later implementation phase deliberately changes presentation only.
12. Browser DEMO code receives a bounded projection and never imports Node-only STORY mechanics directly.
13. Show Me derives knowledge, relationship and authority views from existing executable state/contracts and stores no parallel graph, policy or private explanation memory.
14. Show Me is usable without an LLM and cannot gain more authority by selecting a different visual view.
15. Raw synthetic `demo:` runtime references never become portable starter content or durable Human project state.
16. Make This Mine performs no profile creation/login itself; private persistence begins only after the existing Human auth boundary supplies an authenticated session and CSRF proof.
17. A Make This Mine retry is idempotent for one approval transaction and cannot overwrite different existing Human project data.
18. The durable Human project identifier is a normal UUID with no DEMO prefix or synthetic provenance marker.

## Phase 0 exit

Phase 0 is complete: the architecture contract is documented, executable boundary constants and guards exist, denied capabilities and privileged handoff fields fail closed, and existing profile/Guest behavior remains unchanged.

## Phase 1 exit

Phase 1 is complete when the bundled scenario proves both consequence paths through the production STORY reducer, private knowledge remains partitioned, every runtime reference is synthetic, reset reproduces the clean initial state, replay is deterministic from the known seed, the repository architecture audit reports no sibling-module private import or worsened STORY root fan-out, and the adapter has no Human-private, provider, connector, host-filesystem or real-canon dependency.

## Phase 2 exit

Phase 2 is complete when a fresh desktop Node visibly offers DEMO or the existing local-profile path, DEMO can run and reset the five-scene prepared world, exiting returns to the correct local entry surface, returning locked desktop users retain the existing chooser with DEMO secondary, authenticated/Guest behavior is not replaced, server-network remains fail-closed, and deterministic tests plus repository architecture/quality gates confirm the UI introduced no new authority path.

## Phase 3 exit

Phase 3 is complete when Sage Show Me can display deterministic before/after, knowledge-partition, relationship and authority projections from the current synthetic STORY world; the knowledge view proves character-private facts remain partitioned; the relationship view is derived rather than persisted; the authority view is derived from the executable DEMO capability lists; unsupported views fail closed; browser code remains projection-only; and tests prove projection does not mutate STORY state or introduce model/provider/private-profile/canon/connector/agent-authority dependencies.

## Phase 4 exit

Phase 4 is complete when `Make This Mine` is available only after the five-scene DEMO completes; explicit approval exits DEMO into the unchanged Human profile create/unlock path; no handoff data is persisted before authentication; the authenticated local mutation requires the existing CSRF/session boundary; a fresh normal PPF project is created and activated without mutating another project; only the human-readable title and Foundations starter brief cross the boundary; raw synthetic refs and privileged fields fail closed; retries are idempotent and conflict-safe; the durable project id remains a provenance-neutral normal UUID; server-network remains unavailable; and permanent DEMO tests prove the conversion cannot smuggle DEMO authority, hidden state or synthetic identity into Human-private storage.
