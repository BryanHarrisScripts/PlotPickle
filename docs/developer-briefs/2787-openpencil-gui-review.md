# Developer Brief — #2787 OpenPencil explicit GUI design review

## Human outcome

Keep PlotPickle Command as the deterministic start of an OpenPencil design session, but move the actual design work into the OpenPencil GUI.

The Human must explicitly name the PlotPickle surface. Context-aware/current-route inference is out of scope.

Canonical workflow:

```text
PlotPickle Command
→ OpenPencil open Timeline
→ OpenPencil GUI opens Timeline design
→ visually inspect / edit / save
→ return to PlotPickle
→ OpenPencil review Timeline
→ 01 Interpret
→ 02 Pi Draft
→ 03 Publish Brief
→ GitHub issue
```

The OpenPencil handoff ends at a GitHub issue. It does not create an implementation PR. Implementation is a later, separate PlotPickle development cycle.

## Stable named surfaces

`designs/openpencil/surfaces.json` owns the explicit command names and their design file/page targets. It covers the current PlotPickle surface taxonomy and preserves multi-word names such as Mind Map, World Map and Rough Cut.

No command is allowed to infer the target from the current PlotPickle page.

## GUI boundary

The reviewed OpenPencil 0.15.1 integration has three separate capabilities:

- `@open-pencil/mcp` — scoped automation bridge;
- `@open-pencil/cli` — deterministic running-app document/page control;
- OpenPencil Desktop — visual editor.

All are prepared after PlotPickle core readiness and are non-blocking. Startup never launches the MCP server or GUI.

On Windows, the optional desktop GUI uses the pinned upstream 0.15.1 x64 installer with SHA-256:

`5e06bc1b58afc80e16c7a5828fced68c3b3aa656b32c20f4fe9c651feab6f5f9`

The GUI launches only after an explicit `OpenPencil open <surface>`.

## Open command

The gateway resolves the explicit surface through the repository registry, confines the target beneath `designs/openpencil`, verifies the design file and registered page, launches OpenPencil Desktop shell-free with the design file, then uses the reviewed CLI channel to activate the exact page.

Unknown surfaces, missing files/pages, missing CLI, missing Desktop, or activation failure are visible errors. There is no fallback to another surface.

## Visual session

Once OpenPencil launches, normal review is visual: inspect, edit and save in the desktop GUI.

Headless tree/query/eval/XPath operations remain diagnostic or automation capabilities only.

## Return / design-review handoff

`OpenPencil review <surface>` resolves the same explicit registry target and gathers read-only Git status/diff evidence for the saved repository design artifact.

That evidence is loaded into the existing PlotPickle request box. It does not enter DSDD automatically. The Human chooses Interpret, Pi Draft and Publish Brief.

Publish Brief creates the governed GitHub issue and design references. No source code is changed and no implementation PR is created by this workflow.

## Acceptance

- Explicit `OpenPencil open Timeline` and multi-word surface commands parse outside DSDD narration.
- Unknown surfaces fail with the supported list.
- Surface registry is repository-owned and every target stays beneath `designs/openpencil`.
- GUI launch is shell-free, explicit and never happens during startup.
- The registered page is explicitly activated after the document opens.
- OpenPencil Desktop/MCP/CLI availability is prepared non-blockingly after core readiness.
- `OpenPencil review <surface>` produces read-only Git design evidence and fills the DSDD request for Human review.
- The handoff ends at Publish Brief → GitHub issue, not an implementation PR.
- Existing #2778/#2780/#2782 OpenPencil contracts remain compatible.
- Settings Command Windows proof covers the explicit GUI command boundary.
- Exact-head Architecture Verification is green before merge.
