# Phase 6 — `.ppf` Exchange Format

The canonical PlotPickle working format remains the open project folder. A `.ppf` file is a portable ZIP-compatible exchange package used for backup, archive, email, templates, examples, selective component exchange, and future marketplaces.

Every package contains `package.json` plus selected project files. The package manifest identifies the package kind, source project format, creation metadata, included scopes, rights confirmation, and a SHA-256 checksum for every file. Git history and credentials are excluded.

Supported package kinds are complete project, screenplay, dialogue, character, production breakdown, structural analysis, reference only, and template.

## Screenplay PDF import

The native-text path is:

`PDF → text extraction → screenplay confidence analysis → structured preview → project folder → optional full or selective .ppf`

The analyzer recognizes scene headings, character cues, dialogue, parentheticals, action, transitions, title-page conventions, and page boundaries. Low-confidence documents are not silently converted. Scanned or image-only PDFs are reported as requiring OCR and manual review. OCR is deliberately not performed automatically.

Every extracted element carries source filename, PDF page, import time, confidence, and an unreviewed status. Inferred characters, locations, production candidates, and 24-Block mappings remain unapproved until a writer reviews them.

The user must confirm that they have the right to access and import the document. Import does not grant redistribution, publication, or commercial exploitation rights.

## Safety boundaries

- no path traversal on import
- no hidden database
- no credentials or `.git` directory in packages
- no automatic canon approval
- no automatic OCR
- no redistribution permission inferred from import
- original PDF is optional reference material, never the working screenplay
