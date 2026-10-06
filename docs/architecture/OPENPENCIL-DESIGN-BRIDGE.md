# OpenPencil Design Bridge

Issue: #2778

OpenPencil is an optional design and UX prototyping tool for PlotPickle. PlotPickle prepares the reviewed MCP helper package after core readiness, while the OpenPencil server remains explicitly Human-connected. It does not become a second UI, design, development, or merge authority.

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

OpenPencil connection remains explicit, but the reviewed MCP helper is startup-managed after core readiness.

PlotPickle:

- prepares pinned `@open-pencil/mcp@0.15.1` after the core app is already ready;
- installs it only in user-owned local app data at `%LOCALAPPDATA%\PlotPickle\tools\openpencil`;
- treats preparation failure as a warning that cannot block core PlotPickle;
- does not launch `openpencil-mcp-http` during startup;
- does not require OpenPencil for product readiness;
- does not add `@open-pencil/mcp` to the normal PlotPickle runtime dependency graph;
- may fall back to an already-installed global OpenPencil MCP if the managed helper is unavailable;
- never silently connects a cloud model through OpenPencil;
- exposes story/project files only inside an explicitly scoped design workspace.

The optional MCP boundary uses `OPENPENCIL_MCP_ROOT` to scope accessible files. The canonical default is the repository-owned `designs/openpencil` directory. Design source files created there are Git artifacts and may be reviewed, committed and merged through the normal Human/DSDD/GitHub workflow; OpenPencil itself has no commit or merge authority.

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

Connection remains explicit. PlotPickle first resolves its managed `@open-pencil/mcp@0.15.1` entrypoint, with an existing user/global installation retained as a fallback, and launches `openpencil-mcp-http` only after the Human supplies an existing absolute workspace. Settings prefills the repository `designs/openpencil` workspace when available. The child receives `OPENPENCIL_MCP_ROOT` equal to that workspace and serves the documented local MCP endpoint at `http://127.0.0.1:7600/mcp`.

On Windows, PlotPickle does not execute an arbitrary `.cmd` wrapper. It resolves the reviewed npm global JavaScript entrypoint and launches it directly with Node using `shell: false`.

PlotPickle owns only the child it launched. If port 7600 is already occupied by an unowned process, the connection fails closed. Disconnect terminates only the PlotPickle-owned OpenPencil MCP child and never uninstalls OpenPencil.

This phase proves connection lifecycle only. Design-tool calls still remain proposals under the Human/DSDD authority chain above; no OpenPencil connection grants source mutation or merge authority.


## Phase 3 — authenticated profile scope and managed preparation

Issue #2782 closes the UAT gap where Settings → Command was visibly inside an unlocked Human profile but `/api/openpencil/mcp` did not receive the authenticated profile request context. `/api/openpencil` is now part of the canonical profile-scoped API boundary, so status/connect/disconnect operate only for an authorized Human session and mutating requests retain the existing CSRF requirement.

OpenPencil preparation is deliberately split from OpenPencil connection:

1. Core PlotPickle reaches ready state first.
2. Deferred maintenance ensures `designs/openpencil` exists in the repository checkout.
3. Deferred maintenance prepares pinned `@open-pencil/mcp@0.15.1` in PlotPickle local app data when needed.
4. Any preparation failure is a warning; core PlotPickle remains usable.
5. No MCP process or port 7600 is started during preparation.
6. The Human explicitly selects **Connect OpenPencil** to launch the local MCP child.

This keeps the developer/design helper available by default without moving a third-party MCP server into the blocking startup path.
