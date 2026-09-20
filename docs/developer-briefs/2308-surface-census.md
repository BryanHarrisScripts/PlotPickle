# Issue #2308 — F12 Surface Census

## Purpose

Add a seventh F12/WebMCP choice that answers a question the existing green suite cannot answer: whether every user-visible PlotPickle surface is actually represented by the governed WebMCP catalogue.

Profile 6 is Surface Census. Full QA moves to Profile 7 and runs Profiles 1 through 6 in order.

## Evidence model

Surface Census reconciles three independent sources:

1. the rendered Dashboard navigation visible to the user;
2. the canonical Skin V1 Surface Registry, currently 77 declarations;
3. the governed WebMCP Standard catalogue, currently 30 surfaces.

This is intentionally not another visual-quality detector. Standard and Visual Director remain the visual-governance authority.

## Coverage semantics

The report keeps two percentages separate.

Reconciliation coverage answers whether every discovered surface has an explicit classification.

Governance coverage answers how many safely reachable, governance-applicable surfaces are in WebMCP.

Public exceptions remain classified but are not counted as missing Matrix governance. State-only surfaces without a safe deterministic route are named as skipped/state-only rather than silently omitted.

## Safety

The census uses GET navigation and safe rendered controls only. It does not send messages, delete or mutate story data, trigger paid AI generation, or call external providers.

Live Dashboard destinations outside the canonical registry are never activated unless they are already explicitly classified as census-only. This permits diagnostic inspection of the known Pitch Package gap while leaving Logout, Shutdown and unwired destinations untouched.

## Before snapshot

Baseline run: webmcp-full-qa-2026-09-20T23-26-26-325Z-6ff25def at main@60941714751b23faf7ff8917b59b94c2d97322b8.

The baseline is fully green for its governed 30-surface catalogue. It is not a completeness baseline. The rendered Dashboard exposes pitch-package while neither the 30-surface WebMCP catalogue nor the 77-surface canonical Surface Registry declares that surface.

## Non-goals

Do not repair Skin 1 versus Matrix naming, replace the legacy Pitch implementation, or optimize Storyboard/Previs loading latency in this issue. The census records evidence for those follow-up fixes.
