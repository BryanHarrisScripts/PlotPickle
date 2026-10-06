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


## Phase 4 — explicit surface GUI design review

Issue #2787 moves the normal design session out of headless command inspection and into the OpenPencil desktop GUI while preserving Command as the deterministic launcher.

The Human explicitly names the design surface. PlotPickle does not infer it from the current route or current UI context.

Example:

```text
OpenPencil open Timeline
```

The command resolves `Timeline` through the repository-owned `designs/openpencil/surfaces.json` registry. That registry binds stable PlotPickle surface names to a design file and page name. Multi-word surfaces such as `Mind Map`, `World Map` and `Rough Cut` remain explicit names.

The normal workflow is:

```text
PlotPickle Command
→ OpenPencil open <surface>
→ OpenPencil Desktop GUI
→ visually inspect / edit / save
→ return to PlotPickle
→ OpenPencil review <surface>
→ 01 Interpret
→ 02 Pi Draft
→ 03 Publish Brief
→ GitHub issue
```

The OpenPencil phase stops at the published GitHub issue. It does not create an implementation pull request. Any implementation requested by that issue begins later as a separate governed PlotPickle development cycle.

### GUI/runtime split

Three reviewed OpenPencil 0.15.1 capabilities have separate responsibilities:

- `@open-pencil/mcp` remains the scoped automation/agent bridge.
- `@open-pencil/cli` supplies deterministic app-control commands such as document listing and page activation.
- OpenPencil Desktop supplies the visual editor.

All preparation remains deferred until PlotPickle core readiness. Preparation failure is non-blocking. No MCP server or desktop GUI launches during normal startup.

On Windows, when the desktop application is absent, PlotPickle may prepare the pinned upstream OpenPencil 0.15.1 x64 installer after core readiness. The installer identity is verified by SHA-256 before execution. The GUI still launches only after an explicit `OpenPencil open <surface>` command.

### Opening a surface

The GUI gateway:

1. requires the existing authenticated Human profile and loopback/CSRF boundary;
2. resolves only an explicit registry surface name;
3. confines the design target to `designs/openpencil`;
4. verifies the registered design file and page exist;
5. launches the desktop editor shell-free with the explicit file;
6. uses the reviewed CLI app-control channel to find the opened document and activate the registered page;
7. reports the exact surface, file and page back to Command.

A missing desktop app, file, page, or unknown surface is a visible failure. PlotPickle does not silently invent a design or choose another page.

Normal design review after launch is GUI-first. `tree`, `query`, `eval`, XPath and similar headless operations remain available for diagnostics and automation, not as the expected Human design interface.

### Review Design Changes

`OpenPencil review <surface>` gathers read-only Git evidence for the explicitly named repository design artifact and places a bounded design-review request into the existing DSDD request box.

The Human then deliberately chooses **Interpret → Pi Draft → Publish Brief**. Publish Brief creates the normal GitHub issue. OpenPencil does not modify PlotPickle implementation source, create an implementation PR, commit a design, or merge anything.

This explicit-name requirement is deliberate. Context-aware/current-surface inference is outside the Phase 4 contract.


## Phase 5 — clean-checkout design bootstrap

Issue #2791 closes the first-run gap in Phase 4. The explicit surface registry previously targeted a shared `design.fig` that was not present in a clean repository checkout, so a correct `OpenPencil open Timeline` command failed before the GUI could launch.

The exact pinned OpenPencil 0.15.1 release reads `.pen` and provides the headless `convert` command, while normal GUI save authority remains the editable `.fig` format. PlotPickle therefore keeps a small repository-owned `.pen` seed for each named surface and an explicit editable `.fig` target in `surfaces.json`.

On first open only, when the target `.fig` does not exist, PlotPickle resolves and confines the target and seed to `designs/openpencil`, converts the seed to the editable target with the reviewed CLI, verifies the registered page, then launches OpenPencil Desktop and activates that exact page. Once an editable `.fig` exists, the seed is never allowed to overwrite it. `OpenPencil review <surface>` continues to gather Git evidence from the editable `.fig`.


## Phase 6 — live Timeline design snapshot

Issue #2793 makes Timeline the first proof that OpenPencil can begin from the actual rendered PlotPickle product rather than from a minimal bootstrap canvas.

The Human's authenticated browser remains the only source allowed to capture private current-story UI. Command raises a bounded local design-capture event; the dashboard host reveals Timeline; the browser waits for the governed Timeline ready selector and serializes only the Timeline review subtree with rendered geometry and selected computed styles. Script/style/runtime tags are excluded and the payload is size/node bounded by `config/openpencil-design-snapshot.json`.

The existing authenticated OpenPencil gateway accepts that bounded Timeline snapshot and the pinned OpenPencil 0.15.1 CLI imports the HTML/CSS into `timeline-live.fig`. The previous `timeline.fig` scaffold is not overwritten. Once the live FIG exists, later opens preserve Human edits and do not regenerate it.

WebMCP does not inherit the Human browser session. Its synthetic profile remains the independent verification observer for navigation, readiness, computed-style/geometry inspection and screenshot evidence. This keeps the privacy boundary deterministic while reusing the same rendered-surface concepts for QA.
