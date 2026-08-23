# Global AI Source Registry Roadmap

This note captures the current product conversation for the next AI routing pass: make the source system modular, JSON based, global, and flexible.

## Direction

PlotPickle should move the active AI source matrix out of one-off UI conditionals and into a shared registry. The registry should describe providers, capabilities, routes, readiness gates, installation probes, consent requirements, cost boundaries, and consumer surfaces in one durable place.

The first registry shape lives in `config/ai-source-registry.json`. It is intentionally declarative. UI, diagnostics, local gateways, and tests should be able to consume the same source of truth instead of re-encoding the route matrix in separate files.

Registry capability and route IDs match the live routing gateway exactly: `text`, `image`, and `video`, with user-facing labels of Writing, Images, and Video. This prevents a loader from maintaining translation aliases between the registry and the installed source console.

## Product Contracts

- Writing, images, and video have independent active routes.
- Off and Manual Import stay first-class no-cost routes.
- Local and cloud providers can be mixed and reported as hybrid.
- Installed/configured, running/tested, ready, active, and off remain separate states.
- Local installation detection stays limited to reviewed Ollama and ComfyUI probes.
- Cloud providers require explicit consent and encrypted local credential configuration.
- New providers should be mostly data plus a small provider probe module.
- Runtime identifiers remain stable even when user-facing labels change.

## Next Build Slice

1. Add a typed loader that normalizes `config/ai-source-registry.json`.
2. Replace duplicated route arrays in the AI routing panel with registry-derived route groups.
3. Move provider health and installation checks behind provider probe modules.
4. Teach diagnostics to report registry coverage and missing provider modules.
5. Keep string-level UI contract tests while adding registry-level tests for provider and route integrity.
