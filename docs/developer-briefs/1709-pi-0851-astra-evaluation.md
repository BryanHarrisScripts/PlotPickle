# Developer Brief — #1709 Pi 0.85.1 / GPT-6 Astra evaluation

## Purpose

Evaluate `@earendil-works/pi-coding-agent@0.85.1` against PlotPickle's existing managed developer-agent boundary before changing the authoritative Pi pin. The candidate adds GPT-6 Astra support upstream, but PlotPickle must not trade a known-green local developer stack for an unproven upgrade.

## Current authority

- Authoritative managed Pi remains `0.84.4` until this issue's Windows candidate proof is green.
- `scripts/pi-managed-install.mjs` owns the managed executable pin and private installation boundary.
- `config/developer-agent-stack.json` owns the required developer-agent stack and exact Pi package list.
- Full Verification continues to use the PlotPickle-managed Pi executable with local-only repair inference and no cloud fallback.
- `AGENTS.md` remains the repository development constitution.

## Upstream candidate facts reviewed

Pi 0.85.1 was released 2026-09-05. Its upstream changelog states that it:

- adds GPT-6 Astra through OpenAI API-key and OpenAI Codex subscription routes;
- fixes the 0.85.0 SDK publication problem involving internal experimental dependencies;
- makes the experimental `client` and `experimental/plugin` coding-agent subpaths source-only;
- leaves the supported local SDK and stdio RPC API intact.

PlotPickle does not adopt those source-only experimental subpaths. The candidate probe explicitly scans the repository for them.

## Compatibility caution

The pinned PlotPickle extension stack must be evaluated as a stack, not package-by-package in isolation. In particular, `pi-subagents@0.35.1` has upstream Windows reports involving detached/background peer resolution. This issue does **not** silently upgrade `pi-subagents` or any other extension to work around a Pi candidate failure; doing that would turn a bounded Pi upgrade into a separate extension-stack migration.

Therefore the promotion rule is strict: Pi 0.85.1 is promoted only if the exact PlotPickle-pinned extension set installs and loads/registers successfully in the isolated Windows Product Gate probe. A failure leaves 0.84.4 authoritative and is evidence for a separate extension-stack decision rather than permission to weaken the gate.

## Candidate proof

`scripts/evaluate-pi-managed-upgrade.mjs` runs only as an isolated evaluation. It must:

1. create a temporary npm project rather than touching the managed Pi install;
2. install exact Pi `0.85.1` plus the exact extension specs already listed in `config/developer-agent-stack.json`;
3. verify the candidate CLI reports the exact version;
4. load the pinned extensions through Pi's supported `DefaultResourceLoader` / `SettingsManager` package-root SDK and reject loader errors;
5. verify the supported package-root SDK imports work;
6. launch Pi through `node <published-cli-entry> --mode rpc` with `shell: false`, send `get_state` over stdio JSONL, and require a successful response;
7. reject any PlotPickle import of the source-only `@earendil-works/pi-coding-agent/client` or `@earendil-works/pi-coding-agent/experimental/plugin` subpaths;
8. emit `.artifacts/pi-1709/evaluation.json` for CI evidence.

The probe does not call a paid model and does not require OpenAI credentials.

## GPT-6 Astra boundary

`gpt-6-astra` is optional capability metadata only for this evaluation. It is not a required PlotPickle provider, not a fallback, not a local-repair dependency, and not a reason to alter application provider routing. It may be used by Pi only when the Human already has an authorized OpenAI API-key or OpenAI Codex route and explicitly chooses it through Pi's supported provider/model surface.

No credentials are added, copied, inferred, or stored by this issue.

## Promotion phase

If the isolated Windows candidate proof passes, update the canonical pin and all authoritative metadata together:

- `scripts/pi-managed-install.mjs`;
- `config/developer-agent-stack.json`;
- `config/third-party-oss.json`;
- managed-install regression expectations;
- checked-in `.pi/npm/package-lock.json` Pi-family resolution metadata, regenerated rather than hand-edited;
- this evaluation contract from `candidate-probe` to `approved`.

Then rerun PR Gate, Product Gate, Pi managed-install/resolver coverage, Developer Workbench coverage, and the Full Verification Pi stages on the exact same head.

If the candidate proof does not pass, do not promote the pin and do not substitute an unreviewed extension upgrade in this issue.

## Non-goals

- no provider-routing redesign;
- no required paid/cloud model;
- no automatic GPT-6 Astra fallback;
- no adoption of Pi experimental/source-only APIs;
- no redesign of Developer Workbench, Pi resolver, local model routing, or Full Verification;
- no broad extension-stack upgrade hidden inside the Pi version change.

## Completion rule

The issue is complete only when the evidence supports one explicit outcome: either 0.85.1 is promoted with all authoritative pins aligned and both gates green on the exact head, or the evaluation records a bounded hold with reproducible evidence and leaves 0.84.4 authoritative. No ambiguous partial upgrade is allowed.
