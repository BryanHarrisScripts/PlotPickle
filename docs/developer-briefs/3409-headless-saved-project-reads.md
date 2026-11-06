# #3409 — Explicit saved-project reads

The owner wants ChatGPT to be the primary interface, PlotPickle to retain its
independent headless engine and durable project truth, and Elara to coordinate.
The first full product milestone is recovering the same saved project in
ChatGPT with the GUI closed. This PR is the bounded read adapter foundation,
not completion of that milestone.

## Assessment and implementation

GO: encrypted profile storage already has listProjects/loadProject. Reuse it,
the existing profile-private HTTP boundary and canonical structure/Storyboard
observation owners. No new story store, service manager or GUI is required.

GET /api/auth/profile-private?storyRead=projects lists profile-scoped saved IDs
and revisions. storyRead=status|source|structure|shot requires projectId and
the exact saved revision. source and projects accept offset and limit (1–50).
shot additionally requires act, sequence, block, mini and shot. Duplicate,
unknown or malformed parameters fail closed. Reads do not change the active
project. Source pagination exposes retained truncation and never calls passage
placement an individually verified Shot mapping. Asset references/Save/Lock
metadata do not verify media bytes.

The current profile authentication remains mandatory. Factory engineering
authentication must not confer story-vault access. A later profile-scoped
plugin authorization adapter can call this model after authenticating the
user. Prefer Sign in with ChatGPT where available, without requiring a second
password for new public users; retain provider-neutral profile ownership.
Availability of that identity integration is not established for PlotPickle.
Do not pass profile passwords, browser cookies or vault keys through chat.

## Acceptance

1. Explicit saved-project reads work with no active project and preserve state.
2. Profile isolation and revoked sessions are enforced by real vault storage.
3. Wrong identity/revision and malformed pagination/coordinates fail closed.
4. Source paging retains order and states truncation; structure/shot data reuse
   existing owners, with no false byte-verification or film-readiness claim.
5. The HTTP adapter authorizes before loading content and retains no-store
   headers; no write, activation, provider or paid-generation operation is added.

## Validation and limits

Governed regression uses only disposable synthetic profiles/stories and the
real encrypted storage/auth services. Focused contracts, production build,
verification routing and convergence are separate checks. Owner Windows,
remote ChatGPT authentication, MCP exposure, restart recovery, public hosting
and GUI-closed readback remain UNPROVEN until directly observed.

No screenplay, original artwork or credential from the owner's project is
committed. No private plugin is published or public permissions changed.
