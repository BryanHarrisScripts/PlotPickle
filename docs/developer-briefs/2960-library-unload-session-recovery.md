# #2960 — Library Unload: Human session recovery without losing a story

## Observed truth and uncertainty
October 12–13 Windows: Library Unload returned "The authentication request could not be completed"; the story remained loaded. Normal login after a restart later restored the saved Outline. This does **not** isolate a token-expiry root cause or prove the interrupted Unload recovered. The Human asked for an in-app authenticated recovery and explicit retry that leaves the working story intact.

Governing Human-approved authority: WHITE-PAPER-V3 W8/W9, PP-SAVE-001 T1/T6/T8 (honest Save/Unload claims; no unsafe departure with uncertain writes). No login or vault bypass, silent auto-Unload, transient guest project substitution, profile switching, credential logging, or false "saved" badges.

## Implementation
1. Before recovery-point creation or any index/storage mutation, revalidate the existing Human profile session and its refreshed CSRF against the **same** hydrated working profile; require the selected Library project identity to remain unchanged. Failure leaves story/session selection alone and shows a truthful issue plus a normal profile unlock panel.
2. Reuse the established ProfileSessionPanel passphrase/Verify Session controls and same-profile refresh path, without invoking a new sign-in shell, clearing browser project storage or discarding pending work. Update success wording to say "Library Unload", rather than "provider setup".
3. After the profile is verified, show **Retry Unload**. There is no automatic replay or navigation; on retry recheck the profile and story ID before making any write. If the profile or story changed, refuse and ask the Human to select the current story.
4. Preserve existing recovery-point → profile save → flush → detach → null-active save → flush order. Retain rollback to the original story if the second persistence step fails, and no Dashboard navigation on any failure. Authentication-specific failure gets a recovery path; ordinary storage errors do not pretend to be expired sessions.
5. Add pure contract and controlled execution of the actual Library handler with expiry, first-save rejection, after-detach rejection and rollback, successful Unload, non-auth error, and identity change negative controls. No live Human login or personal story content is used.

## Acceptance and limitations
This PR certifies bounded source-level and simulated-browser executable semantics, not a witnessed normal Windows passphrase session, private storage readback, after-restart restoration, or production login-gate diagnostics. White-paper CI admission, focused regressions, production build, BEN/convergence and all seven architecture layers must pass at the exact PR head before engineering merge. Carry normal authenticated Windows work, correct restoration of the saved Outline, refresh through real token expiry and returned Dashboard semantics to #2943. Never infer expiry from the observed generic error alone; a connectivity/status failure is likewise a recovery *candidate*, not a proven expired token.
