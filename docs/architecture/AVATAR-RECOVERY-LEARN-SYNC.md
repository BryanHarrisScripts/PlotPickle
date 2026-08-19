# Avatar Recovery and Cross-Device LEARN Sync

Status: Phase B implementation contract for #1071 / #1073.

Phase A (#1072) established identity authority. Phase B implements the transport-neutral state machine that authenticated desktop, web and future mobile clients use to claim/adopt one public Avatar, authorize or revoke independent Nodes, and reconcile the narrow LEARN state that is safe to carry between devices.

This does not make PlotPickle login-first. Local LEARN, PLAN and BUILD continue without an account. The account/sync core is entered only after an explicit sharing/network action has authenticated the user through a future or existing account transport.

## Identity behavior

The Phase B core preserves the Phase A rules:

- one `person_id` owns at most one canonical public Avatar;
- each Node is authorized separately and contributes only its public Ed25519 key to account state;
- Node private keys remain local and are never part of account or LEARN sync state;
- revoking one Node does not delete the person, Avatar, other Nodes or Community history;
- a second device with a conflicting local Avatar draft adopts the canonical Avatar and keeps its local draft unchanged for an explicit later writer decision.

The current #927 `pp_studio_XXXXXXXX` installation identity remains a valid compatibility `node_id`. Phase B does not rotate or copy its key.

## Transport-neutral by design

`core/identity/account-learn-sync-core.mjs` is the executable authority/reconciliation engine. `core/identity/account-learn-sync.ts` provides the typed application boundary.

The engine accepts a PlotPickle-owned `person_id` that has already been authenticated by the caller. It does not choose Better Auth, OAuth, passkeys, a cloud database or BUZZ as the account database. This keeps authentication replaceable and prevents Phase B from opening an unauthenticated network endpoint merely to demonstrate sync.

A server, mobile app or web client may persist and exchange these records through an authenticated transport. The merge result is deterministic independent of which transport carried it.

## Portable LEARN allowlist

The portable state is deliberately smaller than PPF:

- active lesson and its cursor timestamp;
- completed lesson IDs;
- bookmark timestamps;
- versioned writer notes;
- versioned portable curriculum answers;
- visible Sage writer/guide conversation continuity only;
- lesson content/version markers;
- lightweight Visual Writer frontier metadata.

The engine rejects top-level fields that look like credentials, provider tokens, filesystem/local paths, unrestricted PPF, BUILD prompts or hidden/system reasoning. User text fields also reject private-key PEM material.

Provider credentials, Node private keys, local paths, model state, unrestricted PPF/project content, BUILD assets/prompts and hidden reasoning are not portable LEARN state.

## Deterministic reconciliation

Completion is monotonic: completed lesson IDs merge by union. Completing the same lesson on two devices therefore cannot undo progress.

The active/resume cursor uses its explicit `activeLessonUpdatedAt` timestamp. The newest explicit cursor wins, while completion remains the union of both clients.

Bookmarks keep the newest timestamp for each lesson.

Writer notes and portable curriculum answers are append/version records. Concurrent offline edits with different `versionId` values are both preserved; Phase B does not silently replace one writer-authored value with another.

Visible Sage continuity deduplicates by message ID and orders by creation time. Only `writer` and `guide` messages are accepted; system/hidden roles are discarded.

Lesson-version disagreement is reported as `lessonVersionConflicts` instead of pretending two curriculum revisions are identical. Completion is preserved while a caller can explain the version mismatch to the user.

The Visual Writer frontier uses the newest explicit frontier timestamp and carries only lightweight progress metadata, never BUILD artifacts.

## Two-client resume example

Client A has completed World 01 and is on World 02.

Client B goes offline, completes World 02 and World 03, then reconnects with World 03 as its newer cursor.

The canonical reconciliation produces completed World 01, 02 and 03 with World 03 as the current cursor. `nextLearnActionLessonId()` returns World 04. Client A can apply that portable state back to its local project and resume from the same frontier.

`applyPortableLearnStateToProject()` mutates only `project.learning`, the project revision and update timestamp. Foundations, World, BUILD, creative-room and other project truth are preserved untouched.

## Revocation and logout

Every sync reconciliation can be gated with `reconcileForAuthorizedNode()`. A revoked Node is rejected before state is merged. Another authorized Node continues normally.

Signing out of an account should stop future transport/sync calls on that client but must not delete local creative work. Node revocation is an account authorization action, not a project deletion action.

## Phase boundary

Phase B supplies the executable identity/recovery/LEARN portability core and deterministic multi-client tests. It intentionally does not add:

- mobile-specific UI;
- an unauthenticated public sync endpoint;
- a mandatory cloud account provider;
- unrestricted project/PPF synchronization;
- remote BUILD or public compute;
- copied Node private keys.

Phase C (#1074 / the consolidated mobile brief where applicable) may consume this core for phone LEARN + Community. Later web/remote-node phases may consume the same account and Node authorization model without changing the identity authority established by #1072.
