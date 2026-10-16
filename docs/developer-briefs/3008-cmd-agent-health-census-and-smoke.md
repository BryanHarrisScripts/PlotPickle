# Developer brief #3008 — CMD complete agent census and bounded live smoke

## Human-approved objective
From Settings → Command, enumerate **every hooked/known PlotPickle Agent including Community/BUZZ and local production/developer workers**, and run a rapid read-only synthetic input→output test wherever the existing runtime supports one. A registered agent or a provider connection alone must never count as proof of output. Requested development path: build → focused tests → native Windows → exact-head CI → PR → merge when green; user will exercise live agents together after update.

## Authoritative source registry, not a manually maintained list
- \`config/agent-profiles.json\` (19), \`config/agent-profile-extensions/community.json\` (+1): 20 named profiles. \`lib/agents/agent-profiles.ts\` is the assembly owner.
- \`build/mastra-agent-runtime.ts\` registers 16 embedded Mastra roles; 9 are linked to named profiles and **7 are role-only**, not forgotten.
- \`config/buzz-guildhall.json\` and Community extension register 16 actor IDs, \`plugins/plotpickle-playhouse/community.json\` publishes 15 directory IDs. The known Knot/Thread/Heart role gap is explicitly flagged; presence is not inferred.
- \`scripts/production-supervisor-agent.mjs\` has 5 distinct local companion workers, now sharing \`lib/agents/production-supervisor-workers.mjs\` with the status census, plus one coordinator.
- \`config/developer-agent-stack.json\` supplies Pi and Cline.
- The deduplicated source inventory contains **35 distinct slots**. It counts separately a Mastra role-only slot and a production-worker process, never multiple representations of the same profile. It is a registry *census*, not 35 proven running processes. Additional authenticated BUZZ peers are **unknown** because current \`/api/local-buzz/agent-roster\` lists only official actors; do not manufacture dynamic peers.

## Product commands (implemented phase)
- \`PlotPickle agents inventory\` or \`PlotPickle agents status\` — read-only, no inference or social posting, report all 35 source slots, BUZZ presence where actually available and mismatches.
- \`PlotPickle agents test quick\` — preview one attempt per callable **Mastra role**, maximum 16 role invocations, each with explicitly synthetic fixture; report all source slots. No project or screenplay data enters these prompts.
- \`PlotPickle agents test quick local\` — require tested local writing connection with no cloud fallback.
- \`PlotPickle agents test one <agent-id> [local]\` — same for an individual profiled role or role-only ID. An agent without a safe adapter returns BLOCKED rather than inventing a pass.
- \`PlotPickle agents confirm <token> [CHARGES SHARE]\` — one-use, profile-bound, two-minute preview. Cloud must explicitly acknowledge spending and external sharing; token consumed before any requests. Per invocation runtime may have its own bounded provider retries, so a role invocation is **not** exactly one provider API call.
- \`PlotPickle agents cancel\` — invalidate preview; \`PlotPickle agents report\` — last report for this unlocked session.

## What live testing actually proves
- Only Mastra role invocations call the existing writing-assistant chat owner: each role receives a short noncanonical synthetic prompt and its output is validated. Story Architect/Foundation/Discovery/Wyrmwood roles have separate JSON field/schema contract checks. Advisory roles must return nontrivial non-echo text. The report distinguishes validated **advisory output** from validated **structured output**; neither implies persistence, semantic fidelity, approved canon or a specific paid-model charge.
- All other operational profiles, community agents, dynamic peers, developer agents and Production Supervisor workers remain in the report as **BLOCKED** by default because posting as an official BUZZ signer, invoking dev workers or starting media/production jobs is neither a safe generic text call nor covered by one consent token. No hidden substitute test.
- At most 16 role invocations and 120 seconds total, one-at-a-time, no *Command-level* retries; per request browser timeout at most 22 seconds. Aborted HTTP requests may already have reached the provider: mark UNKNOWN, never infer $0 usage or automatically retry.
- Never expose raw private output, prompts, credentials, BUZZ private signers, human profile IDs or source project data in reports. No automatic startup probe and no external BUZZ posts, PPF mutation or GitHub writes.
- Read-only GETs use the existing owner endpoints \`/api/writing-assistant/agent-compute\`, \`/api/writing-assistant/status\`, \`/api/local-buzz/agent-roster\`, \`/api/ai-routing/status\`. Authenticated Human profile checks and CSRF-bound mutating requests use \`authenticatedProfileFetch\`.

## Tests & limitation
\`tests/issue-3008-agent-health.test.mjs\` verifies actual 20/16/35 source census, mismatch warnings, extension and extra-peer discovery, command grammar, zero-inference inventory, paid confirmation replay, expired tokens, profile isolation, unsupported native agent block and synthetic shape-validation results. These mocks **do not prove user's real agents are responding**; on-device actual I/O still requires the user to confirm a fresh preview, and is recorded separately. Authenticated Settings Command/Windows readiness and all seven independent CI layers remain required before merge.

## Unresolved in issue #3008 (deliberately not falsely complete)
1. Safe, signed, role-specific BUZZ agent message-and-reply harness with explicit public sharing authorization and identity verified per official signer, plus genuinely connected dynamic peers.
2. True on-demand deterministic worker-specific I/O probes for the five Production Supervisor workers, BEN/UAT helpers, Pi/Cline read-only harnesses, and unavailable process reporting.
3. Stronger receipt from provider host for actual dispatch vs response vs billed usage; current chat endpoint receipt lacks provider usage details, so report UNKNOWN for those quantities.
4. On-device live Windows UAT including actual authenticated provider and restart behavior after merging.

A green CI alone proves the governed functionality and safe synthetic path, not that every live agent is responding. **Do not close issue #3008 until the remaining safe adapters and live acceptance have evidence.**
