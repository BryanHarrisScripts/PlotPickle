# Developer Brief — #2778 OpenPencil optional design tool

## Objective

Add OpenPencil to PlotPickle as an optional programmable UX design workspace with zero normal-startup dependency and a bounded first proof for Timeline.

## Upstream baseline reviewed

Repository: https://github.com/open-pencil/open-pencil

Observed on October 5, 2026:

- MIT licence.
- Windows 10+ support.
- headless CLI with JSON output.
- read/write .fig and .pen support.
- local MCP server.
- 100+ design tools.
- design lint/token/layout analysis.
- JSX/Tailwind and Storybook export.
- explicit Pi and Codex integration.
- OPENPENCIL_MCP_ROOT file scoping.
- active development with upstream-described rough edges.
- latest observed release: v0.15.1.

## Phase 1

1. Register OpenPencil in config/third-party-oss.json.
2. Add config/openpencil-adapter.json.
3. Add docs/architecture/OPENPENCIL-DESIGN-BRIDGE.md.
4. Add focused regression coverage.
5. Do not add runtime npm dependencies.
6. Do not auto-install or auto-launch OpenPencil.

## Timeline proof

The first design exercise should reorganize Timeline around the selected Shot rather than infrastructure panels.

Primary flow:

script → shot intent → approved first frame → motion direction → Generate Motion → review → Keep/Redo → next Shot

The 25-Shot filmstrip remains visible and communicates state. Provider and job diagnostics are secondary.

## Acceptance

- Registry entry is MIT/connect-only/user-managed.
- Adapter explicitly disables auto-install and startup launch.
- Adapter requires OPENPENCIL_MCP_ROOT for write scope.
- Source mutation and merge authority are false.
- package.json has no @open-pencil runtime/dev dependency.
- Architecture note names DSDD, WebMCP and Timeline proof.
- Focused test passes.
