# PlotPickle OpenPencil Designs

This directory is the canonical repository-owned OpenPencil design workspace.

PlotPickle scopes the local OpenPencil MCP server to this directory by default through `OPENPENCIL_MCP_ROOT`.

## What belongs here

- OpenPencil `.pen` bootstrap source files.
- Editable/generated OpenPencil `.fig` design artifacts that are intended for PlotPickle review.
- Supporting design notes or assets that are safe and appropriate for Git.

## Authority

These files are design artifacts, not executable PlotPickle source authority.

OpenPencil may create or revise files here only through an explicit Human-connected design workflow. A design remains a proposal until the Human reviews it. Any corresponding PlotPickle implementation still proceeds through the normal DSDD developer brief, source change, tests, pull request, exact-head CI and Human merge authority.

PlotPickle does not automatically commit or merge files in this directory.

## Privacy

Do not place credentials, secrets, private profile data, provider keys or unreviewed private story material here. Files committed under this directory become part of the Git repository history.


## Explicit surface workflow

`surfaces.json` is the deterministic registry for PlotPickle design pages. The Human names the target explicitly from Settings → Command:

```text
OpenPencil open Timeline
OpenPencil open Storyboard
OpenPencil open Mind Map
```

PlotPickle does not infer a design surface from the current route.

Each registry entry names an editable `.fig` target and a repository-owned `.pen` bootstrap seed. On a clean checkout, `OpenPencil open <surface>` uses the pinned OpenPencil CLI to materialize the missing `.fig` from its seed, then launches the GUI. Existing `.fig` files are never overwritten by the seed.

The registered `.fig` opens in the OpenPencil desktop GUI for normal visual inspection, editing and Save. Headless `tree`, `query` and `eval` commands remain optional diagnostics rather than the expected design interface.

After saving, return to PlotPickle and run:

```text
OpenPencil review Timeline
```

PlotPickle gathers read-only Git evidence for that explicit design artifact and loads a design-review request into DSDD. The Human then chooses **01 Interpret → 02 Pi Draft → 03 Publish Brief**. The handoff publishes a GitHub issue only; it does not create an implementation PR or change application source.
