---
name: PlotPickle Lazy Frames Animatic
description: Turn approved PlotPickle BUILD material into a reviewable local animatic through the host-owned Lazy Frames adapter while canonical story state remains authoritative and unchanged.
---

# PlotPickle Lazy Frames Animatic

Use this procedure when a writer wants to turn approved BUILD sequences into a motion preview or MP4.

## Authority boundary

This Skill describes the workflow only. It does not grant process execution, installation, provider choice, credentials, external services, project writes, or render approval. The PlotPickle host owns every adapter action and permission check.

Canonical project state remains the source of truth. The Lazy Frames composition and its provenance file are derived render artifacts and may be regenerated or discarded.

## Procedure

1. Confirm the writer has approved at least one BUILD sequence.
2. Inspect Lazy Frames readiness through the PlotPickle host adapter.
3. If the reviewed local tool is absent, explain that installation is optional and requires a visible user action.
4. Ask the host to prepare a derived animatic from approved source material. Do not invent missing images or fetch external assets.
5. Ask the host to establish the snapshot baseline and validate schema, environment and determinism gates.
6. Offer the local preview only after validation passes.
7. Treat preview as review evidence, not approval to render.
8. Request final MP4 rendering only after the writer explicitly chooses Render MP4.
9. Report render status and output location without changing story canon.

## First-pass visual rule

When an approved visual cannot be safely staged as a project-relative render asset, use the deterministic PlotPickle typography-card fallback. Preserve the approved visual reference in provenance so a later staging pass can replace the fallback without changing story decisions.

## Forbidden shortcuts

- Do not install Lazy Frames plugins or external providers automatically.
- Do not activate cloud services or paid generation as a fallback.
- Do not accept arbitrary shell commands or filesystem paths from the writer interface.
- Do not skip validation because a preview appears to work.
- Do not treat generated render files as canonical story data.
