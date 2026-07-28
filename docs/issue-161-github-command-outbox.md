# Issue #161 — Phase 6A explicit GitHub commands and durable outbox

Phase 6A replaces the proposed browser-wide recovery interception with a small server-side command foundation. It does not change the PlotPickle interface and it does not reroute existing GitHub gateways yet.

## Command boundary

Every future GitHub write will be described as one explicit PlotPickle command before execution. The supported command types cover canonical project publishing, release snapshots, Story Proposals and collaboration-policy changes.

The command service:

1. validates repository, branch and project identity fields;
2. recursively rejects credential-shaped payload fields;
3. calculates a deterministic SHA-256 payload hash and idempotency key;
4. writes the command to the durable outbox;
5. marks it as sending;
6. records completion or a classified failure.

The command is **written before execution**, so a process interruption cannot silently erase the user's intent.

## Local storage

The outbox is a human-readable, non-secret JSON file:

- Windows: `%LOCALAPPDATA%\\PlotPickle\\github\\outbox.json`
- macOS and Linux: `~/.plotpickle/github/outbox.json`
- Tests and portable setups may override the root with `PLOTPICKLE_HOME`.

Credentials remain separately protected in the existing `secrets` directory. The outbox rejects tokens, authorization headers, passwords, private keys, client secrets, cookies and similar fields before disk storage.

## States

Commands use a deliberately small state machine:

- `pending`
- `sending`
- `completed`
- `retryable`
- `needs-authentication`
- `needs-review`
- `cancelled`

Offline, temporary and rate-limited failures receive bounded retry timing. Authentication failures stop for reconnection. Conflicts, changed branches and invalid requests stop for human review.

## Boundaries

- **No browser interception.** Phase 6A never replaces `window.fetch`.
- No Recovery Centre or other interface changes; that belongs to Phase 6B.
- No repository rename adoption, deleted-branch recreation or conflict-resolution interface; those belong to Phase 6C.
- Existing synchronization and proposal gateways remain unchanged until the command contract has passed full regression validation.

## Adoption path

Phase 6B will expose the outbox through a passive Recovery Centre and explicit retry/cancel actions. Phase 6C will add guarded repository maintenance and conflict-review candidates. Existing GitHub write gateways will then migrate one operation at a time to `runGitHubCommand`, preserving their established semantic merge and authorization controls.
