# Developer Brief — #1947 Phase 5 Live Evidence Coverage

Parent: #1922

## Purpose

Phase 5 turns the seven-layer verification mesh from a mostly static contract system into an evidence selector that can invoke the real runtime boundary when repository changes require it.

The first proof is the #1920 lesson: PR Gate and Product Gate could be green while local WebMCP startup UAT failed against the rendered Profile surface because the verifier and current UI authority had drifted apart. Source-string tests alone could not prove that the current rendered navigation/readiness contract worked.

## Phase 5 first slice

This slice adds one single-owned live observer:

- test ID: `experience.webmcp-live-observer`
- primary owner: `experience-skins`
- runner: `browser-uat`
- mode: impact only
- cost: medium
- platform: Linux
- trigger tokens: `skin`, `surface`, `navigation`, `visual`, `mcp`
- secrets: no
- external AI/provider calls: no
- network: yes, explicitly limited to repository dependencies and pinned Playwright/WebMCP verification tooling

The observer executes `scripts/verification-webmcp-live.mjs`, which starts the real local PlotPickle app and delegates the rendered inspection to the existing `scripts/run-webmcp-startup-uat.mjs` authority. That existing audit traverses the governed surfaces, checks readiness and visual conformance, runs the Skin V1 Visual Director and menu contract audit, and emits repair-ready findings plus screenshots/reports.

## Architecture ownership

### Layer 1 — Experience Skins

`app/skin-v1/**` and `app/skin-v1-definition.css` are registered as production-owned Skin boundaries with `skin`, `surface`, `navigation`, `visual`, and `mcp` risk.

A change there selects the live observer.

### Layer 2 — Experience Contract

`lib/experience/surface-registry.ts` is registered as the semantic surface/navigation authority with `surface`, `navigation`, and `mcp` risk.

The live observer remains single-owned by Layer 1, but the shared verification planner uses global risk tokens. Therefore a Layer 2 surface-registry change selects the Layer 1 live observer without duplicating the test or giving it two primary owners.

### Layer 7 — Validation & Operations

WebMCP verifier/runner files are verification-owned but emit `surface`, `navigation`, `visual`, and `mcp` risk. A verifier change therefore selects the observer it is responsible for judging. This directly prevents the #1920 class of silent verifier drift.

## Read-only observer boundary

WebMCP is evidence infrastructure, not production authority.

The live wrapper records `authority: read-only-observer`, does not pass `--repair`, does not request provider credentials, and makes no external AI provider calls. The existing WebMCP audit forbids `ppf-write`, `canon-mutation`, `buzz-publication`, `credential-read`, and `provider-invocation` capabilities.

A failing live audit may emit repair-ready evidence, but the running shadow job cannot mutate product source or certify its own repair.

## Network policy

The architecture-shadow matrix authorizes network-requiring verification only for Layer 1. Layers 2–7 remain `allow_network: false`.

Even on Layer 1, authorization alone does not cause network activity. The shared planner must first select `experience.webmcp-live-observer`. Unrelated docs-only changes therefore remain cheap and do not install application or browser tooling.

When selected, the live wrapper may use network only for:

1. `npm ci` using the repository lockfile;
2. the already-pinned `@playwright/test@1.63.0` and `@mcp-b/webmcp-polyfill@5.1.0` verification tooling used by the existing WebMCP startup runner;
3. the pinned Chromium verification browser if not already present.

This is verification-tool network activity, not provider inference or application egress.

## Evidence

The architecture layer evidence includes the selected test ID, exact commit SHA, changed-file/risk-token reasons, duration, and `networkUsed` state. The uploaded artifact also carries:

- `.artifacts/verification-live/webmcp-live.json`
- `.artifacts/webmcp-startup/summary.json`
- `.artifacts/webmcp-startup/uat-findings.json`
- `.artifacts/visual-readiness/dashboard-canonical.png`
- `.artifacts/visual-readiness/visual-director-report.json`
- other candidate surface screenshots emitted by the existing audit

No story text, prompts, credentials, private profile material, or hidden model reasoning is added to the verification evidence contract.

## What this slice does not do

- It does not make the seven architecture checks merge-authoritative.
- It does not remove PR Gate or Product Gate runtime checks.
- It does not broaden all `lib/experience/**` files into live WebMCP triggers.
- It does not run external AI providers.
- It does not move whisper.cpp, Pi, packaged UAT, or other native work into ordinary PRs.
- It does not treat every source-string assertion as obsolete; deterministic source/contract tests remain useful as fast baselines.

## Phase 5 follow-on

After this rendered proof is green, provider/native/plugin runtime boundaries can use the same pattern: one primary catalog owner, deterministic trigger tokens, typed runner, explicit permission/cost controls, and exact-head runtime evidence only when the affected boundary changes. Expensive native downloads remain conditional rather than universal.

## Acceptance proof

Focused #1947 regressions prove:

- Skin changes select live WebMCP;
- Layer 2 surface-registry changes trigger the single-owned Layer 1 observer;
- WebMCP verifier changes select live WebMCP;
- docs-only changes do not select it;
- without explicit network authorization it is skipped with `network-not-authorized`;
- only Layer 1 receives network authorization in the shadow matrix;
- the browser-UAT runner is bounded to repository `.mjs` scripts and the live wrapper is read-only/repair-free.

The Phase 5 PR itself changes the live WebMCP runner, so the exact-head architecture shadow run must select and execute the live observer successfully before this slice is merge-ready.
