# #3110 — PlotPickle Factory Observer, hourly ChatGPT scheduler and seven Agent Domains

**Status (2026-10-20):** Human-confirmed architecture and documentation brief. Not implemented end-to-end and not an operational acceptance receipt.  
**Parent:** [#3110](https://github.com/BryanHarrisScripts/PlotPickle/issues/3110). Supersedes the *target design* and model-route preference in earlier #3110 briefs for Software Factory only; preserves historical receipts and existing runtime implementation.  
**Scope:** Clarify the seven domains; design a Factory Observer inside Node.js / Windows; connect an hourly ChatGPT scheduler to the authenticated MCP engineering boundary; verify a single end-to-end Software Factory cycle. **Do not migrate, retire, rename or change existing product agents or frameworks as part of this brief.**

## 1. Seven Agent Domains — role and technology ownership

Domains describe **what the product does**, not separate agent frameworks. A registered agent may support multiple domains, but must retain **one canonical identity, role definition, permission contract and durable authority boundary**. A BUZZ mirror is not an additional agent or proof that the BUZZ runtime executes the role.

| Domain | Existing agents and roles | Existing technology |
| --- | --- | --- |
| **1. Story — Using the Craft** | Quillan Reedcloak, Elowen Mapweaver, Mira Threadmere, Knot Pickle, Thread Pickle, Heart Pickle, Tamsin Hearthquill, Story Specialists (e.g. character, world, screenwriter), Critics' Circle | Mastra, BUZZ-managed agents, PPF, Context Engine |
| **2. Story — Learning the Craft** | Sage Brinewick, Master Oaken-Vague, Rowan Scalequill, Discovery Mapper | Mastra, Wyrmwood, curriculum engine, deterministic game rules |
| **3. Story — Movie Making** | The Marquee Director, Graphic Novel Specialist, Production Specialist, Full Story Builder, Visual Production, Video Production | Mastra, Node.js workers, image/video providers, production pipeline |
| **4. Community** | Merrin Bellwarden, Orin Ledgerbark, Fen Copperwind, mirrored creative agents | BUZZ, Guildhall, signed identity and messaging |
| **5. Software Factory** | Rook Ironquill, engineering coordination, ChatGPT, proposed Factory Observer | ChatGPT via authenticated MCP, Node.js Windows Factory, GitHub |
| **6. Gaming — The Unwritten** | Character actors, game directors, world keepers, game-rule roles | The Unwritten engine, Responsibility Runs, Agent Profiles, deterministic state resolution |
| **7. Quality — Entire System** | BEN, Bram Gatewick, Luma Glassfern, Avery North, UI Continuity, Creative Writer UAT | Node.js, PowerShell, deterministic tests, browser UAT, CI |

**Cross-cutting rules:**
- Agent **role** defines the responsibility and output contract; **execution adapter** defines how it runs; **identity/coordination** defines attribution and handoff. Do not confuse them.
- PlotPickle's Agent Profiles, Context Engine and Responsibility Runs/Graphs retain host authority; PPF is creative canon authority; STORY game resolution owns mechanical state; GitHub owns code/PR/merge facts.
- Quality is one domain with independent verification contracts usable by **all other six** domains.
- Wyrmwood remains a learning/game experience with its existing authority; STORY: The Unwritten remains its own narrative-game engine. Do not rewrite or fuse them without a separately proven shared contract.
- Overlapping capabilities such as continuity, character, visual production and observer roles are **audit subjects**, not permission to delete, combine or move any existing agent.
- No changes to Community/BUZZ, Mastra, game agents, production workers or other product modules are authorized by this brief.

**Source registries:** `config/agent-profiles.json`, `config/agent-profile-extensions/community.json`, `build/mastra-agent-runtime.ts`, `lib/agents/production-supervisor-workers.mjs`, `modules/story-the-unwritten/`, `config/agent-orchestration.json`, `core/agents/agent-health-census.mjs`.

## 2. Software Factory ownership and execution model

| Component | Deployment / technology | Responsibility |
| --- | --- | --- |
| **Factory Observer** | Persistent **Node.js / Windows** process in existing Factory service/task ownership | Monitor process/heartbeat health, durable queue and reservations, exact-head evidence, blocked attempts, verification and recovery state |
| **Authoritative hourly scheduler** | **ChatGPT scheduled task** named `PlotPickle Hourly Issue Queue` | Each hour, inspect latest evidence; select **up to five NEW eligible issues**; stage or admit only when ChatGPT-only route is established and authorized |
| **Sole engineering AI** | **ChatGPT** using authenticated MCP and GitHub connectors | Read source, analyze and implement bounded patches, diagnose failed gates, coordinate reviews |
| **MCP transport** | Existing authenticated PlotPickle tunnel plus explicitly reviewed future engineering tools | Bidirectional request/result path for supported actions; durable idempotent control receipts |
| **Windows Factory** | Existing local Node.js scheduled worker, Git worktrees and Windows tooling | Native filesystem operations, build/test, UAT, staged PR support; cannot treat self-reported heartbeat as a pass |
| **Independent verification** | Existing Quality domain | BEN, focused contracts, build, Windows Product Gate, seven-layer exact-HEAD CI, independent outcome receipts |
| **Delivery authority** | GitHub + human-approved delivery rules | PR, independent checks, reviews and governed exact-head merge; no implicit auto-merge |

**BUZZ is not needed for Factory Observer identity, communication or execution.** Do not add a new BUZZ agent or room.

**Only ChatGPT via the authenticated MCP tunnel is an authorized AI engineering executor for this target Software Factory design.** Pi, Cline and any other models must not be invoked, selected as fallback, or made active by the scheduler. This is a prospective Software Factory route decision, not deletion of historical tooling or change to product agents.

An always-on Windows process and reachable tunnel **do not independently create a new ChatGPT reasoning turn**. The documented ChatGPT hourly scheduling feature is the proposed wake-up mechanism; whether unattended scheduled runs genuinely have permission to call this specific authenticated MCP connection is **UNPROVEN pending a live scheduled-run receipt**.

## 3. Factory Observer — continuous deterministic role

The Observer lives inside Software Factory, runs locally on Windows, and does not require an LLM. It reuses existing queue, service ownership, heartbeat, task ledger, exact-head dependency proof and immutable attempt records. It must not duplicate the Production Supervisor or assume an agent identity implies a running process.

**Required behavior:**
1. Record RUNNING / IDLE / WAITING / BLOCKED / OFFLINE / STOP_REQUESTED / STOPPED / UNKNOWN with timestamps and machine-bound evidence; distinguish observed process state from last reported heartbeat.
2. Monitor GitHub issue/PR status, approved queue, unique first-attempt reservations, CI status, build and UAT evidence with stable identifiers and HEAD SHAs.
3. Detect a stale heartbeat, dead child, failed dependency preflight, missing scoped edits, failed tool lifecycle, stale PR head or missing independent verification.
4. Preserve all previously started/uncertain/blocked attempts; never silently retry or delete evidence. No #3141/#3158/#3160/#3164/#3173 replay.
5. When ChatGPT is unavailable, continue *deterministic monitoring only*: preserve state, stage safe diagnostics, and wait for the next supported ChatGPT invocation.
6. Expose bounded read/status/evidence and authenticated actions consistently to MCP, Settings → Command and graphical Factory UI; receipts are authoritative over labels.

## 4. Hourly scheduler — queue semantics

One authoritative engineering scheduler is enabled: **`PlotPickle Hourly Issue Queue`**. The previous `PlotPickle Software Factory` ChatGPT hourly schedule has been **disabled by owner direction**, retaining its run history. This is separate from the native Windows Scheduled Task that hosts the Factory.

Each hourly ChatGPT invocation:
1. Retrieve authenticated live MCP status, issue preview, durable receipts and canonical GitHub issue/PR state.
2. Ensure the intended Windows source HEAD matches its verified checkout; require fresh native dependency proof for that exact HEAD before executable admission.
3. Select **at most five distinct NEW issues** eligible under the current policy; do not confuse 5 candidates, 5 approvals, 5 reservations or 5 completed fixes.
4. Exclude already-reserved, terminally blocked, in-progress, duplicate, stale or dependency-blocked issues.
5. **Until the current Pi dispatcher has been replaced/isolated and the ChatGPT-MCP-only execution route independently verified, report `QUEUING BLOCKED — PI DISPATCHER`; stage read-only candidates only. DO NOT call `factory_admit_issues` or trigger that native dispatcher.**
6. After implementation and explicit bounded admission authority, admit at most five new eligible issues using fresh nonces, exact-head checks, write-once receipts and no automatic replay.
7. Record issues selected/admitted/executed, verified CI/UAT evidence, failure states and next human action. Handle quota/session expiry or connector unavailability as waiting/unknown rather than success.

The hourly schedule is not a guarantee that five fixes finish each hour, that ChatGPT inference runs indefinitely, or that scheduled sessions can reuse the existing MCP credential. No subscriptions are transformed into an unattended Windows model API.

## 5. ChatGPT-only engineering tool contract

The current authenticated Factory MCP implementation advertises only bounded status/evidence/preview/preflight/admission/receipt controls, **not** general Windows file edits, tests or shell execution. Future additive engineering tools must be reviewed before use:

- Read approved repo sources and safe diagnostics in an isolated, clean, pinned worktree.
- Apply explicit reviewed file edits to bounded paths; return diff SHA and exact result.
- Run allowlisted focused tests, BEN, production build and separately authorized Windows browser/device UAT; return redacted structured evidence with exact source SHA.
- Inspect, create and update GitHub branches/PRs with duplicate suppression; retrieve exact PR head and independent CI.
- Inspect leases and child process ownership; support local emergency stop and confirm actual termination rather than just echoing STOP_REQUESTED.
- Expose durable control receipts with idempotency keys, expiry, scopes and role grants. Never accept arbitrary GitHub issue text as executable shell commands.
- Confirm merge only under an **explicit, bounded human-delegated merge policy** and all applicable independent gates; auto merge stays disabled until granted.

The deterministic verifier must be independent from ChatGPT's statement of success. Product Gate and PR Gate outcomes must refer to the same verified current HEAD; missing or skipped gates are **UNPROVEN**, not green.

## 6. Implementation slices and acceptance plan

Documenting this design is **not** implementation of the slices below.

| Stage | Test / evidence | Status at brief creation |
| --- | --- | --- |
| **A0 — Scheduler unification** | Older engineering task disabled; only hourly `PlotPickle Hourly Issue Queue` enabled for Software Factory work | **Observed in ChatGPT scheduler settings** |
| **A1 — Observer presence** | Genuine Windows service heartbeat with process/lease validation, CMD/MCP readback, no browser dependence | **Partial**: worker heartbeat and queue exist; full Observer contract unproven |
| **A2 — Scheduled wake-up** | One unattended hourly task run without user message, attributable by run timestamp | **UNPROVEN** |
| **A3 — Scheduled MCP** | That same scheduled run calls `factory_status` over the authenticated tunnel and preserves readback | **UNPROVEN** |
| **A4 — Selection** | Select 0–5 verified fresh eligible issues; prove no duplicates/replays/admission to Pi | **Not proven end-to-end** |
| **A5 — Sole coding route** | Pi/Cline invocation blocked on this Factory path; approved ChatGPT MCP edits actually occur | **UNPROVEN / dispatcher currently still Pi** |
| **A6 — Real source edit** | ChatGPT-triggered bounded worktree mutation + independently read-back diff at expected SHA | **UNPROVEN** |
| **A7 — Repair cycle** | Fail deterministic gate, return evidence, repair via ChatGPT MCP, pass genuine build/focused UAT | **UNPROVEN** |
| **A8 — Independent challenge** | BEN, Windows Product Gate, seven-layer CI exact current PR HEAD with reviewed exceptions | **UNPROVEN** |
| **A9 — PR and governed merge** | Issue-linked actual PR, no stale checks, correct approvals, merge SHA verified only when authorized | **UNPROVEN** |
| **A10 — Continuity** | Windows task survives allowed disconnect/restart; observer waits and next scheduled turn resumes via receipts, not replay | **UNPROVEN** |

**First integration experiment:** one scheduled ChatGPT wake-up calls `factory_status` and records a truthful receipt **without source writes or Pi**. Next prove a single fresh, authorized ChatGPT-MCP worktree edit → tests → build → draft PR → independent exact-head CI/Windows UAT → human-governed merge, then graduate to a maximum of five new issue admissions hourly.

## 7. Evidence already available — do not overclaim

- Live authenticated tunnel and Windows worker have reported a fresh heartbeat, bounded status and the approved queue. This proves connectivity/status **only**, not source mutation or successful Windows Product Gate.
- New native dependency preflight produced `INSTALL_PREFLIGHT_READY / NPM_CI_VERIFIED` for `bc474e15b21a2f7ce3a8a06b9cc8d39842226587` after PR #3176 merged.
- #3173 attempt 1 is immutable **BLOCKED / PI_WRITE_TOOL_NOT_OBSERVED** in `RUN_LOCAL_PI`; no draft PR, verified file edit, native UAT or automatic merge. Never replay.
- The new hourly schedule exists; unattended MCP tool availability and its first scheduled execution are unverified.
- Legacy #3110 briefs contain prior Pi/Cline implementation plans. Preserve them as history; they do not authorize invoking Pi/Cline for the new ChatGPT-only target.

## 8. Completion definition and scope guard

**Completion requires:** one source-backed, owner-authorized issue is actually implemented through ChatGPT MCP in an isolated Windows worktree, passes relevant focused tests/build/independent Windows Product Gate and exact-head PR CI, obtains a properly governed merge with verified SHA, and leaves durable receipts that the Observer and following scheduled ChatGPT execution can both inspect. Independently demonstrate 0–5 new candidate selection without duplicate/replay and honest offline/quota behavior.

**Out of scope now:** deleting or retiring existing agents, changing BUZZ, moving Mastra roles, modifying STORY/Wyrmwood or production workflows, revising user story canon, auto-approving assets, unbounded engineering shell access, silent paid-provider fallback, and any invented assumption that an hourly ChatGPT scheduler guarantees continuous inference.

**Development:** follow `AGENTS.md` and `docs/architecture/PLOTPICKLE-DEVELOPMENT-LOOP.md`: focused implementation, clean branch/worktree, true tests/UAT, exact-head CI, convergence evidence where applicable, governed PR and merge. Documentation-only acceptance establishes architectural clarity, not the autonomous Factory.
