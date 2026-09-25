# Developer Brief — MindMap Act-Scoped Workspace

Issue: #2448

The Human-approved MindMap workflow is one Act at a time.

## Visible identity

The top active-surface header is exactly **MINDMAP**.

## Act rail

Render one persistent Act rail:
- Act 1
- Act 2
- Act 3
- Act 4

Act 1 is the entry default. One Act is active at a time. The selected Act owns the composer, visible Inbox, agent development action and Story Shape.

## Act-scoped Inbox

Extend unpinned local MindMap cards with optional `inboxAct`.

New Written Idea cards store the selected Act immediately.

Legacy cards without `inboxAct` remain visible under Act 1. Do not delete or rewrite legacy cards simply to migrate them.

The Inbox displays only cards for the active Act.

When a Human pins an Inbox card:
- its Act is fixed to `inboxAct ?? 1`
- Discovery Mapper is asked to classify the lane for that Act
- a mapper result for another Act is rejected
- the accepted placement uses that fixed Act and the returned governed lane

## Develop selected Act

Keep Creative Director behavior from #2442 but expose one action:

`Develop Act {selectedAct} Mind Map`

It still generates one non-canon proposal for each of the six lanes and replaces only prior Creative Director proposals for that same Act.

## Story Shape

Do not change the underlying 4×6 governed structure.

Render only the active Act's six lanes in a two-column workspace:
1. Story / Plot | Character
2. Scene / Dialogue | World / Research
3. Theme / Motif | Visual / Mood

Each lane is a large panel. Cards stack vertically inside it. At narrow widths the workspace becomes one column.

## Preserve

Keep:
- six lane IDs and order
- four Act values
- Written Idea only
- project-derived Story / Plot cards
- current Creative Director provenance/non-canon boundary
- current Library persistence
- WorldMap/Outline/Storyboard behavior

## Verification

Before PR:
- focused #2448 contract test
- update #2442 MindMap regression where vocabulary/layout intentionally changes
- inspect exact branch diff
- verify no 4-Act board matrix remains
- verify no four Develop buttons remain
- verify Act-scoped Inbox and mapper Act guard
- verify two-column CSS and one-column responsive fallback

Open the PR after focused verification, then stop for Human review against this brief before continuing CI/merge.
