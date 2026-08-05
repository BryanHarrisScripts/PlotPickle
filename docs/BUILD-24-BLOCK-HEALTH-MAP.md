# Build 24-Block health map

Issue: #351  
Parent programme: #336

## Purpose

The compact health map gives writers one glanceable view of the canonical 24-Block film structure before they enter detailed cards, filters or the Block inspector.

## Status contract

- **Green** — the Block is ready or locked.
- **Yellow** — the Block is developing.
- **Red** — the Block is empty or the canonical position is missing.

Colour is always paired with a symbol, text label and accessible name. The map never changes status thresholds independently from the existing Build model.

## Interaction

- The map always renders 24 canonical positions grouped into four acts of six Blocks.
- Choosing an existing Block clears temporary filters, switches to the detailed 24-Block view, selects that Block and moves keyboard focus to its detailed card.
- Missing positions remain visible but disabled.
- The map is a navigation and status surface only; editing remains in the existing inspector and full Block editor.

## Accessibility and responsive behaviour

- Every available tile is a native button with an accessible name and selected state.
- Tiles meet the 44-pixel touch-target expectation.
- Act boundaries remain explicit on narrow screens through horizontal scrolling rather than compressed unreadable cards.
- Reduced-motion and forced-colour preferences are respected.

## Recovery confirmation

Build arrangement recovery now uses the shared asynchronous PlotPickle confirmation dialog. Focus returns to the invoking control and the native synchronous confirmation inventory no longer lists `app/build-workspace.tsx`.
