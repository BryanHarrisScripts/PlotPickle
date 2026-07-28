# Issue #163 — Phase 6B passive GitHub Recovery Centre

Phase 6B exposes the Phase 6A command outbox through a local-only API and a passive dashboard inside the existing GitHub collaboration workspace.

## Safety model

- The browser receives public command metadata only. Command payloads and credentials never leave the local server process.
- The Recovery Centre does not replace `window.fetch`, install a background retry timer or replay GitHub writes automatically.
- **Mark ready to retry** changes an eligible `retryable` command back to `pending`. The user must repeat the originating PlotPickle action.
- Authentication failures require a new green GitHub Ready check. After the server verifies that protected connection state, the user may explicitly mark the command `pending`; review-required failures remain stopped for a human decision.
- Cancelling a command retains its non-secret audit entry. Sending, completed and already-cancelled commands cannot be cancelled.

## Local API

- `GET /api/local-github-commands` returns a public summary and public command entries.
- `POST /api/local-github-commands/:id/retry` marks a retryable command ready, or prepares an authentication-blocked command only after the server verifies a green connection.
- `POST /api/local-github-commands/:id/cancel` cancels one eligible command.

All endpoints accept loopback requests from the same local PlotPickle origin only and return `payloadsExposed: false`.

## Interface states

- Green: no recovery work is waiting.
- Amber: pending, sending or retryable work exists.
- Red: reconnect GitHub.
- Purple: human review is required.

Repository adoption, branch recreation and conflict-resolution tools remain Phase 6C work.
