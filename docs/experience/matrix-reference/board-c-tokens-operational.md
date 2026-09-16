# Board C — Matrix Tokens & Operational Style Guide

Prompt ID: `matrix-board-c-tokens-operational-v1`  
Master prompt: `matrix-master-v1`  
Version: `1.0.0`

## Purpose

Generate one landscape PlotPickle Matrix reference board that explains **how the visual language scales through semantic token roles and operational UI examples**. This is a design-reference artifact, not a production screenshot.

Apply every invariant in the Matrix Master Generation Prompt, then emphasize:

- typography scale and hierarchy;
- spacing / density roles;
- z-index / overlay guidance;
- border treatment;
- panel treatment;
- semantic color-role usage;
- focus-indicator treatment;
- operational status semantics;
- compact loading, empty and error examples.

## Token-role presentation

Illustrate semantic roles that map back to the existing PlotPickle `--pp-skin-*` implementation system. Do not create a replacement token namespace.

Show roles such as:

- canvas / base background;
- primary and secondary surfaces;
- thin / strong line;
- primary / muted text;
- restrained accent;
- focus;
- success / available;
- warning / attention;
- error / blocked;
- disabled;
- compact / standard / spacious density.

Use labels and examples rather than depending on raw color values alone.

## Typography and geometry

Show a compact hierarchy for page title, section heading, body, metadata, shortcut label and status text. Geometry should remain square or near-square with thin borders and deliberate alignment.

## Operational examples

Include small examples of:

- loading while preserving layout;
- empty state with a next action;
- bounded error state;
- validation message;
- status indicator paired with text;
- focus treatment over both dark and slightly raised surfaces.

## Output boundary

The generated board is `candidate-reference` until Human approval. It may inform shared token/component work, but actual engineering values remain owned by the existing PlotPickle skin definitions and Experience Surface Contract. It must not become a production screenshot or locked baseline.
