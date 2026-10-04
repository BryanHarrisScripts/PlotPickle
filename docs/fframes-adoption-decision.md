# FFrames Phase 4 adoption decision — #2666

## Decision

**Keep FFrames as an optional local adapter.** Do not make it PlotPickle's default engine, bundle it, fork it, or make startup depend on it in this phase.

## Evidence and rationale

- PlotPickle now owns the stable `PlotPickleMediaEngine` boundary. Previs, Timeline/Rough Cut, and Screening consume normalized PlotPickle contracts rather than FFrames-native objects.
- The adapter is pinned to FFrames 1.2.0 and runs through a small Rust bridge. This preserves a clear pin/fork/replace/remove exit path.
- Windows feasibility has extra native prerequisites: Rust/Cargo plus the FFrames/FFmpeg/LLVM/libclang environment. That install burden is inappropriate for a zero-config default today.
- Rendering is bounded by PlotPickle timeout/cancellation and temporary-workspace cleanup. FFrames absence or failure degrades to existing PlotPickle paths rather than blocking startup.
- Source hashes/refs and normalized diagnostics make rendered/inspection artifacts traceable. Stale evidence is rejected when approved upstream source identity changes.
- FFrames provides useful render/inspection primitives, but its upstream/API and native dependency surface should be observed longer before any default-engine decision.

## Operational hardening

Cancellation, timeout, cleanup, bounded diagnostics, source hashing, capability detection, stale-evidence rejection, and fallback behavior remain PlotPickle responsibilities around the adapter. Screening is read-only with respect to renderer evidence: inspection cannot promote itself into PPF/canon or replace Human approval.

## Distribution boundary

No FFrames, FFmpeg, codec, LLVM, or other native binary is bundled by this issue. Any installer/binary distribution proposal requires a separate dependency/license/distribution review and explicit approval.

## Revisit criteria

Reconsider default status only after repeatable Windows setup, measured local render performance on representative Mini-Blocks/Rough Cuts, upstream API stability, dependency footprint, and maintenance cost are documented across multiple releases.
