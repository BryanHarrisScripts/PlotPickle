# Developer Brief — One always-on PlotPickle Service Manager

Status: OWNER-APPROVED PRODUCT DIRECTION; IMPLEMENTATION NOT YET VERIFIED OR INSTALLED.
Date: 2026-10-27
Primary issue: #3268. Related: #3142, #3110, #3302, #3254, #3258/#3259, #3269, #3241, #3274, #3227, #1675, #3203.
Governing sources: README.md, AGENTS.md, docs/architecture/MANAGED-DESKTOP-HARNESS.md, docs/architecture/NODE-CONTROL-GRACEFUL-SHUTDOWN.md, config/runtime-manifest.json, config/runtime-sidecars.json, and the trusted W8/W9 test catalogue.

## Decision and scope

**One Windows installation choice: Always-on. One installer, one background Service Manager, one Settings > Compute > Services control panel, independently secured managed components.** The installer handles supported service registration and necessary elevation/consent; ordinary users do not configure Task Scheduler, separate tunnels, independent supervisors, individual worker startup or multiple installation modes. Windows-first; no WSL, Docker or new orchestration platform required. Existing launcher paths and user-facing PlotPickle surfaces remain supported during migration.

The Service Manager is a **lifecycle coordinator and status aggregator**, not a new coding agent, source-truth authority, signer, queue owner or replacement for the current independent Windows Supervisor. Its control plane must not gain the ability to issue coding grants, admit W8/W9 tests, sign independent verification, approve product acceptance, authorize spend, change canon, merge, or override STOP.

**Important dependency decision:** The full always-on service and installer are **not a prerequisite for proving the first bounded #3142 coding-to-PR cycle** on the existing owner-supervised Windows path. Requiring an unbuilt installer first would delay the actual worker/verification pilot. A durable, restart-safe, independently governed **equivalent supervisor/service lifecycle** is a prerequisite for claiming sustained unattended 24/7 operation and automatic second-cycle progress. Migrate that proven mechanism under the single manager; do not restart or replace the current owner runtime to satisfy documentation.

## Inventory and reuse

Already present, not to be rebuilt:
- `scripts/runtime-sidecar-supervisor.mjs` and `config/runtime-sidecars.json`: six registered runtime sidecars: Headless DSDD, Browser Verification, Pi Durable, Craft Runtime, Media Runtime, ChatGPT/MCP Gateway. Existing `after-core-ready` semantics keep core/UI availability independent of optional sidecars.
- `core/sidecars/local-supervisor.ts`, `core/sidecars/runtime/service-registry.mjs` and `status-store.mjs`: owned child process lifecycle, registered launch, status evidence.
- `config/runtime-manifest.json` and managed desktop harness: broader app, BUZZ, ComfyUI, optional engine and future Node component manifest; host-owned readiness differs from process presence.
- #3142 independent Windows Supervisor, #3254 authenticated Factory MCP tunnel and #3302 independent QA/test-admission design. Do not spawn a second dispatcher or expose unbounded shell commands.

First engineering slice: create a **read-only canonical service inventory projection** from existing component sources and host observations. Each item has a stable ID, category, declared owner/launch mode, source version/SHA, installation state, process owner identity (when proven), health/readiness state, last observation and evidence source, dependency/STOP state and supported operations. This projection must never mutate runtime state or mark missing evidence as healthy. Keep both existing manifests authoritative for their own fields until an independently tested migration proves consolidation. Avoid duplicate lifecycle truth.

## Windows architecture

