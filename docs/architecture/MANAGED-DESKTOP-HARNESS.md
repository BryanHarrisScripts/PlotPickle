# Managed PlotPickle Desktop / Node Harness

Issue: #1079

PlotPickle Desktop remains the product authority. The managed harness sits below LEARN, PLAN, BUILD, PPF, BUZZ, Agent Profiles, provider routing, provenance and #1071 identity/Node contracts.

## Architecture

PlotPickle Desktop Shell
→ PlotPickle Runtime Supervisor
→ manifest-driven managed components
→ PlotPickle app runtime / BUZZ bridge / local AI adapters / ComfyUI / future PlotPickle Node service

The runtime supervisor owns lifecycle truth. Individual startup scripts and Settings panels must consume this authority rather than inventing separate process state.

## Runtime manifest

`config/runtime-manifest.json` is the initial pinned component contract. Production policy forbids silent PATH fallback, requires explicit developer overrides, defaults local listeners to loopback, hides managed helper consoles and preserves projects/PPF/identity state across lifecycle changes.

Each component declares its stable ID, version, launch strategy, platform scope, stage location, probes, dependencies, startup timeout, shutdown behavior, restart policy, capabilities, update policy, source/license information and developer-override policy.

## Truthful readiness

Process state and capability readiness are deliberately separate. A running ComfyUI process is not `ready` until both its health probe and model/workflow readiness pass. Settings should project readable states such as not installed, starting, running, ready, degraded, failed, stopped, update available and incompatible.

## Windows-first lifecycle

The Windows target is one PlotPickle launch with managed helpers started without normal-user console windows. Restart is bounded; shutdown must target the managed process tree; stale/orphan processes must not become the next launch's hidden authority. Launcher paths remain application/package-relative and cannot silently escape to an arbitrary local executable.

## Graceful Node shutdown

The top-left PlotPickle crest is the user-facing Node control. It requests lifecycle actions from the runtime supervisor; it does not directly kill arbitrary processes.

A normal `Shut Down PlotPickle` sequence must preserve known creative state, release the active Human/session boundary, stop PlotPickle-owned managed services and child processes, terminate the PlotPickle launcher/CMD runtime, and close only the PlotPickle-owned browser window. A failed save or required cleanup blocks successful shutdown rather than silently discarding work.

The complete UX, save, browser-ownership, privacy and acceptance contract is defined in `docs/architecture/NODE-CONTROL-GRACEFUL-SHUTDOWN.md`.

## Tauri decision

Tauri 2 remains a candidate desktop shell, not a dependency or product authority in this phase. The existing vinext/Vite application contract stays above the shell. A later Windows packaging spike may adopt Tauri only if it proves a material benefit for hidden sidecar lifecycle, secure local storage, installer/update behavior and clean shutdown without weakening macOS/Linux direction.

Until that proof exists, the runtime supervisor contract is shell-neutral so the current packaged launcher or a future Tauri shell can consume the same manifest and lifecycle API.

## ACP decision

ACP remains an evaluation candidate for agent transport, not an automatic Mastra replacement. PlotPickle permissions, bounded context, PPF approval/canon rules and provider routing remain host-owned. A later prototype should compare ACP against the current local agent boundary for transport-code reduction and missing PlotPickle permission concepts. No Goose or BERD dependency is introduced by this architecture.

## BERD reuse boundary

BERD is used only as an architectural reference for managed sidecars, pinned runtime dependencies, lifecycle checks and validation patterns. No BERD/Goose product authority or Block branding is introduced. Any future source-code reuse requires file-level Apache-2.0 notice review before copying.

## #1071 Node relationship

The future `plotpickle-node-service` is already represented as a disabled managed component. Joining BUZZ does not enable it. Compute sharing remains explicit opt-in under #1075, Node keys remain local, and stopping Node sharing must remove truthful availability without exposing the machine as public compute.
