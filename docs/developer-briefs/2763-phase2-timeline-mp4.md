# 2763 Phase 2 — Timeline still-image silent MP4

Issue #2763 Phase 2 keeps Timeline as the assembly/export owner while reusing the approved Previs sources and the existing local FFrames media-engine boundary.

The selected Timeline Mini-Block remains exactly 25 locked Storyboard Images in Shot order. Playback and export use three seconds per Shot, for a 75-second silent Mini-Block at 24 fps. Timeline does not generate new images, motion, dialogue audio, music or sound effects.

Written narration is a presentation mode. Timeline reuses the Phase 1 Previs narration approvals only when their source keys still match the saved image, screenplay evidence and story context. Silent panels remain silent. If narration is stale or absent, narrated export stops and directs the Human back to Previs rather than inventing replacement text.

MP4 export sends the 25 authoritative local images and the selected written overlays through the existing FFrames local renderer. The FFrames bridge now carries caption/narration strings into the rendered frames while keeping AudioMap::none(). Plain export sends no overlays. The output is accepted only when FFrames reports succeeded and returns a retained MP4 path; fallback, unavailable runtime, missing source media or any failed render remains an explicit export failure.

Verification target: focused #2763/#2664 Timeline and FFrames contract tests, Rust bridge compilation in the applicable gate, production build, exact-head GitHub checks, and a running Windows pass confirming that the resulting MP4 is decodable, contains all 25 Shots in order, lasts 75 seconds, has no audio track, and matches narration on/off selection.
