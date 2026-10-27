# #3268 — One-installer, always-on PlotPickle Service Manager
## Owner-approved developer brief · 27 October 2026

**Status:** APPROVED PRODUCT DIRECTION; IMPLEMENTATION NOT YET VERIFIED OR INSTALLED. This is a developer brief and acceptance plan, not a Windows Service installer, operating worker, authorization grant, or replacement for security gates.

**Owners:** #3268 unified Settings/Compute lifecycle; #3142/#3110 durable Software Factory; #3254 authenticated tunnel; #3302 independent reviewer; #3274 locked roadmap governance. Existing runtime owners: #2693/#2694 (completed normal-startup sidecars), #1079 (managed desktop harness). Related Windows acceptance #3269. Existing development contract: `README.md`, `AGENTS.md`, approved WHITE-PAPER-V3 W8/W9.

### 1. User promise and installation decision

**One installer. One always-on background Service Manager. One understandable control panel. Multiple independently secured services.**

PlotPickle offers **one installer configuration: Always-on mode**. The installer, after transparent Windows elevation/consent when required, performs supported registration, source/manifest verification, dependency checks, service account/credential setup and the initial service health verification. An ordinary user is not required to choose between personal/system install modes, create Task Scheduler tasks, manually start a tunnel, configure multiple supervisors, enter secret values into arbitrary windows, or choose an orchestration technology.

A background service *starts at Windows boot* and remains capable of bounded headless service management while the GUI is closed, with persisted intentional STOP. A separate **interactive user-session companion** may start the PlotPickle application, browser, and user-profile connections **after sign-in and profile authorization**. Windows Session 0 service code must not pretend to open an interactive UI or gain access to logged-in user secrets. A single installation choice does not imply every optional component or factory is authorized to run.

Any administrative prompts are one-time, explicit system requirements, not technical installation decisions. Failed setup reports a concrete diagnostic and safe rollback, never a successful service installation. No platform service or account is automatically created by evaluating this brief or a CI test.

### 2. Reuse existing work; avoid three competing lifecycle authorities

PlotPickle already contains:
- `config/runtime-sidecars.json` with six normal-startup sidecars: **Headless DSDD, Browser Verification, Pi Durable, Craft Runtime, Media Runtime, ChatGPT/MCP Gateway**.
- `scripts/runtime-sidecar-supervisor.mjs`, `core/sidecars/local-supervisor.ts`, `core/sidecars/runtime/service-registry.mjs`, `core/sidecars/runtime/status-store.mjs`; product-first asynchronous startup, bounded registry and lifecycle status, with core availability separated from optional sidecars.
- `config/runtime-manifest.json` and `docs/architecture/MANAGED-DESKTOP-HARNESS.md`; managed app, BUZZ bridge, ComfyUI, optional engine and future PlotPickle Node concepts.
- `scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs` plus `Install-PlotPickleIndependentSupervisor.ps1`; the existing **independent Windows Supervisor** with owner consent, separate local STOP/PAUSE/lock/heartbeat and bounded paired-control polling. Its heartbeat is **not** evidence of autonomous coding or independent Windows Product Gate.
- Existing authenticated Factory tunnel and #3254 owner-owned tunnel launcher. Local MCP listener readiness is not proof that a remote ChatGPT connection is authorized.

**Design:** Add one top-level **PlotPickle Service Manager** for system-wide lifecycle reconciliation, managed installation, status aggregation and controlled dispatch of already-authorized component starts. Existing domain-specific supervisors remain responsible for *their own* proven process trees and authority; no duplicate manager may directly seize their locks, mark a child as authenticated merely because a port is listening, or start a legacy Pi dispatcher.

Create an adapter/view registry that references existing fixed component IDs and manifests rather than adding another arbitrary-command registry. All authority-bearing lifecycle actions continue through their approved owner. Each service declares `id,owner,executionIdentity,enabledPolicy,dependencies,launchStrategy,processOwnership,probeScope,readiness,stopPolicy,recoveryPolicy,version,sourceSha,diagnosticSuites`, with independently verified status; unknown service IDs fail closed. A read-only inventory/status adapter is the **first code slice**, not a new launcher.

