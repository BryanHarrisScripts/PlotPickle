# Comfy MCP adapter decision

Issue: #1083

## Decision

**KEEP Comfy MCP as an optional local management/lifecycle adapter.**

**KEEP PlotPickle's existing direct ComfyUI API as the workflow-validation and media-execution authority for now.**

Do not rebuild PlotPickle image/video generation around Comfy MCP and do not give creative agents direct arbitrary MCP tool access.

## Why

The completed #1083 work already gives PlotPickle the useful parts of the Comfy MCP direction without adding a second creative authority:

- optional `comfy-mcp` + comfy-cli detection;
- owner-approved managed local ComfyUI startup when that stack is ready;
- direct local ComfyUI fallback when MCP is absent or incompatible;
- loopback-only ComfyUI connection diagnostics;
- checkpoint/model discovery through the existing ComfyUI API;
- required image-node checks;
- configured H3 workflow-node checks;
- normalized GPU name, total VRAM and free VRAM;
- plain-language Settings visibility for management, service and GPU readiness;
- existing PlotPickle media routing, consent, artifact and provenance boundaries remain unchanged.

PlotPickle already validates the local workflow frontier through its direct ComfyUI API. Moving workflow execution to MCP now would add protocol/tool authority without solving a current product gap. The direct path is already exercised by PlotPickle's ComfyUI and Hardware-Aware Local AI regressions.

Comfy MCP therefore remains a **replaceable management helper**, not a required media runtime.

## Authority chain

The supported authority remains:

`Sage / Marquee / Visual Writer / BUILD`
→ request a PlotPickle capability
→ `PlotPickle media / AI router`
→ PlotPickle enforces provider choice, local/cloud choice and consent
→ local ComfyUI adapter
→ optional Comfy MCP/comfy-cli management for local lifecycle
→ direct ComfyUI API for readiness, workflow checks and generation

Creative agents do not receive direct `tools/call`, `run_workflow`, model-download or node-install authority.

## Custom nodes and model installation

#1083 deliberately does **not** add generic Comfy MCP custom-node installation or arbitrary model-download tools.

If PlotPickle later adds a custom-node install path, it must be a new host-owned capability with all of the following before execution:

1. identify the exact missing node pack and source;
2. explain that third-party code/dependencies will be installed on the user's computer;
3. require explicit user confirmation for that exact installation;
4. never treat generation permission as install permission;
5. preserve source/provenance where available;
6. re-check readiness after installation;
7. never switch to a paid cloud provider silently if installation fails.

Until that explicit capability exists, the safe behavior is to report the missing node and leave installation to the user.

## Data minimization

The host may expose normalized facts such as:

- local ComfyUI ready / running / stopped;
- management helper available / unavailable;
- GPU name;
- total/free VRAM;
- checkpoint count;
- missing required node names;
- configured workflow-node readiness.

Do not place raw ComfyUI system payloads into ordinary agent context. In particular, avoid raw Python launch command/argv, credentials, environment values, unrelated local paths or process details.

## Failure and fallback

- Comfy MCP absent: direct local ComfyUI support continues.
- MCP detected but comfy-cli incompatible: direct local support continues and Settings explains the mismatch.
- managed startup fails: existing Desktop/direct startup fallback remains available.
- local ComfyUI not ready: PlotPickle reports the local problem; it does not silently promote the request to a paid provider.
- external/cloud generation remains an explicit user-selected route with its existing consent boundaries.

## Acceptance mapping

#1083 is considered complete when the following remain green together:

- optional/replaceable Comfy MCP management detection;
- existing direct ComfyUI generation path preserved;
- lifecycle/startup remains owner-approved;
- hardware facts are bounded and sanitized;
- checkpoint/model, required-node and configured-workflow readiness remain observable;
- Settings presents useful readiness rather than only a generic port failure;
- no arbitrary MCP workflow execution or custom-node install authority is granted;
- no silent paid-provider fallback;
- BEN, Hardware-Aware Local AI, focused ComfyUI validation and production build remain green.

## Revisit trigger

Re-evaluate a direct MCP workflow-execution bridge only if one of these becomes true:

- Comfy MCP exposes a stable capability PlotPickle cannot safely obtain through the direct local API;
- the direct workflow path becomes materially less reliable than the MCP path;
- PlotPickle Nodes need a standard remote management interface and MCP proves safer than the existing adapter boundary;
- custom-node/model readiness can be improved without granting broad install/execution authority.

Any such change should be a new issue/PR with its own authority, privacy, consent and regression contract rather than silently expanding #1083.