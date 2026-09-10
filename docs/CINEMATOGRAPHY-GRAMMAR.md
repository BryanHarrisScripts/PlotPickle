# PlotPickle Cinematography Grammar

PlotPickle does not treat cinematography as a bag of copy-and-paste prompts. It treats cinematography as structured story direction.

The grammar sits beneath Sequence Director and above provider formatting:

`story intent -> grammar primitives -> Sequence Director -> provider adapter -> render proposal -> Human review`

## What a primitive contains

Each primitive records:

- a stable PlotPickle id;
- a filmmaking category;
- a short technique label;
- story intents it can serve;
- an observable visual or sonic effect;
- plain-language aliases;
- still/video applicability;
- compatible combinations; and
- explicit conflicts.

The first grammar spans framing, angle, camera movement, lens behavior, composition, lighting, colour/texture, edit intent, narrative visual devices, physical/VFX response, sound/atmosphere and continuity.

## Why this is different from a prompt library

The selector does not retrieve a canned paragraph. It deterministically ranks primitives against the writer's intent, removes incompatible combinations, respects still/video applicability and limits the result to a small set. Sequence Director compiles those selections as visible filmmaking consequences. Provider adapters may later express that structured direction in provider-specific syntax.

This keeps the creative decision portable. A camera or lighting decision remains a PlotPickle decision even if the user changes local model, cloud provider or rendering engine.

## Rights and provenance

The grammar wording in this repository is original PlotPickle text. Public filmmaking references and open-source projects may be studied for concepts, taxonomy and interoperability patterns, but PlotPickle does not copy third-party prompt prose, branding, preset databases or proprietary classifications into the grammar.

The grammar contains generic filmmaking concepts rather than claims of ownership over underlying film vocabulary. When code or data is ever imported from an external open-source project, that import must be separately reviewed under the repository's normal licensing process.

## Authority boundary

Cinematography Grammar and Sequence Director may propose visual choices. They cannot select or change providers, models, runtimes, API keys, paid routes or canon approval. Rendered output remains proposed material until a Human approves it through the normal PlotPickle workflow.
