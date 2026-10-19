# #3121 — Windows live WebMCP owned STOP and disposable-profile cleanup

## Observed failure

Owner Windows UAT on 2026-10-18 at merged main `485d2ce9eff7a6137d50dae2a1c89a8c96d0d7ac` reached the rendered PlotPickle test application, but a required /skin-v1 request failed (`net::ERR_INSUFFICIENT_RESOURCES`; primary issue #3120). During verifier shutdown, synthetic-home removal failed with `EBUSY` on its managed ComfyUI startup log. Port 4173 was reported occupied at exit, but was free on a later independent read-only check. These observations are neither actual descendant STOP proof nor Story Factory journey PASS.

## Cause addressed, not yet native-proven

`scripts/verification-webmcp-live.mjs` previously sent `server.kill("SIGTERM")` to a spawned `npm run dev:local` parent and immediately closed the log and removed the test home. On Windows this does not establish exit of the child's descendants before deleting files they may still hold open.

Reuse the existing `terminateVerificationProcessTree` owned-handle helper from `scripts/full-verification-process.mjs`, rather than introducing a second PID authority or killing by port/process name. A bounded loopback-port reservation after shutdown is a cleanup safety check, not descendant proof. Refuse to start if the listener is already occupied, rather than attaching to unowned PlotPickle. Close log handles before synthetic-home removal and allow only bounded cleanup retry.

## Evidence and safety

- Only the verifier's in-memory spawned direct child handle is handed to the existing tree-stop helper.
- If known parent exit or loopback listener release is unverified, retain the isolated test home and emit a safe BLOCKED code. Never kill an externally supplied PID or a process inferred from the port.
- Failed synthetic-home cleanup retains the evidence, reports BLOCKED after three bounded attempts and cannot flip the original verification outcome to PASS.
- A genuine browser failure remains a failure even when cleanup succeeds. If cleanup independently fails, preserve that primary failure in the final summary.
- This slice makes no paid provider requests, canon decisions or mutations to the owner's saved story. It does not alter browser diagnostics or the allowlist to disguise #3120.

## Tests and limits

`tests/issue-3121-windows-live-verifier-cleanup.test.mjs` exercises fake owned child exit, occupied-port refusal, stop failure, log closing, success ordering and bounded retries. The existing #3118 test catalog entry carries the new contract test with WHITE-PAPER-V3 W8/W9 truth binding and reviewed source digests.

These are unit/static-source tests, not a real on-device Windows process-tree/sentinel test. #3121 remains open until a supported owner Windows live verifier proves the failure is resolved with private evidence. #3118 remains open until the complete named Story Factory journey and separately observed production browser-runner STOP satisfy their acceptance contract.