### 3. Components and factory roadmap

| Service group | Initial posture | Owner and special guard |
| --- | --- | --- |
| PlotPickle host, UI companion, local runtime | Managed after install and Human sign-in as applicable | Preserve PPF, project saves, session/profile separation and owned browser window |
| Six existing runtime sidecars | Preserve currently reviewed per-sidecar default and after-core-ready contract | Keep optional media degradation nonblocking; source `config/runtime-sidecars.json` |
| Owner-authenticated Factory MCP tunnel | Registered, **external authorization separately checked** | Reuse one tunnel; secrets remain in OS owner credential boundary; no implicit connection claim |
| Independent Windows Supervisor | Registered using existing ownership and STOP semantics | Preserve current task/lock/paired-control contract during migration; do not add Supervisor B by default |
| F00 Lane A independent test-catalogue reviewer | Visible **NOT_PROVISIONED/BLOCKED** | Distinct Windows security token and Ed25519 signer with separately controlled registrar, no code/catalogue/merge rights; #3322 |
| F00 Lane B QA worker and Product Gate | Visible **NOT_PROVEN/BLOCKED** | Admitted tests only, independent Windows/browser evidence; #3321/#3302 |
| F01 Software Factory and dispatcher | Visible **NOT_PROVEN/BLOCKED** until admitted | One-shot worker proof and two consecutive genuine cycles precede unattended queue; #3311/#3142 |
| F02 Learning & Evolution Factory | Registered **PLANNED/DISABLED** | No research spending or knowledge promotion without applicable authorization; #3227 |
| F03 Story Builder Factory | Registered **PLANNED/DISABLED** | No automatic paid renders, canon revisions, rights bypass or publishing |
| F04 Game Factory — The Unwritten | Registered **PLANNED/DISABLED** | Preserve game rules, world/canon boundaries; #1675 |
| Semantic Story Coordinator | Registered **PLANNED/DISABLED** | Cross-factory coordinator, **not** a fifth Factory; #3203 |
| Optional BUZZ, ComfyUI, provider/Node adapters | Inherit existing opt-in and dormant policies | Manage lifecycle only where authorized; no sharing compute or unlocking provider credentials automatically |

**Important:** Installed, registered, process-running, healthy, remote-authenticated, model-capable, independently verified, and work-authorized are **different properties**. A newly registered factory is not an operational factory.

### 4. Service lifecycle and security boundary

- The Service Manager can **observe** status/readiness, request bounded starts/stops through existing approved owner adapters, and report errors. It **cannot** mint a source-edit grant, coding model budget, independent signer, verifier ADMIT, GitHub token, approved-truth binding, story Save/Lock, PR merge authority, or Windows Product Gate.
- The top-level Windows Service should be installed with least-privilege SCM configuration, fixed reviewed binary path/signature and controlled update/rollback. Separate reviewer and coding service identities where needed; share the UI, not their credentials. Do not run the Service Manager under LocalSystem merely to avoid designing permission boundaries.
- Persisted intentional STOP, PAUSE, signature/key revocation, expired owner grants, stale exact-head identity and uncertainty **win over** a restart/recovery request. Service Manager boot does not auto-clear STOP or replay uncertain jobs. Fail-closed disabled/unknown remote authentication; never auto-resume paid inference.
- Startup: verify installed package and manifest → start bounded host/control read-only monitoring → observe approved core readiness → converge ordinary allowed sidecars → check tunnel local/remote separately → observe Supervisor and registered workers → leave unproven factories blocked. Optional heavy GPU/model processes remain lazy and only start after accepted provider/work approval.
- Shutdown: distinguish **Close PlotPickle window** (background manager may continue), **Stop PlotPickle services** (governed global STOP and owner-only teardown), **Quit/Shutdown Node** (existing safe creative-state contract) and **Stop Windows service**. Never kill guessed PIDs, another user's browser, an external model service, or orphan processes without proven ownership.
- Recovery: bounded retry budget, exponential backoff, circuit breaker and explicit failure codes. Do not forcibly clear unknown locks, stale reservations, incomplete receipts or Windows acceptance uncertainty. A reboot and process crash must preserve service STOP and non-replay evidence.
- Credentials: encrypted and per-SID/OS-protected; Windows service boundary cannot silently read a user's BUZZ/profile/OpenAI credentials or own the F00 independent reviewer's private signing key. Remote ChatGPT plugin reconnection is a separate verified step.

