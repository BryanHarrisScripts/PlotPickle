# ADR-0002: PPF is a portable package

Status: Accepted

## Context

Users need a simple file for backup, email, templates and selective handoff, but a single opaque working file conflicts with Git-native collaboration.

## Decision

`.ppf` means PlotPickle Portable Format: a ZIP-compatible package containing a complete project or a declared component profile.

## Consequences

A `.ppf` may carry only dialogue, characters, production, pitch or another supported profile. Imports merge by stable component ID and require review before replacing approved Canon. Package security and checksum validation are mandatory.
