# PlotPickle OpenPencil Designs

This directory is the canonical repository-owned OpenPencil design workspace.

PlotPickle scopes the local OpenPencil MCP server to this directory by default through `OPENPENCIL_MCP_ROOT`.

## What belongs here

- OpenPencil `.pen` source files.
- Imported or converted design-source artifacts that are intended for PlotPickle review.
- Supporting design notes or assets that are safe and appropriate for Git.

## Authority

These files are design artifacts, not executable PlotPickle source authority.

OpenPencil may create or revise files here only through an explicit Human-connected design workflow. A design remains a proposal until the Human reviews it. Any corresponding PlotPickle implementation still proceeds through the normal DSDD developer brief, source change, tests, pull request, exact-head CI and Human merge authority.

PlotPickle does not automatically commit or merge files in this directory.

## Privacy

Do not place credentials, secrets, private profile data, provider keys or unreviewed private story material here. Files committed under this directory become part of the Git repository history.