- One SCM-registered top-level PlotPickle Service Manager, installed once with administrator approval, with bounded boot startup, recovery and explicit uninstall/upgrade behavior. Service Control Manager owns the top-level process; the manager owns only explicitly registered child/service handles. An existing Task Scheduler-based Supervisor/tunnel must be adopted or retired **only after** proven equivalent ownership, STOP and recovery, with no simultaneous competing launchers.
- Headless service runs in Session 0. It must not open a browser, impersonate a logged-in user, read a Human profile's secrets, show UI or mount interactive BUZZ sessions. A signed-in-user companion opens the PlotPickle UI and mediates Human-scoped operations and credential unlock.
- Independent Lane A reviewer uses a separate restricted Windows security principal/token, private signing key and ACL from F01 coding. The manager may observe its heartbeat and request a policy-allowed stop; it cannot access the signing key or issue signed admissions. Privileged service installation does not grant the coding worker reviewer privileges. A service identity may avoid a separate interactive Windows account, but owner-Windows SID/ACL and registrar attestation remain required.
- Owner-authenticated tunnel credentials remain local, protected and inaccessible to app UI/logs. Local port readiness is not remote ChatGPT plugin authorization. Plugin reconnection after restart must be observed through supported transport/auth APIs; if manual refresh is required, report `RECONNECT_REQUIRED` and provide an operator action, never unsupported browser automation.
- Preserve owner-machine STOP/PAUSE as durable state with separate explicit authorization to resume. Crash/reboot/watchdog may restart a *manager* but must not restart an intentionally STOPPED tunnel/worker, replay uncertain work, clear blocked reservations or start paid model calls.
- Start dependencies in bounded topological order, with retries/backoff, per-service startup timeouts and cycle detection. Failure of optional services does not block core product readiness. Lazy-load GPU/model/media engines only after capability authorization and resource preflight. No guessed PID termination; stop only owned process trees, with timeout and evidence.
- Windows service exit, user UI close, application graceful shutdown, Factory STOP, tunnel disconnect and Windows reboot are **distinct operations**. The Node crest graceful shutdown must save known creative state and close only PlotPickle-owned windows; it cannot silently destroy projects, keys, media or queue evidence.

## Managed component families

