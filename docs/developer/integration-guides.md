# Importers, exporters and providers

## Importers

An importer converts an external format into validated PlotPickle project structures. Parse into an intermediate representation, report recoverable warnings, validate identifiers and relationships, then ask the writer to approve the import before replacing active material.

For Final Draft and Fountain patterns, see the Phase 9C examples. Preserve scene headings, action, dialogue, parentheticals, transitions and source metadata. Never silently discard unsupported content.

## Exporters

Exporters read through Core Services and create a new artifact. They must not mutate the project as a side effect. Include format, completion time and destination in `ExportCompleted` events. PDF exporters should produce deterministic pagination where practical and disclose any font substitution.

## AI providers

Provider plugins should expose provider and model identity, configurable endpoints, timeout and cancellation behavior, token or context limits, and provenance. Generated material remains a proposal until accepted.

For OpenAI-compatible cloud providers:

- keep API keys in host-managed secrets;
- send the minimum context;
- expose network use clearly;
- support structured errors without logging sensitive prompts.

## Local providers

Ollama and LM Studio integrations should accept a configurable loopback endpoint rather than assuming one port forever. Verify availability before generation, identify the selected model, provide actionable connection errors and avoid presenting local execution as cloud execution.

## GitHub collaboration

Use the Git service permission boundary. Prefer status, history and proposal operations over direct repository mutation. Present commits and pull requests as deliberate writer actions and never place credentials in project storage.

## Images, voice and music

Media providers should return assets plus provenance, prompt or instruction metadata, provider/model identity and licensing notes supplied by the provider. Adding an asset to a project requires `assets:write` and explicit retention by the user.

## Diagnostics and reports

Read-only analysis plugins should normally need only `project:read`, `screenplay:read`, `canon:read` or `reports:read`. Reports must distinguish measurements from subjective advice and link findings back to stable project identifiers.

## Example walkthroughs

The [example plugin catalog](../../examples/plugins/README.md) contains canonical patterns for cloud AI, Ollama, LM Studio, GitHub, FDX, Fountain, PDF, character reports, dialogue reports, story diagnostics, images and music.
