# PlotPickle architecture blueprint

`plotpickle.architecture.json` is the machine-readable source for the generated PlotPickle architecture diagram and the managed `ARCHITECTURE` section in the repository README.

The Architecture Skin is intentionally separate from application Skins. It owns only technical-documentation presentation: blueprint background, cyan system boundaries, amber governed/verification boundaries, purple BUZZ/Community boundaries, typography, strokes and diagram rhythm.

After changing the architecture source, run:

```bash
node architecture/generate-architecture.mjs
```

Before committing, verify the generated outputs are synchronized:

```bash
node architecture/generate-architecture.mjs --check
node --test tests/architecture-blueprint-generator.test.mjs
```

Do not hand-edit `plotpickle-architecture.svg` or the generated README block. Update the JSON source or Architecture Skin and regenerate them instead.
