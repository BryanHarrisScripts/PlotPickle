# PlotPickle 0.15 — Phase C Specialist Labs

Phase C adds controlled specialist workspaces beside the canonical schema 1.7 project. A lab may read any relevant project context and may prepare a suggestion, comparison or provenance record, but it cannot change the story until the writer explicitly approves the pending review.

## Shared approval contract

Every lab follows the same sequence:

1. Read the active locally saved PlotPickle project.
2. Prepare a temporary suggestion or structured record.
3. Show the current value and proposed value side by side.
4. Let the writer approve or discard it.
5. Apply only the approved change.
6. Store the before/after evidence in a canonical revision snapshot.
7. Add source or AI provenance when applicable.

The pending suggestion exists only in the lab interface. It is not written to local storage, the screenplay, the story model, the rights binder or revision history before approval.

## AI Prompt Lab

The Prompt Lab assembles bounded canonical project context and asks the connected provider for a reusable story-development prompt. The result is not automatically executed. Approval stores the prompt as a specialist pass and records the provider interaction through the existing AI provenance model.

Prompts instruct assistants to preserve writer control, distinguish established project facts from suggestions and avoid changing the project automatically.

## Dialogue Lab

The Dialogue Lab selects one existing screenplay action, dialogue or parenthetical element. It combines the exact text with current character voice, story and scene context, then returns a proposed alternative.

The writer sees the original and suggestion together. Approval replaces only the selected stable screenplay element, updates its timestamp, records the AI provenance and stores the before/after pass in revision history.

## Structured Research and Canon Binder

The binder separates source information from story canon. A prepared entry includes:

- source or canon title;
- creator or authority;
- URL;
- licence or permission information; and
- the exact verified finding or canon decision.

Approval adds a canonical source-attribution record and updates the existing research and source notes. AI-generated claims are not treated as verified research merely because an AI produced them.

## Visual Bible and Mood Boards

The Visual Bible reads the existing visual language plus character, location and storyboard images already attached to the project. These images form the live mood board rather than a second asset library.

A proposed visual-bible pass can define palette, contrast, texture, lighting, lenses, framing, recurring imagery and continuity rules. Approval updates the canonical world visual-language field, records provenance and saves the comparison.

## Prompt and generated-asset provenance

The provenance lab records:

- provider;
- model;
- operation;
- prompt summary;
- retained output or asset description;
- local path or asset URL when available;
- human contribution; and
- human approval decision.

API keys and access credentials remain outside the canonical project and are never included in provenance records.

## Saved specialist passes

Approved passes are embedded in normal schema 1.7 revision payloads. Each pass retains:

- lab type;
- title and purpose;
- target field or screenplay element;
- before value;
- approved after value;
- prompt or writer direction;
- whether AI assisted the suggestion;
- approval time; and
- linked provenance identifier.

Because the pass is stored inside revision history, it travels with exported PlotPickle projects and can be reviewed without introducing a parallel specialist database.

## Completion standard

PlotPickle 0.15 completes Phase C when every specialist lab:

- reads the same canonical active project;
- produces a reviewable temporary suggestion or structured record;
- shows meaningful before/after evidence;
- applies nothing without explicit writer approval;
- records source or AI provenance where applicable; and
- preserves approved passes in canonical revision history.
