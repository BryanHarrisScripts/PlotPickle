# 2763 Phase 3 — Optional image-to-video motion generation

Phase 3 adds a distinct optional motion path to Timeline without changing the Phase 2 still-image baseline.

Each placed Mini-Block keeps its 25 locked Storyboard Images as authoritative source stills. A Timeline Shot can additionally own one persisted motion-job record keyed to the placement, Shot number, source artifact and source key. Upstream image changes make existing motion stale instead of silently reusing it.

Motion prompts are built from the selected locked image, mapped screenplay evidence, Mini-Block dramatic responsibility, the image's recorded narrative intention and the 25-position Shot progression. The approved first frame is treated as the strict visual and character reference. The prompt instructs the provider to preserve identity, wardrobe, props, geography, composition, lighting and screen direction and to add only story-grounded subject/environment/camera motion.

Generation remains provider-neutral through /api/local-ai/generate/video and /api/local-ai/video/:id. Timeline preflights the active route before asking for consent. The current automatic local LTX plug-in is text-to-video only and is therefore rejected for this Phase 3 image-to-video path. Local H3 is accepted only when its reviewed workflow family is image-to-video and ready. Configured cloud routes remain possible, but every Shot requires an explicit PlotPickle confirmation before the request is sent; there is no silent paid or cloud fallback.

Provider clips may have a provider minimum longer than three seconds. Timeline authority remains three seconds per Shot: motion playback seeks and clamps within the first three seconds, preserving the 25 × 3-second = 75-second Mini-Block contract. The generated file is never allowed to redefine story timing.

Queued/running/failure/success state is saved in the project. Successful local output remains linked to its job/provider/model/source provenance. Failed or stale motion is visible and retryable. Motion playback never silently substitutes the still image; the user can explicitly switch back to Still images.

Acceptance evidence for this build: focused contract tests, production/architecture gates, and exact-head CI. A real representative image-to-video generation still requires a ready user-selected image-to-video route and explicit Human authorization. No paid request or model download is performed by this implementation or its tests.
