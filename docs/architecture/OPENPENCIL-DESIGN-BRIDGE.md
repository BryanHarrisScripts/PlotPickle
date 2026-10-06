# OpenPencil Design Bridge

Issue: #2778

OpenPencil is an optional, user-managed design and UX prototyping tool for PlotPickle. It is not part of the product runtime and it does not become a second UI, design, development, or merge authority.

## Why it exists

PlotPickle already contains substantial product intelligence that can be difficult to evaluate when implementation and design happen at the same time. A programmable design surface lets the project turn an approved product scenario into a visual mockup, inspect the result, revise it, and only then move the approved design back through the normal DSDD/GitHub implementation chain.

The first proof is Timeline, where existing screenplay evidence, shot intent, approved images, prompts, motion generation, job state and playback need to become one coherent filmmaking workflow.

## Authority chain

Human intent
→ PlotPickle scenario / UI contract
→ optional OpenPencil mockup
→ Human review
→ DSDD developer brief
→ PlotPickle source implementation
→ WebMCP / focused UAT
→ GitHub exact-head CI
→ Human-authorized merge

OpenPencil may create or revise design artifacts. It may not directly change PlotPickle source code as part of this adapter and it has no merge authority.

## Runtime boundary

OpenPencil is connect-only and user-managed.

PlotPickle must not:

- install OpenPencil automatically;
- launch OpenPencil during normal startup;
- require OpenPencil for product readiness;
- add @open-pencil packages to the normal runtime dependency graph merely for this integration;
- silently connect a cloud model through OpenPencil;
- expose story/project files outside an explicitly scoped design workspace.

The optional MCP boundary uses OPENPENCIL_MCP_ROOT to scope accessible files.

## Human control

Read-only inspection may be automated inside the scoped design workspace.

Any operation that writes, converts, imports, exports, or materially revises a design requires explicit Human action in the workflow that requested the operation.

A generated design remains a proposal until the Human approves it. Exported JSX, Tailwind, Storybook or other code-oriented artifacts are evidence/reference material, not authoritative source code.

## First proof: Timeline

The design should optimize one Human scenario:

“I have 25 approved Storyboard images and want to turn them into 25 three-second moving shots, review them, and watch the Mini-Block as a coherent sequence.”

The selected Shot is the dominant context:

script
→ shot intent
→ approved first frame
→ motion direction
→ Generate Motion
→ review
→ Keep / Redo
→ next Shot

The 25-Shot strip remains visible for navigation and status. Provider routing, job IDs and provenance remain available as secondary diagnostics rather than primary creative controls.

## Validation

The integration is considered healthy only if:

- PlotPickle starts normally with OpenPencil absent;
- the adapter remains optional and capability-detected;
- workspace scope is explicit before agent writes;
- no normal runtime dependency is introduced;
- DSDD and WebMCP remain authoritative for implementation and UI verification;
- OpenPencil output can be discarded without affecting project data or product startup.


## Phase 2 — Command connection

Issue #2780 makes the optional bridge executable without changing the normal startup contract.

The Human entrypoint is **Settings → Command**. Command exposes a visible OpenPencil connection card and recognizes these bounded operational verbs:

- `OpenPencil help`
- `OpenPencil status`
- `OpenPencil connect <absolute local design workspace>`
- `OpenPencil disconnect`

Operational OpenPencil commands do not enter the DSDD interpretation/Pi Draft/Publish Brief path. They use separate command/tool message roles so checking or changing local connection state cannot silently rewrite a locked development intent.

Connection remains explicit. PlotPickle detects the user-managed `@open-pencil/mcp` installation, resolves `openpencil-mcp-http`, and launches it only after the Human supplies an existing absolute workspace. The child receives `OPENPENCIL_MCP_ROOT` equal to that workspace and serves the documented local MCP endpoint at `http://127.0.0.1:7600/mcp`.

On Windows, PlotPickle does not execute an arbitrary `.cmd` wrapper. It resolves the reviewed npm global JavaScript entrypoint and launches it directly with Node using `shell: false`.

PlotPickle owns only the child it launched. If port 7600 is already occupied by an unowned process, the connection fails closed. Disconnect terminates only the PlotPickle-owned OpenPencil MCP child and never uninstalls OpenPencil.

This phase proves connection lifecycle only. Design-tool calls still remain proposals under the Human/DSDD authority chain above; no OpenPencil connection grants source mutation or merge authority.
