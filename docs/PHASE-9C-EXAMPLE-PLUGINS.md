# Phase 9C — Example Plugins

Phase 9C proves the Phase 8 plugin platform and Phase 9B SDK with a complete reference catalog covering collaboration, AI, local models, screenplay interchange, publishing, reports, diagnostics, images and music.

## Delivered

- 13 reference plugin definitions
- machine-readable catalog and permissions
- executable lifecycle, command, menu and event examples
- cloud and local AI provider patterns
- FDX, Fountain and PDF exchange patterns
- character, dialogue and story reporting patterns
- image and music provider patterns
- explicit credential, provenance and approval rules
- catalog validation through the plugin developer CLI
- focused regression tests wired into the main test suite

## Architectural boundary

Examples import only the public Plugin SDK surface. They do not import application internals. Command handlers return reviewable results and do not modify canonical story data automatically.

Credentials remain in the host secret store. Local providers operate without cloud accounts. Imported, exported and generated material carries provenance. AI-generated suggestions require explicit writer approval before canonical changes.

## Validation

```bash
npm run test:example-plugins
node scripts/plotpickle-plugin.mjs examples examples/plugins/catalog.json
```

The catalog must include at least one read-only plugin, one write-capable plugin, one provider and one exporter. Phase 9D can use this catalog as the source for developer tutorials and the public developer portal.
