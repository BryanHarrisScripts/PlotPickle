# PlotPickle Story Project Template

This directory is the retained source for repositories created by PlotPickle’s automatic story-project setup.

A generated story project is user-owned and private by default. PlotPickle replaces the placeholder manifest values during creation, preserves credentials outside the repository and uses Story Proposals for Project Lead review.

Required repository files:

- `plotpickle-project.json`
- `project/` as the canonical modular story folder
- `README.md`
- `.gitignore`
- `.github/pull_request_template.md`
- starter folders for stories, canon, assets, exports and collaboration

The canonical `project/` folder uses the existing PlotPickle 2.3 modular-project engine. Portable `.ppf` files remain available for exchange, migration, backup and optional release snapshots under `exports/releases/`; they are not the canonical collaboration source.

Set `PLOTPICKLE_GITHUB_TEMPLATE_REPOSITORY=owner/repository` to use a GitHub repository marked as a template. When this setting is absent, PlotPickle creates the same contract with its built-in bootstrap files.
