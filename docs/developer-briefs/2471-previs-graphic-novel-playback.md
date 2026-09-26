# Developer Brief — #2471 Previs readable Flip Book + Graphic Novel playback/export

## Human intent

The existing Previs Flip Book is visually useful but its 220ms playback flickers too quickly. Keep that plain visual mode, slow it to a readable pace, then add a second Graphic Novel playback mode that uses the same locked Storyboard sequence with concise derived narration so a viewer can follow story progression. Add a local Export Graphic Novel action for the selected Mini-Block.

## Phase 1 — readable Flip Book

- named 900ms Flip Book presentation interval;
- Previous/Next and 25-position wrap remain;
- manual navigation stops playback;
- playback timing never writes production/story timing.

## Phase 2 — Play Graphic Novel

- named 3000ms Graphic Novel interval;
- mutually exclusive with Flip Book playback;
- show a compact comic/graphic-novel caption treatment over the same selected frame;
- narration derives from existing Scene evidence, Storyboard narrative intention, deterministic Beat Detail and mapped Shot intent;
- no LLM/provider requirement;
- no invented dialogue or canonical Beat.

## Phase 3 — Export Graphic Novel

- export the selected Mini-Block as local HTML using absolute loopback asset links;
- ordered 25-position presentation;
- only Keep/Locked images are authoritative panels;
- review/missing positions are visibly omitted;
- use only locked local image URLs and preserve caption text if an image is unavailable;
- clearly state that images remain linked to the local PlotPickle installation;
- no PPF/canon/approval mutation.

## Phase 4 — verification

Layer 1 protects the Previs/Matrix presentation and WebMCP-visible controls. Layer 5 proves derived narration/export do not mutate story canon or Storyboard Human approval. Existing #2456, #2458 and #2466 semantics remain green.

See GitHub issue #2471 for the full acceptance contract.
