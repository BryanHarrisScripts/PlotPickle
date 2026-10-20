# #3110 — PlotPickle Testing → Software Factory → Normal continuous improvement

**Date:** 2026-10-20
**Status:** Human-directed implementation brief; stages are accepted individually only on observed evidence.
**Parent:** [#3110](https://github.com/BryanHarrisScripts/PlotPickle/issues/3110)
**Canonical architecture:** [Observer, hourly ChatGPT scheduler and seven Agent Domains](3110-factory-observer-hourly-scheduler-seven-domains.md)
**Direction:** Connect existing synthetic QA, deduplicated GitHub findings, the ChatGPT-only MCP Factory, independent Quality, and the normal product release path. Reuse existing infrastructure rather than creating a second queue, agent framework or application edition.

## 1. Three product/engineering environments, seven enduring domains

The environments are **not** additional Agent Domains:
1. **PlotPickle Normal** — everyday Human-facing product with personal profile and real PPF data. Currently the Normal launcher uses a Vite source-development runtime. It must not be described as a verified production-built Windows release.
2. **PlotPickle Testing** — Synthetic UAT (including isolated guest journeys), Conversational UAT and WebMCP QA; separate synthetic profiles, deterministic reproduction and artifact receipts.
3. **Software Factory** — durable Node.js/Windows Observer, hourly ChatGPT scheduler, authenticated MCP transport, GitHub issue/branch/PR lifecycle and real independent build/UAT gates. **Only ChatGPT via authorized MCP/GitHub connectors performs engineering reasoning and code authorship.**

The seven domains remain:
| Domain | Ownership in this feedback loop |
| --- | --- |
| 1. Story — Using the Craft | Human-approved canon and story experiences are test subjects, never Factory authority |
| 2. Story — Learning the Craft | Curriculum/Wyrmwood journeys can produce isolated reproducible test evidence |
| 3. Story — Movie Making | Production/visual stages are tested without silently spending or approving assets |
| 4. Community | Existing signed identity/messaging may be tested; BUZZ is **not** the Factory scheduler |
| 5. Software Factory | Rook/engineering coordination, deterministic Observer and ChatGPT-only implementation |
| 6. Gaming — The Unwritten | State resolver owns game rules; synthetic testers cannot grant authoritative actions |
| 7. Quality — Entire System | BEN, Bram, Luma, Avery, UI Continuity, Creative Writer UAT, GitHub CI and Windows Product Gate independently challenge claims |

Shared agents may serve multiple domains without cloning identities, memories or roles. No existing product agent, Mastra or BUZZ runtime is removed by this work.

## 2. Source-backed pipeline

`Normal candidate/source HEAD → isolated Synthetic/Conversational/WebMCP UAT → reproducible fingerprinted GitHub QA issue → read-only Observer issue shortlist → hourly ChatGPT selection (maximum five NEW issues) → authorized GitHub edits/PR → exact-HEAD native Windows tests, BEN and Quality → governed merge → tested/released Normal version → original UAT rerun`.

**QA evidence is not execution consent.** The existing `scripts/autonomous-qa/publish-defect.mjs` already requires matching observations, an exact failing commit/build, references and a deterministic fingerprint. It creates or augments a GitHub issue and prevents duplicate issue proliferation. The existing `scripts/autonomous-qa/resolve-targeted-fix.mjs` links one repair PR to one QA defect and chooses an appropriate targeted rerun.

The Factory must not treat an arbitrary issue title, body, marker or model claim as independently verified defect evidence. Candidate intake is read-only until GitHub identity, reproduction, issue eligibility, permissions, source head and worker route are checked.

## 3. Observer and first implementation slice

Run **a separate monitoring-only Node.js process** on the local Windows host, without starting `PlotPickleSoftwareFactory` or its Pi dispatcher. The command `node scripts/engineering-team/windows/supervisor/factory-monitor.mjs --once` takes one snapshot; `--watch` repeats every 60 seconds while that process remains alive.

- Reuse the existing authenticated `factory_observer` MCP snapshot and immutable reservations/results.
- Read up to 100 current open issues through the existing `gh` CLI; choose up to five plausible `[Autonomous QA]` issues with fingerprint, exact failing head/build and reproduction references; mark every one `QA_CANDIDATE_UNVERIFIED`.
- Exclude terminal/reserved issue IDs, duplicate fingerprints, closed/on-hold items, malformed findings and ambiguous data.
- When GitHub is unavailable, publish `GITHUB_UNAVAILABLE` with **zero candidates**; never fabricate an eligible batch.
- Write **only** one sanitized, locally owned `observer-monitor.json` heartbeat. Do not rewrite `config.json`, jobs, source files, PPF assets, GitHub issues or attempt receipts.
- Extend the existing `factory_observer` MCP response with a sanitized **monitor-only** heartbeat; freshness is not proof of process ownership, coding execution, production release or UAT.
- Keep `PlotPickleSoftwareFactory` stopped; do not run `--serve`, `--once` on the legacy coder dispatcher or `factory_admit_issues` until the ChatGPT-only executor is proven.

A foreground `--watch` process is not by itself a restart-resistant Windows service. A reviewed startup/stop ownership contract and native Windows Scheduled Task proof remain needed for unattended reboot recovery.

## 4. ChatGPT scheduler and engineering execution — next slices

Retain one authoritative `PlotPickle Hourly Issue Queue` ChatGPT schedule. Each scheduled turn must obtain a **real authenticated MCP receipt in that turn**, query current GitHub source and evidence, and select at most five *new* eligible issues. Five candidates are not five admissions, repairs or merges.

Before any executable issue admission, implement and independently prove the **ChatGPT-only** source edit/build/test/repair route. Prefer ChatGPT GitHub connector for bounded edits/branches and a scoped authenticated Windows MCP host for exact-head checkout, named allowlisted test commands, native UAT and sanitized results. No arbitrary Windows shell from untrusted issue text. Do not invoke Pi, Cline, Mastra, BUZZ or paid creative provider fallback as an AI software engineer.

All new operations require explicit scope, idempotency keys, exact-head binding, safe failure states, immutable receipts, and real process ownership. Unknown outcomes are not replayable. Independent BEN/Windows/CI checks, current PR head, review and delivery authority govern merge. Recheck the targeted synthetic failure on the fixed head.

## 5. Normal promotion policy

A GitHub merge changes `main` source; it does **not** prove the currently running PlotPickle Normal instance is upgraded or production-built. The present normal launcher is Vite-based. Implement and accept a versioned release/promotion path separately, including genuine Windows production-built startup, real PPF/profile continuity, restart, privacy boundaries and post-promotion QA.

Never overwrite a Human's live PPF/projects using synthetic fixtures. No automatic creative approvals, cloud spend or synthetic credentials in Normal.

## 6. Acceptance matrix

| ID | Required observation | At first slice |
| --- | --- | --- |
| H1 | Read immutable historical issue attempts and exact-head status via existing MCP Observer | Supported; local snapshot observed |
| H2 | Monitor-only process reads synthetic QA issues without starting Pi or admitting a job | New code + synthetic tests; native Windows run pending |
| H3 | Duplicate, malformed, closed, held and reserved findings fail closed | New unit tests; GitHub CI pending |
| H4 | Monitor heartbeat available through same MCP tool with no new tool discovery | New code + tests; native readback pending |
| H5 | Hourly scheduled ChatGPT run genuinely connects over MCP unattended | UNPROVEN |
| H6 | ChatGPT-only scoped engineering edits and native independent build/UAT | NOT IMPLEMENTED |
| H7 | Repair PR exact head verified, governed merge and targeted rerun | NOT IMPLEMENTED |
| H8 | Versioned production-built Normal promotion and retest | NOT IMPLEMENTED |
| H9 | Windows observer restarts after reboot with owned PID, STOP and no duplicate process | NOT IMPLEMENTED |

**Completion contract:** Start with one real *synthetic* reproducible finding, preserve its issue fingerprint from testing through the Factory, implement it with ChatGPT alone, independently verify on Windows and exact PR head, merge under approved policy, confirm genuine Normal version promotion and rerun the original scenario. Then repeat within the five-new-issues-per-hour policy.

### Safety / scope

This first slice does **not** enable automatic source changes, unattended merges, Windows task startup, provider spend, creative canon mutation or Pi/Cline routing. It adds a deterministic read-only monitor that can be run on the owner's Windows host while the legacy coding task stays stopped. Never call a synthetic green test proof of an actual Windows run.
