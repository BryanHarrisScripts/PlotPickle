# #3121 follow-up — Prevent optional managed ComfyUI during read-only WebMCP acceptance

## Owner Windows observation
The owner ran the isolated Story Factory UAT on exact main `3203d9f62dc76dd47afa867c6261dcbdf079779c` (2026-10-19). Startup/profile, 32 surface catalogue and Visual Director passed, but six actual project-continuity checkpoints were FAIL (tracked under #3123). Separately, `run-webmcp-startup-uat.mjs cleanup` failed three times with `EBUSY` on `logs/comfyui-managed-startup-error.log` inside that run's disposable synthetic profile.

Source identifies `scripts/start-comfyui-background.ps1` as the producer of the `comfyui-managed-startup-error.log` filename, using `Start-Process -RedirectStandardError` to launch optional media service Python, and `build/ai/comfyui-onboarding-gateway.ts` also attempts `launchComfyWithManagedCli()` before the PowerShell fallback. A managed ComfyUI service can therefore outlive a direct Vite server and keep a synthetic-home log open. The specific owner process/PID is not independently verified; this repair is a safety gate for the cause, not a claim of root-cause proof or native STOP PASS.

## Repair boundaries
Only when both `PLOTPICKLE_STARTUP_TESTING_MODE=webmcp` and `PLOTPICKLE_ACCEPTANCE_MODE=1`:
- The server's approved POST `/api/media-routing/comfyui/start` returns HTTP 409 with `acceptance-read-only` before calling any managed CLI or fallback.
- The Windows ComfyUI background starter refuses optional startup before `Start-Process` and returns `PLOTPICKLE_COMFYUI_STATUS=acceptance-read-only`.
- Normal Human-approved non-acceptance ComfyUI start and passive GET status are unchanged.
- No process is stopped by guessed PID, no vendor file is deleted, and no tests auto-approve, generate or spend on cloud providers.

## Validation
Append focused regression to existing #3121 test: confirm the acceptance flags in the live runner, inspect both code paths so the two guards precede all relevant launch statements, and preserve fail-closed existing Windows cleanup cases. Update WHITE-PAPER-V3 test-target and source-input digests, add an independent convergence manifest and run exact-head CI.

This does not prove already launched optional processes are owned or terminated, Windows file handles are gone, or the Story Factory project continuity defect is fixed. Do not close #3121 or #3118 without an owner native Windows retest showing no EBUSY, port release, and separate positive owned process-tree STOP proof; #3123 remains a separate failure.
