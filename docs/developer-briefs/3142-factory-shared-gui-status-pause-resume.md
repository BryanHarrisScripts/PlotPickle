# #3142 — First shared CMD/GUI Factory supervisor controls

**Phase:** authenticated local Settings Status/Pause/Resume, not a complete persistent Software Factory.

## Reuse and authority

The existing `scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs` is the **only local lifecycle authority**. The existing CMD calls `--status`, `--pause --consent ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR`, and `--resume --consent ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR`. PlotPickle Settings → General now offers **the same operations**, not a new worker or second persistence store.

`app/api/factory/supervisor/route.ts` is a nodejs-only, **desktop-loopback-only** authenticated Human-profile boundary. Read access authorizes an existing session. Mutation requires the same session's CSRF plus **recent reauthentication**, verifies same HTTP origin, rejects cross-origin, unsupported methods and non-local platforms, and uses fixed server-held consent. Client-supplied paths, PIDs, commands, job IDs, remote URLs, model grants and merge authority are never accepted. `scripts/engineering-team/windows/supervisor/supervisor-http.mjs` is the shared bounded HTTP adapter; it calls the existing supervisor methods only and reports sanitized states and SHA without raw private files, story text, tokens, account names or worker PIDs.

The GUI explicitly distinguishes a **request** from a worker-acknowledged PAUSE, stale/absent heartbeat, and a blocked supervisor. UI controls do **not** start a worker, confirm descendant STOP, dispatch coding, spend provider credits, modify story canon or merge pull requests. These intentional non-claims remain visible in the real Settings interface.

## Proof

Runtime boundary fixtures check explicit authentication before any local read, same-origin/loopback, unsupported action/PID/shell/merge refusals, bounded output, and direct existing-supervisor linkage. Existing `tests/issue-3110-persistent-local-supervisor.test.mjs` tests actual local pause/resume and STOP precedence, including native Windows CI. The impact-selected Windows job runs both suites; architecture verification and product/build gates test the Settings source. W8/W9 source bindings are updated without weakening admission.

**Not yet proven:** owner-host GUI-driven pause/resume against a running supervisor, persistent logon/crash/reboot worker, a verified process-tree STOP with unrelated sentinel, a unified Start/Stop operator GUI, or the ChatGPT-only coding dispatcher. No claim of automated backlog drain. #3142 stays OPEN.

## Next acceptance

Verify the real Settings panel in a Human-authenticated Windows browser, click PAUSE and RESUME against one explicitly opted-in supervisor, observe the same CMD status and durable markers, then test actual process ownership/crash-restart and installer policy. A further bounded PR may add a truly operator-authorized native start/stop lifecycle only when descendant cleanup and release of the original paused/started worker have independent evidence.
