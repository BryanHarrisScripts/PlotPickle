# Issue #148 — Automatic story project setup

## Purpose

Phase 2 removes repository creation, branch selection and manifest-path decisions from the normal PlotPickle onboarding flow.

A writer can now:

1. Connect a GitHub account through Phase 1.
2. Choose an existing story project or create a new one.
3. Keep a new repository private by default.
4. Let PlotPickle detect the approved default branch.
5. Let PlotPickle create or read `plotpickle-project.json`.
6. Reach the existing five-point Ready gate without manually entering repository metadata.

PlotPickle remains local-first. GitHub is optional, repositories remain user-owned and disconnection never deletes creative work.

## Repository creation modes

### Configured GitHub template

Set:

`PLOTPICKLE_GITHUB_TEMPLATE_REPOSITORY=owner/repository`

The configured repository must be marked as a GitHub template. PlotPickle calls GitHub’s template-generation endpoint and then replaces the template manifest with the new project identity.

### Built-in bootstrap

When no external template is configured, PlotPickle creates a private initialized repository and writes the same repository contract serially through GitHub’s Contents API.

The bootstrap does not create branches or pull requests.

## GitHub permissions

Existing collaboration continues to require:

- Metadata: Read-only
- Contents: Read and write
- Pull requests: Read and write

Creating a repository additionally requires:

- Administration: Read and write

The interface explains this elevated permission and keeps existing-repository connection available when repository creation is unavailable.

## Story project manifest

`plotpickle-project.json` is a small repository-level descriptor. It is not the canonical story itself and contains no credentials.

It records:

- story title and project ID
- manifest and schema versions
- repository owner, name and approved default branch
- the current transitional `.ppf` path
- the Phase 3 modular-project format target
- Project Lead and Story Proposal collaboration defaults

The manifest schema is retained at:

`schema/github-story-project-manifest.schema.json`

## Existing repositories

When an existing repository is selected:

- PlotPickle reads `plotpickle-project.json` from the detected default branch.
- A supported manifest supplies the canonical `.ppf` path automatically.
- A missing manifest produces an explicit Initialize action.
- Initialization adds only missing setup files and preserves existing repository files.
- An incompatible manifest is never overwritten.

## Bootstrap files

A new or initialized repository receives:

- `plotpickle-project.json`
- `README.md`
- `.gitignore`
- `.github/pull_request_template.md`
- `stories/.gitkeep`
- `canon/.gitkeep`
- `assets/.gitkeep`
- `exports/.gitkeep`
- `collaboration/.gitkeep`

The retained template source is under `templates/github-story-project/`.

## Security boundaries

- GitHub credentials remain in PlotPickle’s protected local credential store.
- No token, refresh token, API key or private key is written to the repository.
- Repository setup runs only through the loopback-only local gateway.
- All file writes are serial to avoid conflicting GitHub Contents API updates.
- The existing readiness engine remains authoritative before collaboration actions are enabled.

## Phase boundary

Phase 2 prepares the repository and detects its project descriptor. It does not yet replace the transitional `.ppf` collaboration object with canonical modular-folder synchronization. That work belongs to Phase 3.
