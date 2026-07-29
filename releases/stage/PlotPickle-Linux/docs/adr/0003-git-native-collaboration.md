# ADR-0003: Git-native collaboration

Status: Accepted

## Context

PlotPickle should not reinvent branching, history, review and owner-controlled merging.

## Decision

Git provides optional local revision history and GitHub provides optional remote proposals and pull requests. PlotPickle presents these concepts in storytelling language without changing Git semantics.

## Consequences

Most independent edits merge naturally because components live in separate files. PlotPickle focuses its custom conflict UI and AI assistance on true same-component conflicts. Users without Git continue to work locally.
