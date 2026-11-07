---
name: plotpickle-animatic
description: Build, validate and render draft PlotPickle image-to-animatic MP4 previews from a saved PPF project and portable image assets with exact frame timing, explicit gaps, project revision proof and measured FFmpeg output. Use for animatic, rough cut, shot timing, storyboard video and render requests.
---

# PlotPickle — Draft Animatic Bridge (v0.8.3)

This capability packages a read-only project-to-production-manifest compiler and an optional FFmpeg-backed 24 fps renderer. It does not change the screenplay, project revision, image approval or Save/Lock states. ChatGPT remains the creative workspace; this skill has no background worker and no assumption that FFmpeg or private media are installed or accessible. Before using project data, follow the PlotPickle project source/identity policies in `../read-plotpickle-project/SKILL.md`.

## Input authority

The input is the user's actual current saved `.ppf.json`, plus its separately supplied portable `assets/` directory when rendering. The plugin package MUST NOT embed a particular user's screenplay or artwork. Compute and preserve source SHA-256. The runtime editorial plan and image assignments are read from project records, not reconstructed from chat or numbering alone. The script supports the `assetRegistry.extensions.projectModel.runtimePlan.physicalShots` model. It needs one canonical 4-Act shot address per editorial shot and an explicit whole-frame duration at 24 fps. Variable durations do not change the 2,400-position organizational scaffold.

Current image assignments come from the project's historic artwork mapping overlaid with the newer `storyWorkflow.imageMappings` edits. Superseded/rejected entries must not replace current ones. A missing mapping becomes an explicitly labelled draft gap. Current visual approval and native saved/locked status are retained as separate fields; a draft render never promotes them to approved canon.

## Run

Execute from this skill's directory, with Python 3; only the Python standard library is required for manifest creation and validation. FFmpeg and ffprobe must be on the host PATH for MP4 rendering.

    python3 scripts/animatic-bridge.py manifest --project /path/to/story.ppf.json --out /path/to/animatic-manifest.json
    python3 scripts/animatic-bridge.py validate --project /path/to/story.ppf.json --manifest /path/to/animatic-manifest.json --assets-root /path/to/story-package
    python3 scripts/animatic-bridge.py render --project /path/to/story.ppf.json --manifest /path/to/animatic-manifest.json --assets-root /path/to/story-package --out /path/to/draft-animatic.mp4

The `assets-root` directory contains a nested `assets/` directory, not the image directory itself. `--project` is mandatory at validation and render time to detect project revisions that postdate the manifest. File content hashes must match. These commands fail closed when media are missing. For a draft preview only, add `--allow-gaps` to validate/render to generate explicitly identified missing-image slates. Omit this flag for complete-media acceptance tests.

An optional editable, revision-specific cue file adds *source-linked* captions and title cards:

    python3 scripts/animatic-bridge.py manifest --project story.ppf.json --cues editorial-cues.json --out animatic-manifest.json

Cues have `schema: plotpickle.animatic-cues.v1`, a `captions` mapping from physical shot ID to screenplay dialogue passage IDs, and `cards` with `shotId`, `position` (`before` or `after`), `text`, and integer `frames`. Captions use the actual saved passage text, never invented or transcript-corrected text. See `references/animatic-workflow.md` and `references/editorial-cues-example.json`.

## Trust and acceptance

1. Inspect project ID, revision and SHA, verify the project belongs to the current user/story and report where the editorial plan revision is stale. Never silently treat the plan as recertified after a newer project edit.
2. Manifest preparation must be reversible and deterministic. A manifest is a separate output; the source PPF stays unchanged. Review all candidate assets, gaps and pending approvals before proceeding.
3. Run `validate` with actual bytes present; no evidence of image availability may be inferred merely from asset registry metadata. If images are missing, be explicit and do not claim the full film was re-rendered.
4. Render only when the host supports local Python plus FFmpeg/ffprobe and the user has provided the media package. The output is a 24-fps draft MP4 with H.264 picture and a silent AAC track. The renderer verifies frame count, dimensions, duration tolerance and complete decode, and emits a separate receipt with the file hash. It refuses to overwrite an existing file.
5. A successful draft export is not a completed movie, performed dialogue, verified synchronization, approved master, media license grant, or native Save/Lock state.
6. Tests: `python3 scripts/test-animatic-bridge.py`. The suite covers source binding, missing media, checksum mismatch, unsafe paths, captions, exact frames and actual FFmpeg full decode when the binaries are available.

## Brotherly Love acceptance example

The recovered historical checkpoint is Brotherly Love revision 539. Its runtime plan is based on revision 538, with 123 physical edit positions totaling 17,238 frames (718.25 seconds) at 24 fps, including one explicitly missing-image position. The earlier 745.25-second animatic included 27 seconds of presentation overhead. Those additional cards/captions are editorial material; their exact previous cue allocations are not embedded in the saved project and must be supplied or recovered before claiming an identical render. The plugin does not bundle these private project bytes or images. A successfully generated manifest proves read-only timing extraction; complete MP4 reproduction requires the actual assets and editorial cues.

For other creative work (writing, learning, model reasoning) use `../plotpickle-creative/SKILL.md`; for PPF import, saved truth and guarded revisions use `../read-plotpickle-project/SKILL.md`. Neither an animatic receipt nor a conversation response makes a new PPF revision.
