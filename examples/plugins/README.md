# PlotPickle Example Plugins

These reference plugins demonstrate the supported Phase 9B public SDK boundary without importing PlotPickle application internals.

## Included examples

| Example | Category | Demonstrates |
| --- | --- | --- |
| Hello PlotPickle | Read-only | lifecycle, commands, menus and events |
| GitHub Collaboration | Write-capable | reviewable snapshots and dedicated Git permission |
| OpenAI-Compatible | Provider | cloud provider, streaming and approval gates |
| Ollama | Provider | local inference without a cloud account |
| LM Studio | Provider | local OpenAI-compatible endpoint |
| Final Draft Exchange | Exporter/importer | FDX compatibility reporting and provenance |
| Fountain Exchange | Exporter/importer | plain-text screenplay interchange |
| PDF Publisher | Exporter | screenplay and report publishing |
| Character Reports | Read-only | lines, words and scene participation |
| Dialogue Analysis | Read-only | dialogue distribution and voice checks |
| Story Diagnostics | Read-only | 24-block and 96-mini-block analysis |
| Image Provider | Provider | reviewable character and storyboard assets |
| Music Provider | Provider | scene cues, temporary music and cue sheets |

## Safety contract

Provider credentials belong in the host secret store and never in `.ppf` project files. AI, image and music results are suggestions until a writer explicitly approves them. Imports, exports and generated assets retain provenance. Local-provider examples do not require a cloud account.

## Structure

`catalog.json` is the machine-readable example index. `src/index.ts` exports executable SDK reference modules. The Phase 9C regression test verifies catalog coverage, permission declarations, lifecycle use and the human-approval boundary.

## Validation

```bash
npm run test:example-plugins
node scripts/plotpickle-plugin.mjs examples examples/plugins/catalog.json
```

The examples intentionally return reviewable result objects rather than changing canonical story data. Third-party developers can replace the command handlers with real provider or format adapters while preserving the same lifecycle, permission and approval contracts.
