# #2832 Shared profile Save work

Parent: #2821. This delivery repairs the confirmed persistence bottleneck; actual
comic bubbles, narration and provider motion remain the parent's acceptance goal.

## Cause and outcome

The Library change listener and explicit durable Save each requested a complete
profile inventory write. One image decision in a five-story Library performed ten
project writes and two index syncs. All requests serialized before UI confirmation.

Automatic persistence and explicit Save must share an identical pending target's
acknowledgement. Persist only project snapshots whose exact content or summary
changed. Never rely on revision alone, because existing owners can save content
without advancing it. An explicit Save retry of already-saved content still
confirms that story through the encrypted backing store.

## Existing owners and repair

- `project-library-browser.ts` exposes exact cached snapshot bytes so comparing
  unchanged stories does not repeatedly parse/normalize them.
- `profile-private-browser.ts` keeps session-local acknowledged snapshot/summary
  identities and coalesces identical in-flight Library targets. It normalizes only
  snapshots actually being written and preserves serial requested decision order.
- `revision-safe-browser.ts` explicitly requests acknowledgement of its saved
  project. A matching automatic write supplies the same acknowledgement. A late
  confirmation cannot join an operation that already skipped that project.
- Seed acknowledgements only after successful encrypted hydration. Record each
  successful project write, retry failed writes/index syncs, and clear all tracking
  when profile authority changes. Check authority after awaited requests so an
  obsolete operation cannot continue syncing the index or seed new authority.
- Library index sync remains segmented and runs after relevant project writes.
  Archive/activation/unload changes still reach the backing store. No API or vault
  encryption/security boundary changes are needed.

## Scope and exclusions

Keep project IDs, artifact URLs, saved markers, locks and authored content intact.
Current main already contains #2831's Outline Lock/Unlock repair; do not duplicate
it. No provider inference, paid generation, credential changes, storage migration
or optimistic success labels are introduced by this delivery.

## Acceptance and evidence

1. In a five-story Library containing two archives, one real packaged Afterglow
   Save/Lock produces one project write and one index sync.
2. Identical automatic/explicit requests share a pending promise and wait for the
   encrypted response; unrelated project snapshots are never rewritten.
3. Same-revision edits persist and delayed successive decisions retain order.
4. Failed project/index writes remain blocked and succeed on explicit retry.
5. An explicit confirmation after automatic skipping still writes its own story.
6. Unload/rehydrate preserves exact media identity, saved marker and accepted state;
   selecting unchanged hydrated stories does not rewrite their snapshots.
7. Authority release prevents obsolete index/acknowledgement updates.

`tests/issue-2832-profile-save-work.test.mjs` executes these paths against the real
local HTTP auth/CSRF gateway, browser Library owners, encrypted vault and committed
Afterglow snapshot. Only DOM storage primitives and injected failures/delays are
test substitutes. Existing #2821 regressions retain failed-write logout protection.

The rendered #2821 product proof now clicks real Storyboard controls using a
committed Afterglow image and story evidence in an isolated five-story verification
profile. It counts Save/Lock requests, checks truthful failure feedback, retries
and reloads. Windows Product Gate independently reruns both this proof and #2832.

Required verification: focused regressions, focused UAT contracts, production
build, development convergence and exact-head GitHub gates. Two prior Foundations
UAT assertions were confirmed failing on unchanged main after #2829 moved media
guards into the shared asset contract; they now assert that canonical owner and
both supported prefixes. Two prior #2774 resume tests likewise now describe the
existing explicit read-only summary/confirmed-resume behavior. No related runtime
behavior was changed to accommodate these assertions.

Parent #2821 remains open until Bryan's real Windows comic/narration/motion and
reopen acceptance succeeds. Green engineering evidence does not certify a paid
provider clip or the latency of Bryan's machine.
