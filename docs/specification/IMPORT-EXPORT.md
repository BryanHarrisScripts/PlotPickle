# Import and Export Contract

## General import sequence

1. Identify source type.
2. Extract locally where practical.
3. Validate structure and content confidence.
4. Present a preview before changing Canon.
5. Create stable component IDs and provenance mappings.
6. Import as `imported` or `suggested`.
7. Require explicit approval for Canon-changing interpretations.

## Supported source classes

Existing PlotPickle JSON, folder projects, `.ppf`, Fountain, FDX, plain text and screenplay-formatted PDF may enter the same normalized project pipeline.

## Screenplay PDF gate

A PDF is eligible for screenplay conversion only when a deterministic detector finds sufficient screenplay conventions, including scene headings, character/dialogue relationships and screenplay-like layout. The importer returns a confidence score and representative preview. Low-confidence documents may be retained as references but are not silently converted.

Native-text PDFs are preferred. Scanned PDFs require OCR and mandatory review. Parsed elements retain source-page mappings when available.

The importer may create complete or selective content: screenplay, dialogue, characters, locations, production candidates and structural-analysis suggestions. Inferred props, arcs, blocks and production needs remain unapproved candidates.

## Rights safeguard

The user confirms lawful access and acknowledges that import does not grant redistribution rights. PlotPickle does not bundle commercial screenplays without permission. Retained source PDFs are excluded from shared packages by default.

## Export

Exports may target a folder project, a `.ppf` profile, Fountain, FDX, PDF, HTML, Markdown or report format. Exporters identify lossy transformations before writing. Unknown project modules survive folder and `.ppf` round trips even when the current application cannot edit them.
