# ADR-0001: Folder-first canonical projects

Status: Accepted

## Context

A monolithic project file creates broad Git conflicts, hides component boundaries and makes third-party tooling difficult.

## Decision

The canonical working project is an open directory of human-readable, module-owned files with `manifest.json` as its table of contents.

## Consequences

Characters, scenes, blocks and production work can be reviewed and merged independently. Local-only use remains possible. PlotPickle must provide safe folder operations, validation and migration from legacy monolithic projects.
