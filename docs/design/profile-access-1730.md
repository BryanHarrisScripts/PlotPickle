# Issue #1730 — Profile access visual direction

The profile/login boundary uses a scoped extension of the canonical PlotPickle token system. It combines the two supplied references without copying either layout literally.

## Visual roles

- Paper working surface: TornPaper, Mystic, Casper, Jungle Mist and Juniper provide the form/card hierarchy.
- Archive HUD frame: a deep near-black green canvas, restrained telemetry border, soft glow and subtle scanline texture frame the secure boundary without competing with credential entry.
- Operational accent: green is used for ready/focus telemetry, not as a replacement for PlotPickle progression/status semantics elsewhere in the app.

## Typography roles

- `--pp-font-interface`: system UI stack for normal profile copy and form controls.
- `--pp-font-code`: existing PlotPickle mono role for compact labels, node/vault telemetry and status language.
- `--pp-font-lore`: Cinzel when available with Georgia/Times fallbacks for the main profile heading only.

## Authority boundary

This issue changes presentation only. Authentication, profile enumeration rules, encrypted storage, CSRF handling, session behavior, recovery-secret handling, Guest isolation and server-network readiness remain owned by the existing profile access implementation.

The profile-specific colours and typography roles live in `app/design-tokens.css`; the CSS module consumes those semantic variables and contains no page-local HEX/RGB/HSL palette values.
