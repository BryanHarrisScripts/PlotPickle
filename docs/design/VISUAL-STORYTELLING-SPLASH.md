# PlotPickle Visual Storytelling Foundation

Issue: #408

This document locks the public splash page as the first reference surface for PlotPickle's next visual direction. Later application-wide UI work should derive its tone from this foundation rather than independently inventing another theme.

## Narrative

Traditional storytelling has changed.

PlotPickle treats writing, visual exploration and creative direction as one connected practice. The writer or artist begins with narrative intent, shapes the world and characters, explores scenes visually, compares possibilities, directs revisions and explicitly approves what becomes canon.

The writer remains the author, visual director and final authority. AI provides responsive creative material; it does not provide authorship, automatic approval or silent changes to story canon.

Primary public line:

> Storytelling Has Changed.

Supporting line:

> Write the narrative. Shape the vision.

Director statement:

> The writer is no longer only writing the story — they are directing the storyworld.

## Visual language

The foundation is deliberately cinematic and restrained rather than conventional bright SaaS styling.

- Background: matte black and charcoal, not blue-black.
- Primary type: warm ivory.
- Secondary type: aged gray / warm stone.
- Accent: restrained amber / brass.
- Typography: typewriter-led monospace with generous editorial spacing.
- Surfaces: thin warm-gray borders, low-contrast charcoal panels and subtle depth.
- Imagery: screenplay, character, location/world and storyboard material shown together as one connected creative system.
- Motion: minimal; no essential meaning depends on animation.

## Foundation tokens

| Role | Value |
| --- | --- |
| Matte black | `#090909` |
| Soft black | `#0f0f0e` |
| Raised panel | `#181714` |
| Warm ivory | `#ece7dc` |
| Soft ivory | `#c8c0b2` |
| Muted text | `#8f887d` |
| Border | `#34302a` |
| Amber | `#b98745` |
| Bright amber | `#d3a15d` |

## Creative loop

`Concept -> Explore -> Compare -> Direct -> Refine -> Approve -> Reuse`

The interface should prefer creative language over provider language. Normal workflows should lead with actions such as Keep, Change, Try, Compare, Combine and Approve. Provider, model, endpoint and billing configuration belongs in Settings.

## Product pillars

1. Narrative First
2. World & Character Vision
3. Storyboard Thinking
4. Human-Led Creative Direction
5. From Concept to Visual Canon

## Canon and consent boundaries

- No generated result becomes canon automatically.
- No visual analysis changes story text automatically.
- No local failure silently enables paid cloud fallback.
- Manual import and no-AI workflows remain complete paths.
- Paid work requires explicit action-specific consent.
- PPF remains the portable creative source of truth.

## Approved visual reference

The approved concept image is stored in the repository at:

`docs/design/plotpickle-splash-direction-reference.svg`

The hero uses derived character, world and storyboard reference crops under `public/design/`. These are design-direction assets for this splash foundation and should not be treated as story canon for user projects.

## Application-wide follow-on

When the rest of PlotPickle is rebuilt around this direction, prefer shared tokens and common components derived from this foundation. Do not simply make every screen black. The goal is a coherent creative-director environment: editorial hierarchy, strong narrative context, restrained technical detail and visually connected story material.
