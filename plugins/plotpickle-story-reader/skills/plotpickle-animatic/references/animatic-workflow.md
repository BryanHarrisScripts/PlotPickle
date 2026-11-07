# Portable animatic contract — draft-preview-only

The saved PPF is source authority; the separate manifest is a deterministic read-only projection. Manifest identity carries project ID, revision and source SHA-256; shot records carry exact 4-Act planning addresses, whole-frame editorial durations, current image path/hash/ID/source passage IDs/approval and lock flags. Editorial plan revision is reported separately, with staleness explicit. Cards are non-shot presentation overhead, and source-linked dialogue captions are optional external editorial decisions.

A layout:

    MyStory/
      story.ppf.json
      assets/
        shot-001.webp
        shot-002.webp
      editorial-cues.json
      animatic-manifest.json
      preview.mp4

`manifest` uses the current PPF; `validate` resolves only relative `assets/...` paths and hashes actual media bytes. It blocks missing images unless `--allow-gaps` is explicitly chosen, producing clearly marked missing-image slates in draft mode. `render` does not rewrite the PPF. Outputs require a host with FFmpeg including libx264, AAC encoding, drawtext and ffprobe. It renders individual exact-frame segments, concatenates them, attaches a silent AAC track, verifies count/duration/full decode and returns a structured receipt. For very large projects, host CPU/storage may be significant.

No automatic fades, audio dialogue, voice synthesis, motion, lip-sync, music generation, native Lock parity, background execution or project-upload synchronization is included. Do not imply 24fps still-image video is genuine character animation. If a user asks for the earlier Brotherly Love picture cut, compare manifest totals and existing cue allocations first: 718.25 seconds of saved editorial shots does not by itself reproduce the prior 745.25-second output.

The optional cue format is:

    {
      "schema": "plotpickle.animatic-cues.v1",
      "captions": {"shot-id": ["screenplay-6"]},
      "cards": [{"shotId":"shot-id", "position":"before", "text":"ACT I", "frames":48}]
    }

All card frame counts are explicit. The referenced screenplay passage must exist with `type=dialogue`. A cue sheet is a user-reviewed editorial plan, not a screenplay rewrite. Source dialogue text is retrieved by ID; don't invent unavailable dialogue in a manifest. An expected count of 86 dialogue captions is a historical output fact, not evidence that their exact shot timing is recoverable from a different source.
