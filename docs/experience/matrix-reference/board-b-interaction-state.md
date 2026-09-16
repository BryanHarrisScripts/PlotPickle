# Board B — Matrix Interaction & State Guide

Prompt ID: `matrix-board-b-interaction-state-v1`  
Master prompt: `matrix-master-v1`  
Version: `1.0.0`

## Purpose

Generate one landscape PlotPickle Matrix reference board that explains **how Matrix components behave across interaction and operational states**. This is a design-reference artifact, not a production screenshot.

Apply every invariant in the Matrix Master Generation Prompt, then show a controlled state matrix for representative controls, rows, panels and messages.

## Required states

Show clearly distinguishable examples of:

- default;
- hover;
- selected;
- keyboard focused;
- disabled;
- empty;
- loading / async;
- error;
- validation;
- scrollbar / overflow behaviour;
- constrained-width / responsive behaviour.

Focus must not be confused with selected state. Color must not be the only state signal. Disabled controls must remain readable. Loading must preserve structural context. Errors should be explicit but bounded.

## Interaction examples

Include at least one compact keyboard-first list or menu demonstrating:

- shortcut label;
- focus ring / focus boundary;
- selected state;
- return/back control;
- async or loading state without layout collapse.

Also show a small overflow example where content can scroll without hiding the active selection or focus indicator.

## Visual intent

Use the same black / white / restrained Matrix-green language as Board A. Keep geometry square, spacing disciplined and annotations concise. Use semantic state labels rather than decorative color swatches alone.

## Output boundary

The generated board is `candidate-reference` until Human approval. It may guide the later Experience Surface Contract and WebMCP expectations, but it must not become a production screenshot, locked baseline or automatic approval oracle.
