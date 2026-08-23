# Issue #444 — Phase B Learn wireframe

Approved direction: the Learn module uses the same full-screen PlotPickle Studio shell established in Phase A.

## Visual contract
- matte-black desktop canvas with warm-gold accents
- thin persistent PlotPickle Studio shell from Phase A
- fixed left Learn rail for learning views and collections
- large editorial/typewriter hero rather than a generic settings-like page
- story position and course progress remain visible but secondary
- learning paths and lesson cards use dark cinematic panels
- no teal/blue/white legacy application canvas

## Workflow contract
- Learn remains optional and never blocks the story workflow
- existing course content, progress, search, Block/mini-block context and direct lesson-to-workspace routing remain intact
- learning is attached to the same active PPF project and 24 Block / 96 mini-block architecture
- technical provider/model configuration remains outside Learn

## Merge gate
The implementation PR must pass CI and the real rendered desktop Learn capture must be visually compared with the approved wireframe before merge.
