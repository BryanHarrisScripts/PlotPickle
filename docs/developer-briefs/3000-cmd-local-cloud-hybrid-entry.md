# #3000 — Command entry to identical Local, Cloud and Hybrid Settings connection GUI

## Human intent

On October 15, 2026, the Human requested: “create CMD to connect LOCAL and CLOUD identical to the GUI / include HYBRID.”

This is **Phase 1: exact GUI entry parity**, not a new provider setup or a second routing stack. Typed Command opens the same Settings mode component that its Local, Cloud and Hybrid menu entries open, so all actual credentials, provider tests, capability Join logic and readiness come from the existing GUI/runtime owners.

## Implemented bounded behavior

- `PlotPickle connections` prints available CMD connection commands and warns never to paste API keys into Command.
- `PlotPickle connect local` and alias `PlotPickle connections local` open the **same Local** settings screen as the dashboard.
- `PlotPickle connect cloud` and alias `PlotPickle connections cloud` open the **same Cloud** settings screen as the dashboard.
- `PlotPickle connect hybrid` and alias `PlotPickle connections hybrid` open the **same Hybrid/Connections** settings screen.
- Command surface has equivalent Local / Cloud / Hybrid connection buttons.
- The parser is deterministic; invalid/credential-bearing command text is not dispatched to a connection API. Navigation itself makes no model request, spends no credits, does not mutate selected routes, keys, PPF or canon.
- A single app event `plotpickle:open-story-mode` is handled only by the existing dashboard Settings host and accepts the strict `local|cloud|hybrid` modes; it mounts `<StoryModeHost initialView={storyModeView} />`.
- Existing authenticated provider settings, `/api/ai-routing/status` and `/api/ai-routing/join` still own true readiness, configured/tested state, Join eligibility and activation.

## Explicit non-goals in this slice

This first slice **does not** provide individual typed CMD commands to enter a provider API key, execute capability tests, preview/confirm a Join, or change writing/video routes without visiting the GUI. Phase 2 under issue #3000 can add those operations using the exact established authenticated endpoints, explicit confirmation and secret-safe input. Do not claim complete typed-interface parity until those operations have been implemented and verified.

## Acceptance

A1. Typed and button entry all reach the same Local/Cloud/Hybrid GUI owner; unsupported mode cannot navigate or mutate.
A2. Secure provider credentials never enter the CMD transcript; no silent route selection, model request or paid spend from navigation.
A3. Existing GUI behavior remains unaffected and retains independent capability readiness.
A4. W8/W9 approved truth binding, focused parser/dispatch regression, CMD UAT, build and exact-head Windows/Architecture gates.
A5. Human Windows GUI navigation proof remains outstanding until observed in an actual account.

## Dependency and sequencing

Built from current main after #2999 / PR #3001 merge. Issue #2999 is independent and complete as a code merge, although the live Brotherly Love candidate remains under Human product acceptance. #3000 retains subsequent richer CMD capability/status/Join work.