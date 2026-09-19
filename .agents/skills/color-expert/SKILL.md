---
name: color-expert
description: Analyze PlotPickle color systems using perceptual color science, semantic design-token roles, contrast, gamut, palette separation, and accessible state relationships without becoming a palette or visual authority.
license: AGPL-3.0-or-later
metadata:
  author: PlotPickle
  version: "1.0.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/color-expert
  progressiveDisclosure: true
---

# Color Expert

Use this Skill when a PlotPickle task materially depends on color choice, color-system relationships, perceptual palette quality, contrast, gamut, color naming, or explaining a Visual Director palette finding.

This Skill is advisory. It does not replace Skin V1 tokens, Visual Director, Visual QA, Human approval, or any canonical product authority.

## Procedure

1. Read only the bounded color request and host-supplied evidence.
2. Identify the existing PlotPickle semantic role first:
   - canvas / surface;
   - on-surface text;
   - outer / inset frame;
   - accent;
   - selected / hover / focus;
   - success / warning / danger;
   - disabled;
   - premium / emphasis.
3. Prefer the existing Skin V1 semantic token when one already expresses the intended role.
4. When comparing or deriving colors, reason in perceptual spaces:
   - use OKLAB / OKLCH for perceptual distance, ramps, hue/lightness/chroma relationships, and derived UI states;
   - use sRGB/linear-sRGB when the task concerns emitted-light compositing, alpha, device values, or exact browser output;
   - use CIELAB only where an existing print/profile workflow requires it.
5. Check target-gamut risk before recommending a high-chroma OKLCH color. Preserve lightness and hue when reducing chroma for gamut fit.
6. Evaluate contrast for the actual foreground/background role. PlotPickle's current product requirement remains WCAG 2.2 AA; APCA may be reported as supplemental evidence, never as permission to weaken the current requirement.
7. Check whether state colors remain distinguishable by more than color alone. Selection, warning, success, focus, disabled, and premium meaning must also have structural/text/state semantics.
8. Check palette quality:
   - perceptual step consistency;
   - lightness/chroma separation;
   - near-duplicate colors;
   - selected/hover/focus separation;
   - gamut clipping;
   - grayscale or low-chroma collapse when relevant.
9. Explain the result as an actionable recommendation tied to existing PlotPickle tokens or semantic roles.
10. Return analysis to the host. Do not mutate CSS, token files, PPF, baselines, or repository state.

## Semantic token rule

Use the design-system chain:

reference color -> semantic role -> component usage

Do not recommend local raw color literals when an existing semantic token can express the state.

If a new semantic role is genuinely required, describe the missing role and evidence. The Human and Skin V1 authority decide whether that role is added.

## Perceptual guidance

### OKLAB / OKLCH

Prefer OKLAB / OKLCH for:
- comparing perceived distance;
- checking whether two greens are functionally redundant;
- building or evaluating ramps;
- deriving hover/selected variants;
- preserving perceived lightness relationships across hues.

Do not assume equal HSL lightness means equal perceived brightness.

### Gamut

A numerically valid OKLCH color may be outside sRGB or another target gamut. Avoid naive RGB clipping when evaluating a proposed palette because it can shift hue and compress relationships.

### Near-duplicates

Two colors that differ in hex values can still be perceptually redundant. Report the role collision rather than treating numeric difference as sufficient evidence of distinction.

## Accessibility

For interface use:
- verify text/background contrast against the actual semantic roles;
- keep focus and selection visible;
- never rely on hue alone for state;
- preserve readable status text on dark Skin V1 surfaces;
- treat APCA as optional additional evidence while WCAG 2.2 AA remains the current product acceptance requirement.

## Visual Director handoff

When Visual Director reports an off-palette rendered value, Color Expert may explain:
- the nearest existing semantic role;
- whether the local value is perceptually redundant;
- contrast impact;
- likely gamut or lightness/chroma problems;
- whether a derived state from an existing token would preserve hierarchy better.

Color Expert does not change the Visual Director verdict and does not approve visual baselines.

## Visual Contract handoff

When Visual Contract needs palette constraints for generated imagery or UI-adjacent visual work, Color Expert may provide:
- perceptual relationships;
- contrast constraints;
- bounded color-role vocabulary;
- gamut considerations;
- palette-separation checks.

It does not choose the image provider or accept generated output.

## Trigger examples

Use this Skill for prompts such as:
- "Does this green ramp have perceptually even steps?"
- "Which Skin V1 role should replace this off-palette green?"
- "Are hover and selected states sufficiently distinct?"
- "Check the contrast between this text and panel."
- "Why do these two hex colors look almost identical?"
- "Will this OKLCH accent clip in sRGB?"

Do not invoke this Skill merely because a screen has:
- geometry overlap;
- column/grid drift;
- typography-only drift;
- story/canon problems;
- provider/model routing problems;
- repository architecture changes unrelated to color.

## Authority boundary

This Skill cannot:
- create or replace the Skin V1 palette authority;
- create a second color registry or Color Gate;
- mutate CSS or token files;
- approve visual baselines;
- change Visual Director or Visual QA verdict ownership;
- write PPF/canon;
- select providers;
- read credentials;
- grant network access;
- edit code or GitHub state.

The host owns all capabilities and side effects. Human approval remains final.
