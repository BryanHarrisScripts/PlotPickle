# #3000 Phase 2 — direct Command connection operations

Human intent: continue #3000 after merged #3002 with direct provider testing, route selection and Hybrid Join commands. The browser must visibly show the commands and results being tested.

Assessment: GO. Existing authenticated `/api/ai-routing/status`, `/select`, `/join` and capability test endpoints already own the operations. Command needs a bounded interpreter and session-only confirmation, not a new store or gateway. Phase 1 entry commands stay compatible.

Impact map: Settings Command is the sole changed product surface. `app/_components/settings/connection-command.mjs` owns parsing and orchestration; `global-dsdd-conversation.tsx` supplies the existing authenticated browser request and current-profile boundary. Core capability routes and Join contracts remain authoritative. No PPF, canon, vault format, provider adapter, runtime installation or routing persistence change is planned. Existing Setup screens own secret input and asynchronous media job inspection. Status and previews invoke no generation or selection.

Acceptance:

1. `PlotPickle connections` and `connections status [local|cloud|hybrid]` read runtime configured/verified/selected state; Hybrid lists the exact existing eligibility matrix. Existing `connect local|cloud|hybrid` and `connections local|cloud|hybrid` continue to open the real GUI.
2. `connections test <writing|images|video> <route>` previews and explicitly confirms one applicable GUI test. Writing Local uses exact Quality. Image tests map only to actual GUI tests; unsupported composite test requests fail closed. Media job submission is labeled separately from successful verification. Existing saved provider billing/video-sharing consent remains required. A new paid request requires `charges`, cloud video also requires `share`; native H3 requires `performance`.
3. `connections select <capability> <route>` and `connections join <capability> <engine> <provider>` preview exact operations and require a fresh confirmation. A supported unverified Join can save configuration without selection, matching GUI; unsupported pairing is blocked. Read-back must match requested selection/Join.
4. Session-only previews expire after two minutes, bind to authenticated profile and runtime option/selection, and are consumed before submission. Cancel, stale state, profile change and duplicate confirmation cannot submit. No automatic paid retries. Backend remains authoritative for auth/CSRF, consent and cross-profile storage.
5. Reject unrecognized connection input before transcript append; no raw provider response or exception is echoed. Secrets must use existing secure Setup. Do not introduce free-form credential commands.
6. Approved W8/W9 and PP-COMP-002 T3/T4 test binding, focused regressions, existing authenticated gateway isolation regressions, focused UAT contracts, production build, convergence, independent review and exact-head GitHub gates. Real provider execution and Human Windows acceptance remain UNPROVEN until observed. No paid compute grant is inferred from this development request.

Product proof will show read-only status, supported local test preview, cancellation, unsupported Join, and protected confirmation behavior in a visible separate worktree browser tab. Any unavailable authentication or provider will be recorded as an evidence limit. The existing Human profile will not be modified merely to manufacture fixture readiness.

Non-goals: credentials entered in transcript, provider installation, automatic downloads, model choice changes, media generation outside explicit test approval, creative/story production, automatic cloud fallback, or claiming complete four-category GUI parity. Async job lifecycle and secure provider setup remain in their existing GUI owners.
