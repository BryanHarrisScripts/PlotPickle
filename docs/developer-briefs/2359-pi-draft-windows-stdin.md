# #2359 Pi Draft Windows prompt transport

## Outcome and cause

After Interpret locks an intent, Pi Draft must accept multiline Human text and return a read-only technical brief on Windows. The existing runner places the complete prompt in argv. For a `.cmd` launcher, `windowsBatchInvocation` correctly rejects newlines and shell metacharacters, and its error includes the rejected value. Normal DSDD prompts therefore fail before Pi runs and may be repeated in the visible error.

## Bounded implementation

Use the existing `scripts/pi-worker-runtime.mjs` process boundary. Send the Pi read-only prompt as UTF-8 stdin, close stdin, and retain only fixed flags and approved runtime values in argv. Close stdin for noninteractive commands without input as well. Preserve command failure, timeout and pipe-error rejection. Keep the Windows batch guard, provider abstraction, tool restrictions and installation policy unchanged.

Export the existing draft formatter with an import-safe entry point for direct regression coverage. The gateway supplies one locked Human statement, one interpretation, one context object and the locked requirements; the formatter does not replay conversation history. Repetition already present inside Human or model-authored text is preserved, not silently rewritten.

Align the existing #2331 handoff test with #2357's already-shipped numbered steps and removal of Clear Draft. Preserve its non-mutation assertions; do not change the user interface to satisfy stale copy expectations.

## Acceptance and evidence

1. Multiline text containing quotes, CRLF, Unicode and shell metacharacters reaches the child unchanged through stdin. A roughly 48 KB prompt must arrive once, outside argv and batch environment values.
2. Pi retains `read,grep,find,ls`, `--no-session`, and disabled extensions, skills, prompt templates and themes. The existing Interpret / Pi Draft / Publish Brief authority boundaries remain intact.
3. Empty input sends EOF; launch failure, early pipe closure and timeout reject without attaching the input to command errors.
4. The formatter includes each distinct intent field once and excludes supplied conversation history.
5. The new executable regression runs within the existing Layer 4 catalogue and existing Windows Product Gate. Map the shared runner to the existing agent-runtime owner and Windows proof scope so future edits cannot bypass this verification. On Windows the regression launches a real `.cmd` shim; locally on Linux it launches a Node fixture. Neither fixture calls a model.

Run the four focused files: `issue-2359-pi-draft-stdin`, `issue-2354-dsdd-pi-draft-publish-brief`, `issue-1185-pi-windows-resolver`, and `issue-1382-workbench-pi-stdin-eof`, all under `tests/` with the `.test.mjs` suffix. Also run focused UAT contracts, the production build, and the convergence evaluator. Record existing baseline failures separately. Convergence checks the declared scope and evidence references; executable tests and Windows CI establish behavior.

## Human UAT and remaining limits

On Windows, enter multiline narration, run Interpret, then Pi Draft. Confirm that one brief appears without the batch-character error, the captured intent remains unchanged, and no source mutation or Issue publication occurs until the appropriate explicit action. Test with the configured local provider. Automated transport fixtures do not establish live model quality or resolve repetition originating in transcription/model output. The five-stage visual-flow redesign and reusable MCP idea remain separate work.
