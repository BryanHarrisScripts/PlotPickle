# Issue 2911: Settings profile unlock and session verification

The October 11 Windows report records HTTP 403 saving MiniMax authority, with no accessible Settings unlock action. Reuse the existing passphrase login, session boundary and encrypted profile storage. Do not infer a vault lock from a missing session.

Assessment found two concrete gaps: Settings cannot reauthenticate inline, and the cloud authority endpoint is absent from the local profile gateway that owns the login runtime. Like the existing narration endpoint, it must share that runtime instead of authorizing against an independent RSC graph. Cloud authority mutations must obtain current CSRF proof through the shared browser fetch abstraction.

Implement shared Settings/General and provider-setup status, known vault state and recorded cleanup reason/time, session idle/absolute expiry, passphrase unlock followed by authoritative GET/readback and same-profile browser-token refresh. Preserve working story data and provider inputs. A failed status refresh must never report success. Wrong credentials retain accurate retry. Keep all existing origin, session and CSRF gates.

Diagnostics are session scoped for remote access; signed-out remote callers receive no vault inventory. Desktop loopback uses the existing safe chooser inventory. Cleanup history is process-local: missing reason/time, including after a runtime restart, must be Unknown. No credentials or story data appear in diagnostic fields.

Validation: real local gateway synthetic-profile wrong/correct unlock, current and invalid session, CSRF/origin rejection, provider authority save and encrypted readback after runtime reset. Existing session-expiry tests remain required. Add rendered inline unlock/failed refresh observation before product completion. Run focused UAT contracts, build and exact-head CI. Synthetic runtime restart is not Bryan's Windows process-stop/start proof.

Execution order remains 2911, 2863, 2855, 2830. Actual Windows provider key persistence, missing-image restoration, actual configured narration, Storyboard/Previs parity and paid Shot 1 motion remain separate attended acceptance. No live key or paid generation is used by these tests.
