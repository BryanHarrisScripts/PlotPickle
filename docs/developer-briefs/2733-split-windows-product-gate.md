# Developer brief — Issue #2733

## Problem

Architecture Verification currently routes a broad set of changes into one Windows Product Gate. On PR #2731 the reusable Product Gate ran for roughly 15.5 minutes even though the change was only a Settings taxonomy adjustment. A recent Pi/Command integration run (#2719) took about 21 minutes in the same Product Gate. The separate modular-runtime Windows proof measured about 8.6 minutes and is not the current >12-minute outlier.

The existing Pi scope mixes Settings/Command UI, Pi compatibility, Story Architect recovery, media/FFrames, voice, production build and installer concerns. That creates false-positive heavy work and serializes unrelated proofs on one Windows runner.

## Decision

Keep Architecture Verification as the single ordinary PR workflow, but make Windows product proof impact-selected by capability. The reusable Product Gate becomes six independent Windows jobs that can run in parallel:

1. Settings Command / Hunk
2. Pi runtime / Durable / MCP / Codemode
3. Story Architect / durable checkpoint recovery
4. Media / FFrames
5. Local voice / whisper.cpp
6. Windows production build / installer contract

Architecture Verification owns one scope detector that publishes a boolean for each lane, then invokes Product Gate once with those booleans. Manual Product Gate dispatch still runs every lane, but in parallel rather than through one serial monolith.

## Scope boundaries

A Settings taxonomy-only edit such as `app/skin-v1/dashboard-bbs-panel.tsx` must not activate Command, Pi, Story Architect, media, voice or Windows build merely because the file contains Settings navigation. Layer 1 and the focused Settings regression own that UI-only change.

Command/Hunk is selected only by Command implementation, DSDD Command integration, Hunk host/tooling or Command product-proof paths.

Pi is selected by managed Pi installation/compatibility, Durable adapter, MCP/Codemode/routing/governance, Pi policies and managed Pi state.

Story Architect is selected by Outline durable-task/application recovery paths and their native Windows proof.

Media is selected by FFrames/native media paths.

Voice is selected by whisper/local-voice paths.

Windows build/installer is selected by build system, package/runtime launcher or installer-contract paths rather than arbitrary application UI edits.

Workflow, regression and documentation edits are verified by focused CI contracts and do not automatically select every heavyweight Windows lane. A lane runs when the diff includes product/runtime paths that the lane actually proves.

## Performance contract

Every impact-selected Windows Product Gate lane has a 12-minute timeout. The normal target is materially below that ceiling. Splitting is not permission to remove proof: relevant proofs must move to the correct lane and remain exact-head.

## Acceptance

- Settings-only taxonomy work does not select unrelated Windows lanes.
- Command changes still run the native Command/Hunk proof.
- Pi changes still run compatibility, Durable, MCP, Codemode, routing, delivery and Pi Draft proof.
- Story Architect changes still run the real synthetic-provider application proof and checkpoint recovery proof.
- FFrames, voice and Windows build/installer retain their native proofs in independent lanes.
- Product Gate manual dispatch runs all six lanes in parallel.
- Selected lanes are printed in Architecture Verification logs.
- Every lane is capped at 12 minutes.
- The first PR using this layout records actual CI wall-clock timings and any lane at or above 12 minutes is treated as a failure to optimize, not as an accepted baseline.
