# Issue #119 — Production reports

The Production area is a nested workspace inside Reports. It derives shoot-planning intelligence from the canonical screenplay, scene, character, location, storyboard, breakdown, shot, cue and schedule records.

## Persistent sections

- Overview
- Locations
- Shot Types
- Shoot Groups
- Actor Schedule
- Shooting Timeline
- Production Requirements
- AI Systems

All estimates and recommendations are visibly labelled as planning guidance. They do not replace producer, department-head, cast, location, safety, legal or accessibility review.

## Canonical planning state

The optional `project.production.reporting` record stores location logistics, actor availability, shoot-group decisions and timeline assumptions. Normalization supplies safe defaults for older `.ppf` files without changing schema compatibility.

Shoot-group proposals are derived deterministically from shared location and story time, then explain any shared cast, wardrobe, props, vehicles, stunts or effects. A producer can accept, reject, reset or adjust the included scenes. Those decisions are saved in the canonical project rather than a report-only cache.

## Derived reports

- Location rows combine story locations with real-location planning, scene headings, cast, breakdown requirements, schedule availability and shoot-time estimates.
- Shot Types classifies canonical Shot Designer and storyboard text against the complete requested camera and effects taxonomy.
- Actor Schedule joins characters, scenes, production days, locations, wardrobe, makeup, rehearsal, calls, wraps, daily sides and saved availability conflicts.
- Shooting Timeline calculates optimistic, realistic and contingency scenarios from pages, scenes, coverage, locations, moves, cast load, nights, stunts, effects, vehicles and makeup.
- Production Requirements consolidates seventeen departments or risk categories and keeps unpopulated categories visible as review gaps.

## Maintainable AI review

`data/production-ai-systems.json` contains three dated options for video generation, image generation and multi-model aggregation. Every entry stores source links, cost model, API/plugin state, local/cloud state, licensing/privacy notes and recommended PlotPickle use.

The file is editorial data rather than a permanent code ranking. Updating or replacing an option requires a data review, not a component rewrite. Credentials and private tokens are never stored in the catalog or shown in Reports.

## Windows runtime dependency repair

The Windows setup report already verifies `drizzle-kit`, and the lockfile already pins version `0.31.10`, but the package manifest omitted it. That mismatch allowed a reusable runtime without Drizzle build tooling to pass the launcher’s narrower readiness check and fail immediately before server startup.

The manifest now declares the locked version, runtime readiness includes `drizzle-kit`, and the dependency fingerprint covers both `package.json` and `package-lock.json`. A manifest-only dependency correction therefore creates or repairs the appropriate persistent runtime instead of reusing an incomplete one.
