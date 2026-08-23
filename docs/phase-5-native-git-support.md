# Phase 5 — Native Git Support

Phase 5 makes each canonical PlotPickle project folder an ordinary Git repository and exposes the common revision workflow through story-oriented controls. Writers do not need to open a terminal or understand Git commands.

## Writer vocabulary

| PlotPickle | Git operation |
| --- | --- |
| Save Revision | stage all project files and create a commit |
| Revision History | read the project commit log |
| Story Branch | create or switch a local branch |
| Story Proposal | create a `proposal/` branch suitable for review |
| Pull Latest | fast-forward from the current branch's remote |
| Publish Changes | push the current branch and establish its upstream |
| Resolve Conflict | keep the current copy, accept the incoming copy, or mark a manually edited file resolved |

## Local-first boundary

Git runs only against folders under PlotPickle's private `projects-v2` directory. All HTTP operations require a loopback connection and matching localhost origin. The gateway invokes the Git executable with argument arrays rather than shell command strings.

A project remains fully usable without a remote. Connecting GitHub, GitLab, a private server or another standard Git remote is optional.

## Repository initialization

The first Git action initializes the active project folder with a `main` branch when it is not already a repository. PlotPickle configures a neutral local author only for that repository. Writers may replace the author using ordinary Git configuration outside PlotPickle.

## Safety rules

- project and branch names are normalized before use;
- remote URLs must use HTTPS, SSH or Git's `git@host:path` syntax;
- pulls use fast-forward-only mode and never create an unexpected merge commit;
- publishing never force-pushes;
- conflict paths must remain relative to the active project;
- conflict resolution is explicit and does not invent or combine story text;
- Save Revision reports when there is nothing new to commit.

## UI route

The complete Phase 5 workspace is available at `/git`. It provides status, changes, branches, proposals, history, remote connection, pull, publish and conflict resolution in one screen.

## Relationship to existing GitHub proposals

PlotPickle's existing GitHub review workflow can continue to create hosted pull requests. Native Git is the lower-level local foundation: every project can now retain revisions and branches even when no GitHub account or token is connected.

## Deferred work

Phase 5 does not automatically open hosted pull requests, perform semantic story merges, store credentials inside projects or auto-resolve screenplay conflicts. Those capabilities can use this stable native Git layer in later releases.
