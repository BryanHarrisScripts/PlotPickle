# Public-readiness audit

Audit date: 2026-08-01  
Repository: BryanHarrisScripts/PlotPickle  
Audited branch: main

## Outcome

The current default branch is conditionally ready for public visibility after the repository settings checklist below is completed. This audit did not change repository visibility.

## Findings addressed by this branch

- The release-candidate workflow granted contents write access to every packaging job, including pull-request runs. The workflow is now read-only by default, and only the tag-publishing job receives contents write access.
- GitHub-hosted actions used movable major-version tags. The audited workflows now pin every external action to a reviewed full commit SHA.
- Common credential, certificate, local project, backup and log paths were not comprehensively ignored. The root ignore policy now covers them while permitting a placeholder-only .env.example.
- The repository had no root private vulnerability reporting policy or contributor conduct policy.
- Dependency and GitHub Actions update monitoring was not configured.
- Public-readiness controls were advisory rather than executable. A dependency-free audit now checks required policy files, forbidden tracked filenames, recognizable credential patterns, workflow permissions, pull_request_target use and immutable action references.

## Current-tree review

Targeted searches of the indexed main branch did not identify a recognizable live OpenAI, GitHub, Google, AWS or Slack credential or a committed private-key block. Matches for security-related words were implementation code, tests or documentation.

This is not proof that reachable Git history is clean. Before changing visibility, enable GitHub secret scanning and push protection, review any resulting alerts, revoke every exposed credential, and complete a history rewrite if an alert points to an earlier commit.

## Repository settings required before publication

1. Create an active main-branch ruleset that blocks deletion and force pushes, requires pull requests, required status checks and resolved conversations.
2. Set Actions workflow permissions to read-only by default; leave "Allow GitHub Actions to create and approve pull requests" disabled.
3. Require approval for workflows from outside collaborators and never expose repository secrets to public-fork pull requests.
4. Enable dependency graph, Dependabot alerts, Dependabot security updates, secret scanning, push protection, CodeQL default setup and private vulnerability reporting.
5. Review collaborators and deploy keys; keep administrator access limited to the owner and trusted maintainers.
6. Keep signing keys and release credentials in protected GitHub Environments restricted to tags or main.
7. Verify the repository while signed out before announcing it as public.

## Publication boundary

PlotPickle source may be public. User projects, PPF files, backups, diagnostics, signing material and service credentials must remain private. PlotPickle-created story repositories must remain private by default unless their owner explicitly changes that setting.