1. PlotPickle core application, user-session companion, and existing six sidecars.
2. Authenticated MCP tunnel and independently running Windows Supervisor.
3. F00 independent QA/test admission, F01 Software Factory worker pool and #3142 dispatcher, each with separate credentials, STOP and lease/ownership domains.
4. Future Learning & Evolution Factory (#3227), Game Factory/The Unwritten (#1675), Story Builder/Story Factory production services, and Semantic Story Coordinator (#3203; coordinator, **not** a fourth Factory). Registration does not imply enabled or authorized execution.
5. Optional BUZZ bridge, ComfyUI, local/cloud model providers, media engines and future PlotPickle Node compute adapters. Provider connections, cloud spend, model download, remote sharing and compute publication remain explicit opt-ins.

All additions must use reviewed stable IDs and a pinned launch/capability contract; no arbitrary executable/path or user-supplied command execution. Existing manifest licensing, stage-location and update policy apply.

## Settings > Compute > Services

One owner-authenticated control panel with source/version, service identity, actual owner/health observation timestamp and statuses `NOT_INSTALLED`, `DISABLED`, `WAITING`, `STARTING`, `RUNNING_NOT_READY`, `READY`, `DEGRADED`, `STALE`, `BLOCKED`, `STOP_REQUESTED`, `STOPPED`, `FAILED` and `UNPROVEN`. Display actionable reason codes. Do not conflate SCM running, HTTP listener, remote plugin auth, queue heartbeat, worker process, independent reviewer receipt, W8/W9 admission and owner-Windows Product Gate.

Offer scoped Start, Stop, Restart and Recheck only when policy/ownership allows, plus Start All for already-authorized registered services. Never silently grant a new role, provider spend, remote auth, coding edit, release or auto-merge. Confirm destructive shutdown and preserve saved-state guarantees. UI calls fixed authenticated lifecycle operations, not shell scripts with arbitrary parameters. Unknown/unowned processes remain visible as conflicts, not candidates for termination.

## Diagnostics, connection tests and opt-in issue promotion

Each component may register a bounded, read-only diagnostic with expected observation type, timeout and redaction rules. Include SCM/process ownership, source SHA, dependencies, local and remote tunnel readiness separately, Windows SID/ACL proof without private key contents, supervisor heartbeat, queue reservations, STOP, disk/stage capacity, sidecar health, model readiness and version/compatibility. Reports distinguish `PASS`, `FAIL`, `BLOCKED`, `UNPROVEN` and `NOT_APPLICABLE`, with evidence scope, timestamps and exact source head. A health probe is not independent product acceptance.

Provide `Review diagnostic report` then `Promote to Issue`: user opt-in, preview of a sanitized/deduplicated report, explicit GitHub account permission, and no upload of credentials, tokens, home paths, personal profile/BUZZ/creative data or private logs. Issue creation does not automatically authorize a coding worker or admit new tests. Record issue URL and provenance after GitHub confirms success; uncertain network outcomes require reconciliation, not replay.

## Two recovery layers

**Local:** Service Manager watches its registered tunnel/worker/supervisor via owned process identity and real health probes. Backoff is bounded; deliberate STOP is sticky; recovery emits durable local receipts with previous/new process identity, reason and outcome. Avoid competing SCM and Scheduled Task restart owners.

**External:** On tunnel recovery, verify actual ChatGPT MCP reconnection and authenticated tool availability; if absent, report a blocked reconnection state with supported user action. Do not claim the plugin reconnects automatically until measured.

## Safe implementation sequence and acceptance

**Slice 0 — existing #3142/#3302 pilot continues:** Finish owner-issued one-use coding/publication grants, actual exact-head Windows test evidence, independent W8/W9 reviewer and signed Product Gate. Do not defer the first genuine cycle behind the installer. Keep drafts #3311/#3314/#3321/#3322 blocked until their own gates are satisfied.

**Slice 1 — read-only inventory (first Service Manager code PR):** Map the two existing registries, independent Supervisor, tunnel and Factory into one status projection with stable IDs and provenance. No service installation, launch, STOP mutation, key access or test-catalogue edits. Add focused tests only after independently approved W8/W9 normative truth admission, including stale heartbeat, unknown component, false remote authorization, conflicting owners, STOP and no unsupported operation. Run existing truth preflight before executing revised tests.

**Slice 2 — bounded Windows Service spike:** Implement a reviewed SCM registration/uninstall/upgrade strategy and service/user-session separation; test service start/stop/reboot/logoff/crash, ownership lock, process-tree cleanup, no double launch, preserved STOP, no credential disclosure and rollback to current known-good launch. Do not modify the owner installation until owner Windows acceptance and safe migration plan are approved.

**Slice 3 — Settings control panel and diagnostics:** Read-only status first; then scoped lifecycle commands, diagnostic scripts and user-reviewed issue promotion. Verify authentication, CSRF/loopback guards, failure messaging, stale state, secret redaction and actual Windows GUI acceptance.

**Slice 4 — independent workers and future factories:** Admit F00/F01 roles under separate Windows identity/credential policies; prove two consecutive automatic cycles and only then measured two-worker claims, crash/recovery/resource conflicts and independent verification. Add Learning, Story Builder, Game and Coordinator adapters only after their own authorization and readiness contracts.

Every slice follows `Build -> Test -> Fix -> Independently Verify -> PR -> Merge when green -> Next`. Exact PR head CI, trusted-base test admission, native Windows Product Gate where relevant and signed independent receipts must agree before merge. Do not turn skipped Windows jobs or passing fixtures into production acceptance. Check source identity after any rebase/merge.

## Definition of done

A fresh Windows 11 machine installs PlotPickle through **one always-on choice**, with no manual Task Scheduler setup. After approved installation and reboot, the manager starts without a logged-in user; a signed-in Human can open the product, inspect truthful statuses, run diagnostics and explicitly stop/resume authorized services. Existing six sidecars and Supervisor/tunnel are integrated without competing ownership. Intentional STOP survives restart, unknown processes are never killed, independent signer keys remain inaccessible to coding, and remote auth/paid work are never inferred from installation. An optional failure can be reviewed and promoted to GitHub only after user consent. Real exact-head Windows acceptance and independent verification receipts exist. Until then, this is a developer brief, not a deployment or a claim of always-on operation.
