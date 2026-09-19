# #2260 — JetBrains Mono canonical PlotPickle UI typography

## Decision

PlotPickle self-hosts the official JetBrains Mono v2.304 webfont as its canonical operational/UI monospace. The font is consumed through the existing Skin typography contract rather than per-surface declarations.

## Boundaries

- `--pp-skin-font-ui` owns governed Skin typography.
- `--pp-skin-font-brand` now resolves to the same JetBrains Mono family by Human decision in #2272; product-brand hierarchy is expressed through size/weight/tracking rather than a second font family.
- compatibility `--font-geist-*` aliases resolve to the same JetBrains-first fallback stack so legacy governed CSS cannot reintroduce Courier as the rendered primary face.
- creative/export document typography is unchanged.
- UI ligatures are disabled by default for literal shortcuts, story addresses, logs and diagnostic text.

## Distribution and provenance

- upstream: https://github.com/JetBrains/JetBrainsMono
- tag: `v2.304`
- revision: `cd5227bd1f61dff3bbd6c814ceaf7ffd95e947d9`
- licence: SIL Open Font License 1.1
- bundled format: WOFF2
- no CDN or operating-system installation requirement
- exact byte sizes and SHA-256 digests live in `public/fonts/jetbrains-mono/manifest.json`

Only Regular 400, SemiBold 600 and Bold 700 are bundled for the current PlotPickle UI contract.

## Verification

Focused #2260 tests verify the canonical token, self-hosted paths, byte hashes, OFL notice, OSS registry record, ownership mapping and absence of remote font hosts. Existing Architecture Verification / WebMCP / Visual Director remain the governing product gates; no new typography verifier is introduced.

Locked visual baselines remain Human-controlled. The brand-font decision remains deferred until the Human sees the canonical UI font in the product.
