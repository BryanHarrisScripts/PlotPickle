# 2763 Phase 4 — assemble the opening movie range

Phase 4 turns the existing Timeline placement revision into a recoverable opening-movie assembly. It does not create another story or editing authority.

The assembly begins with the first complete placed Mini-Block and appends only complete consecutive Mini-Blocks in canonical story order. One Mini-Block remains 25 locked Shots × 3 seconds = 75 seconds. The bounded opening range is one to four Mini-Blocks, so four Mini-Blocks remain exactly one 5-minute Block: 100 Shots and 7,200 final frames at 24 fps.

The existing Mini-Block FFrames request stays capped at 25 frames. Phase 4 adds a separate Timeline-range request capped at 100 frames and requires complete 25-frame Mini-Block units. The lower-level FFrames bridge may accept up to 100 staged frames so the dedicated range request can render the opening block, while ordinary Mini-Block callers remain contractually capped at 25.

Range export uses the locked still-image presentation as the deterministic baseline. Every source frame retains the owning Timeline revision, placement, Mini-Block anchor and Storyboard artifact in sourceRefs. Written narration can be included only when the saved Phase 1 narration approval is still current; otherwise narrated export stops. Generated motion remains an optional Timeline playback layer and is never silently substituted for failed or absent motion.

A successful range export is persisted as TimelineRangeExport evidence with the exact Timeline revision, ordered placement IDs, source keys, narration mode, local MP4 reference, duration and 24 fps contract. Reloading the project can therefore recover which exact assembly produced the saved movie file.

The render path remains local and Human-session authorized. FFrames unavailability, stale placements, missing frames, stale narration or missing output all remain explicit failures. No cloud rendering, paid request, sound generation or new model download is introduced by Phase 4.

Verification target: focused Phase 4 contract tests, existing #2663/#2664 FFrames tests, architecture ownership/convergence, the impact-selected Media / FFrames Windows product proof, and exact-head GitHub gates. Product acceptance still includes opening the retained MP4 outside the app and confirming its expected duration/order and absence of unintended audio.