### 5. One control panel in Settings → Compute → Services

Show components grouped by **Core & Startup · Connections · Supervisors & Independent Quality · Factories · Sidecars & Providers**. Each item displays:
1. Product/source version and actual installed path or explicit NOT_INSTALLED; process/token owner when independently observed.
2. `INSTALLED`, `DISABLED`, `WAITING`, `STARTING`, `RUNNING`, `READY`, `DEGRADED`, `BLOCKED`, `STALE`, `STOP_REQUESTED`, `STOPPED`, or `UNAVAILABLE`, with evidence timestamp.
3. Distinct `processRunning`, `capabilityReady`, `remoteAuthenticated`, `jobAuthorized`, `independentVerification` fields; use `unknown`, never inferred green.
4. Dependency failures, last bounded diagnostic code and next action. No false "online" from only heartbeat or listening port.
5. Owner-scoped **Start / Stop / Restart / Recheck** actions only for allowlisted components with valid authority. Never expose arbitrary commands or arbitrary PID termination. Global Start All and Stop All respect dependencies, pending creative saves, and STOP acknowledgements.

Use the existing Node control and profile UX; avoid duplicate Settings and command surfaces. Persist per-film chat/session and app operation independently of backend worker lifecycle.

### 6. Diagnostics, reproducible evidence and opt-in issue promotion

- One read-only **Run Diagnostics** action launches reviewed, bounded, resource-safe suites per component. The registry declares required source head, platform and capability; no arbitrary shell command or test script specified by issue text.
- Examples: SCM install/task ownership, process-token SID and ACL **existence only**, main/core HTTP, runtime sidecars and status ages, tunnel local/remote auth, Supervisor enabled/STOP/heartbeat, claim/queue worker uncertainty, storage/disk quota, provider readiness (without paid inference), Windows browser/product evidence, current exact-head CI and package-manifest integrity. Distinguish mock, static, local Windows and actual product scopes.
- Results use `PASS`, `FAIL`, `BLOCKED`, `UNPROVEN`; include `suiteId,sourceSha,componentId,observedAt,scope,evidenceIds,diagnostics`. A missing check is UNPROVEN; CI green is not Windows Product Gate.
- Produce a **sanitized diagnostic bundle** with secrets, machine-specific private paths, credentials, creative content and hidden prompts omitted or redacted, bounded size, deterministic error fingerprints and only narrow safe evidence links.
- **Promote to Issue**: Human reviews the report and gives explicit per-submission consent for configured GitHub authorization. The tool proposes a deduplicated, source-bound GitHub issue with reproduction steps and scope; it must never auto-publish support data or automatically admit coding work. Once created it follows #3142's ordinary queue approval and corrective-work-order policies. Future optional in-app promotion uses the same reviewed API, not an unrestricted token or issue-text shell.

### 7. Minimal delivery slices and tests

**Slice 0 — This brief + PR reconciliation:** Inventory current launchers, six sidecars, existing Supervisor, tunnel and #3268; identify where duplicate lifecycle truth would appear. Do **not** install or change scheduled tasks.

**Slice 1 — Read-only unified inventory (first implementation):** Compose trusted static component registry and aggregated status projection from *existing* sidecar/manifest/Supervisor/tunnel sources. No launch/stop commands, credentials, new paid work, Service Control Manager actions, extra tunnel, new independent worker, or test-truth amendment. Test unknown registry entry, stale/missing status, duplicate ID, wrong source SHA and misleading GREEN with synthetic fixtures. Admitted test-truth W8/W9 mapping must precede running changed tests in CI.

