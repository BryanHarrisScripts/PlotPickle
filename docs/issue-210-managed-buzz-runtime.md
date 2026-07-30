# Issue #210 — Managed native Buzz runtime

## Decision

PlotPickle distributes Buzz as an optional, completely managed native sidecar runtime.

The user installs PlotPickle once. Buzz is present in the installation package but remains dormant until the user configures it under **Settings → Integrations → Buzz**.

The application navigation becomes:

`Dashboard · Learn · Plan · Storyboard · Write · Pitch | Build · Feedback · Refine · Reports | Collab · Buzz | Settings`

Collab and Buzz remain separate application workspaces:

- **Collab** owns GitHub Story Proposals, Project Lead approvals, meetings and calendar activity.
- **Buzz** owns rooms, conversations, agents, media discussion, development activity and searchable event history.
- **Feedback** remains the permanent structured review and resolution record inside the PPF project.

## Installation boundary

The normal PlotPickle installer contains a pinned, platform-specific Buzz runtime. It does not include or launch the separate Buzz desktop client.

Required managed components:

- `buzz-relay`
- `buzz-cli`
- `buzz-agent`
- `buzz-dev-mcp`

Each platform package carries a signed manifest containing the source revision, component paths, SHA-256 checksums and required licence files.

The first architecture PR defines this contract only. It must not claim that native binaries are already packaged until platform manifests and clean-machine validation exist.

## Dormant-by-default contract

When Buzz is unconfigured:

- no Buzz process runs;
- no relay port listens;
- no Buzz identity or private key exists;
- no Buzz database or project room exists;
- no Buzz data folder is initialized; and
- PlotPickle remains fully usable.

Bundled program files may exist inside the replaceable PlotPickle installation, but generated data and credentials do not.

## Persistent data boundary

Buzz program files and Buzz-generated data are separated.

Program files are replaced during PlotPickle upgrades. Persistent Buzz data lives under the current operating-system user account in a PlotPickle-managed data root.

The runtime owns separate locations for:

- runtime data;
- OS-user encrypted credentials;
- logs that exclude secrets and PPF story content;
- backups; and
- isolated coding-agent worktrees.

Buzz private keys, relay secrets and service credentials never enter PPF projects, exports, reports, prompts, browser storage or GitHub commits.

## Runtime lifecycle

The public lifecycle is:

- `unconfigured`
- `configuring`
- `stopped`
- `starting`
- `running`
- `stopping`
- `repair-required`
- `unavailable`

Settings owns configuration, initialization, start, stop, restart, health checks, repair, updates, backup, restore and removal.

The Buzz workspace may display status and route the user to Settings, but it must not request credentials or mutate runtime configuration itself.

## Native packaging plan

### Windows

Package Windows-native Buzz binaries and dependencies. Use the existing PlotPickle launcher and persistent runtime model. No Administrator rights, Windows service or automatic startup entry is permitted.

### macOS

Package signed native binaries for Intel and Apple Silicon. Credentials use the current user's Keychain. Runtime processes are started only by PlotPickle.

### Linux

Package x64 native binaries with Secret Service integration where available. PlotPickle reports an honest unavailable or reduced-protection state when the required desktop services are absent.

## Current Buzz dependency risk

Buzz currently relies on Postgres, Redis, object storage and Git storage in its production Compose stack. A one-installer PlotPickle distribution cannot simply hide Docker as though it were a native runtime.

Phase 2 must choose and validate one of these approaches:

1. package the required services as private native child processes;
2. replace them with an approved embedded desktop storage profile; or
3. contribute a supported single-node desktop mode upstream.

No option is accepted until clean-machine startup, shutdown, repair, backup and removal tests pass on Windows, macOS and Linux.

## Coding integration boundary

Buzz coding integration is optional and requires explicit Developer Mode.

- The user selects a repository.
- PlotPickle creates an isolated worktree.
- Agents receive access only to that worktree.
- Agents cannot read the PlotPickle credential vault or unrelated PPF folders.
- Changes are branch-only.
- Tests run before publishing.
- GitHub remains the canonical code repository.
- Collab remains the human approval and merge surface.

The shell runs at the operator's trust level, so filesystem and command restrictions must be enforced by the runtime rather than by prompt instructions alone.

## Phase sequence

### Phase 1 — Application and runtime contracts

- Add Buzz beside Collab.
- Add Settings-owned Buzz configuration.
- Add honest dormant, packaged, configured, running and repair states.
- Add native runtime manifest and lifecycle contracts.
- Add tests and documentation.

### Phase 2 — Native packaging

- Build and pin native Buzz components for every supported platform.
- Resolve persistent service dependencies.
- Add startup, shutdown, health, repair, update, backup and removal commands.
- Add clean-machine packaging tests.

### Phase 3 — Story integration

- Create project and contextual rooms.
- Link messages to stable PlotPickle target IDs.
- Add Save to Feedback and Create Story Proposal.
- Store only safe relay, channel and event references in PPF.

### Phase 4 — Coding integration

- Add Developer Mode and isolated worktrees.
- Post commands, diffs and test evidence to Buzz.
- Publish branches through the existing GitHub connection.
- Keep merges human-controlled in Collab.
