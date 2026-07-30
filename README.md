<p align="center">
  <img src="public/brand/plotpickle-header-horizontal-1200.png" alt="PlotPickle" width="760">
</p>

# PlotPickle

**A local-first visual storyworld collaboration and previsualization engine.**

PlotPickle keeps story logic, canon, characters, screenplay material, Graphic Novel panels, Storyboard frames, production planning, review evidence and provenance connected in one portable PPF project. The Dashboard now presents the real loaded project, writing progress, Storyworld Overview, GitHub approval state, local storage, unresolved canon decisions and the optional Buzz workspace without fictional collaborators or decorative product mockups.

[Getting Started](public/docs/readme/GETTING-STARTED.md) · [Writing & Production](public/docs/readme/WRITING-AND-PRODUCTION.md) · [Collaboration & Development](public/docs/readme/COLLABORATION-AND-DEVELOPMENT.md) · [Official repository](https://github.com/BryanHarrisScripts/PlotPickle)

## Five reasons to use PlotPickle

1. **Visual storyworld in one PPF** — keep canon, characters, structure, screenplay material, visuals, approvals and provenance connected.
2. **Story logic you can see** — expose hooks, turning points, causality, arcs and continuity through 24 Blocks and 96 mini-blocks.
3. **Connected visual development** — carry approved identities and locations through Graphic Novel, Storyboard, Production Shots and Animatic.
4. **Review with evidence** — use Feedback, Pitch and Reports to make readiness and unresolved decisions visible.
5. **Local-first ownership with optional connections** — use AI, GitHub, Google and Buzz only when deliberately configured.

## The visual storyworld core

PPF is the portable creative source of truth. It keeps structure, canon, screenplay material, visual decisions, production assets, approvals and provenance connected while the canonical local project folder remains authoritative.

Available now:

- Interactive Storyworld Map
- Graphic Novel and Storyboard
- Production Shots and Animatic
- Feedback, Pitch and Reports
- owner-controlled Collab
- Buzz workspace shell, Settings configuration model and dormant runtime contracts

## What PlotPickle does

- **PPF storyworld:** one portable creative source of truth for canon, structure, screenplay material, visuals, approvals and provenance.
- **Story logic you can see:** 24 Blocks, 96 mini-blocks, hooks, turning points, arcs, causality and continuity.
- **Visual development:** approved character and location identity flows into Graphic Novel, Storyboard, Production Shots and Animatic workspaces.
- **Evidence-led review:** Feedback, Pitch and Reports surface what is working, what is unresolved and what must be decided by people.
- **Owner-controlled collaboration:** GitHub Story Proposals and approvals live in Collab; only a human merge changes canonical repository content.
- **Optional Buzz workspace:** rooms, agents, media discussion and development activity sit beside Collab and remain dormant until configured in Settings.

## Current application model

The primary application navigation is:

`Dashboard · Learn · Plan · Storyboard · Write · Graphic Novel | Build · Feedback · Refine · Reports | Collab · Buzz | Settings`

- **Dashboard** shows the real current project, source authority, Storyworld Overview, writing progress, recent project evidence, GitHub state, Buzz state, storage and canon questions.
- **Learn** contains the Introduction, complete 81-module learning library, terminology and screenplay study.
- **Plan** develops foundations, world, characters, four acts, twelve sequences, 24 Blocks and 96 mini-blocks.
- **Storyboard** preserves approved visual identity and continuity across the movie.
- **Write** develops treatment and screenplay material from the same canonical project.
- **Graphic Novel** develops the 24-page, 96-panel visual presentation.
- **Build** owns structural arrangement.
- **Feedback** remains the permanent structured review and resolution record.
- **Refine** provides diagnostic and specialist passes without creating a second structure editor.
- **Reports** measures screenplay, character, scene, production, continuity and readiness evidence.
- **Collab** owns GitHub Story Proposals, approvals, meetings and calendar coordination.
- **Buzz** owns optional rooms, agents, media discussion and development activity.
- **Settings** owns configuration, credentials, lifecycle, recovery, storage and removal for every optional connection.

## Buzz: optional and dormant by default

Buzz is included in the product model but does not activate simply because PlotPickle is installed.

When Buzz is unconfigured:

- no Buzz process runs;
- no relay port listens;
- no Buzz identity, private key or credential file exists;
- no Buzz database, project room, media store or coding worktree exists; and
- PlotPickle remains fully usable.

Open **Settings → Integrations → Buzz** to choose between the planned PlotPickle-managed bundled runtime and an existing relay. Configuration preferences can be saved now. Native bundled Buzz actions remain disabled until platform-specific artifacts, checksums, licence files and clean-machine validation are complete. PlotPickle does not advertise unverified native Buzz binaries as shipped.

Developer Mode and coding agents are always explicit. Later coding integration is limited to isolated worktrees, branch-only changes, test evidence and human-controlled GitHub publishing. Agents may not read the PlotPickle credential vault or unrelated PPF folders.

## Optional connections

PlotPickle's complete local creative core works without external accounts or API keys.

| Settings area | Purpose | Default |
|---|---|---|
| **Story & Art** | Optional OpenAI, compatible-server, Ollama, manual-prompt or no-AI operation | Disconnected |
| **Repository & Collab** | Optional GitHub repository history, Story Proposals, approvals and recovery | Disconnected |
| **Scheduling & Meetings** | Optional Google Calendar and Meet | Disconnected |
| **Buzz** | Optional rooms, agents, media discussion and development activity | Not configured |
| **Media & Film Engines** | Future provider extensions only; no active rendering API | Unavailable |

Credentials remain in the private local-server credential area under the current operating-system user. They are never written into PPF projects, exports, reports, prompts, logs or GitHub commits.

## Local-first desktop builds

PlotPickle is packaged from one codebase for:

| Platform | Archive | Launcher |
|---|---|---|
| Windows | `PlotPickle-Windows.zip` | `Start-PlotPickle.bat` |
| macOS | `PlotPickle-macOS.zip` | `Start-PlotPickle.command` |
| Linux | `PlotPickle-Linux.zip` | `start-plotpickle.sh` |

Each release candidate is built on its target operating system and published with a SHA-256 checksum. There is no required PlotPickle cloud account, administrator installation, background Windows service or automatic startup entry.

## Windows first run

1. Download and extract the Windows archive.
2. Double-click `Start-PlotPickle.bat`.
3. Review the transparent dependency plan.
4. Approve installation only when the required runtime is missing.
5. Keep the command window open while using PlotPickle.
6. Press `Ctrl+C` to stop the local server.

PlotPickle binds to `127.0.0.1`. Replaceable application files remain separate from persistent runtime packages, local projects, credentials, backups and optional Buzz data.

## Storage, upgrades and removal

- Canonical project folders and PPF packages are separate from replaceable PlotPickle program files.
- Rolling backups and recovery are managed under **Settings → Storage & Backups**.
- Windows upgrades use `Update-PlotPickle.bat` and preserve the reusable runtime and local settings.
- Saved connection credentials can be reviewed and erased under **Settings → Privacy & Permissions**.
- Buzz configuration drafts can be removed under **Settings → Integrations → Buzz**.
- When native Buzz storage is later enabled, data removal and identity erasure remain separate explicit actions.

## Collaboration authority

PPF remains authoritative for creative canon. GitHub remains authoritative for code, branches, pull requests and merges.

- **Collab** coordinates formal Story Proposals, approvals, meetings and calendar activity.
- **Buzz** provides optional conversation, agent and development context.
- **Feedback** stores permanent structured review decisions.
- A Buzz message or agent suggestion never becomes PPF canon automatically.
- Only the project owner or an authorized maintainer can approve the repository merge that changes shared canonical material.

## Available now versus future packaging

Available now:

- complete local PPF project model;
- Dashboard, Learn, Plan, Storyboard, Write, Graphic Novel, Build, Feedback, Refine and Reports;
- Storyworld Map, Production Shots, Animatic and Pitch evidence;
- owner-controlled Collab and optional GitHub connection;
- optional Google Calendar and Meet setup boundaries;
- Buzz workspace shell, Settings configuration model and dormant runtime contracts;
- Windows, macOS and Linux packaging validation.

Not yet claimed as shipped:

- verified native Buzz binaries and bundled service dependencies;
- automatic Buzz identity creation or relay startup;
- production Buzz rooms, media storage or coding-agent execution;
- active Pika, Runway or other third-party rendering connectors.

## Open source, licensing and ownership

- PlotPickle software: **GNU AGPLv3 or later**.
- 24 Blocks method and reusable learning documentation: **CC BY-SA 4.0**, with attribution to Bryan Elgin Harris.
- User-created stories, screenplays, characters, images, notes and PPF projects remain the user's creative work.
- Optional integrations do not transfer ownership to PlotPickle.

See [About PlotPickle](app/about/page.tsx), [licensing](app/legal/page.tsx), and [the OpenStory history](docs/history/from-openstory-to-plotpickle.md).

## Development and validation

```bash
npm ci
npm run lint
npm test
npm run build
```

Focused runtime coverage:

```bash
npm run test:managed-buzz-runtime
```

The release matrix validates Windows, macOS and Linux packages. Windows additionally runs clean-machine extraction, deterministic release smoke and packaged interaction checks.

Current application version: `1.0.0-rc.3`  
Current project schema: `1.7.0`