**Slice 2 — Native Windows Service Manager and one installer:** Fixed reviewed install/update/repair/uninstall, explicit elevation and rollback, service separation and user-session companion; Windows SCM service logoff/reboot/start/STOP controls. Independent owner Windows acceptance on a clean machine. Preserve current launcher as an explicit migration/fallback during the acceptance window; do not create competing live owners.

**Slice 3 — Status/control UI:** Settings → Compute service list, per-component bounded actions, accessible errors, no button traps, global STOP and child acknowledgement. Distinguish persistent service from closed UI and saved creative state.

**Slice 4 — Diagnostics/Issue promotion:** Read-only allowlisted diagnostics, provenance, redaction/no-credential leakage, user-approved issue drafting and duplicate recognition.

**Slice 5 — Worker/factory integration:** Actual independent Lane A registrar/SID/receipt proof, Lane B admitted tests and Windows Product Gate, real F01 coding/publishing + verification cycles, durable queue autonomous second cycle. Later register F02/F03/F04 and Coordinator as their capabilities are independently proven.

**Native acceptance matrix:** clean-install (no existing tasks), upgrade with already-running legacy supervisor/tunnel, crash while writing receipt, reboot during intentional STOP, simultaneous service starts, failed dependency, remote plugin revoked, credential absent, standard user vs admin boundaries, SID/ACL isolation, process-tree stop and unrelated sentinel, hidden background host with interactive profile UI, resource contention with GPU/media sidecars, backup/uninstall without deleting user projects or retained receipts. Include exact-head CI, approved-truth catalogue and independent Windows/product evidence. No simulated run is a release-ready receipt.

### 8. Dependency clarification for the Software Factory

**A unified always-on manager is required for the final user-facing, unattended-install promise.** It is **not a prerequisite for validating #3311's single bounded worker**, exact-source W8/W9 catalogue tests, #3302's independent admission design, or two genuine engineering cycles using the *existing supervised host* where its ownership and STOP can be independently proven. Delaying all engineering until installer completion would create a circular dependency: the Software Factory must help build its own Service Manager.

Acceptance sequence: keep #3311 and #3302 gated → prove worker and independent quality separately → add the minimal service-inventory layer → verify one coordinated background lifecycle → finish installer/UI/diagnostics → prove unattended restart and next-issue scheduling → expand capacity after measured safety/throughput. Neither "service installed" nor "two successful fixtures" makes a genuinely autonomous Factory.

### 9. Current open PR reconciliation (observed 27 October 2026)

| PR | Role | Gate/disposition |
| --- | --- | --- |
| #3311 | Single coding worker + draft publication + owner acceptance broker | DRAFT; unmergeable, exact-head Windows owner proof absent. Keep until independently accepted. |
| #3314 | Separate Engineering Dispatcher MCP plugin and one-shot bridge, stacked on #3311 | DRAFT/unmergeable; **reconcile one-tunnel direction**. Preserve code/grant/STOP receipts and map to existing tunnel/managed service before retiring stacked plugin PR. Do not abandon those obligations. |
| #3315 | Dependabot six production updates | OPEN; hosted CI failed because changing `package.json` invalidated existing approved test-input digests. Requires independent catalogue edition admission and compatibility/build/Windows proof; not mergeable now. |
| #3321 | QA claim/preflight | DRAFT; missing approved truth bindings and real tamper/crash/STOP proof. Keep. |
| #3322 | Lane A signing/enrollment | DRAFT; missing independent catalogue admission and production Windows principal/signer. Keep. |

**PR lifecycle:** close only a demonstrably superseded or abandoned PR **without merge**, preserving its requirements and source for selective porting. Merge only exact-head green required CI with separately required owner Windows/independent evidence; never merge a draft or turn off truth governance to reduce the backlog. An open PR is not the same as an open issue.

**No power expansion:** This brief authorizes planning and bounded implementation proposals, not live installation or paid compute without its own existing consent; no currently unproven worker, signer, tunnel, or Factory is represented as running merely because it appears in the registry.
