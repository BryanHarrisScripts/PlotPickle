# PlotPickle Cline Rule

`AGENTS.md` at the repository root is the canonical PlotPickle development contract. Read and follow it before planning or editing.

Cline-specific guardrails:

- Work on a branch or isolated worktree, never directly on `main`.
- Use the project `plotpickle-dev` MCP tools for status and deterministic validation when useful; ordinary repository inspection/editing may use Cline's native tools.
- Keep auto-approved work inside the current repository/worktree. Do not access unrelated user folders, credentials, browser profiles, or story data.
- Do not merge your own PR. Required PlotPickle UAT/build gates and GitHub CI remain independent authority.
- Prefer the smallest working diff and reuse existing architecture before adding dependencies.
