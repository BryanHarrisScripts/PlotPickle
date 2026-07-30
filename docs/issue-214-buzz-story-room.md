# Issue #214 — Buzz Story Room and managed runtime

## Locked scope

This phase contains only Buzz:

- Phase 1 — project Story Rooms and local human-reviewed proposals;
- Phase 1A — existing relay connection, encrypted identity and reachability testing;
- Phase 1B — pinned managed local Docker runtime with lifecycle, backup and removal controls.

No Modem, Graphic Novel editing, ComfyUI, image generation or unrelated connection work is included.

## Authority chain

Buzz discussion → PlotPickle proposal → human approval or rejection → PPF update.

Buzz never writes canon automatically. The proposal records the source room, source message or excerpt, story target, field path, old and proposed values, rationale, decision and audit history.

## Existing relay

Settings saves the minimum connection details through the local-only Buzz gateway. Identity material is stored through PlotPickle's operating-system user credential protection and remains outside PPF, exports, logs and GitHub.

PlotPickle tests relay reachability and Buzz CLI availability before enabling signed room and message operations. Disconnected, degraded and ready states remain explicit.

## Managed runtime

The managed runtime is a pinned Docker Compose deployment derived from Buzz v0.4.26. The committed manifest records the source tag, source revision, image, files, checksums and Apache 2.0 licence boundary.

Install remains unavailable unless:

- the manifest validates;
- every bundled file matches its SHA-256 checksum;
- Docker Engine and Docker Compose are available; and
- the clean-machine validation workflow has passed.

The runtime binds its relay to `127.0.0.1` by default. Install does not start the runtime. Start, stop, restart, repair, pinned update, backup and complete removal are explicit actions.

## Dormant rule

An unconfigured PlotPickle installation creates no Buzz process, port, identity, credential, room, database, media store, container, volume or worktree.

## Validation gate

The focused Issue #214 regression suite is imported by the existing managed-Buzz test entry, so the standard repository test command executes it automatically. The authoritative merge gate remains the full CI, release packaging and packaged Windows interaction smoke matrix.
