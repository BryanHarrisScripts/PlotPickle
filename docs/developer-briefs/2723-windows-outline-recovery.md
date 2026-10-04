# Windows launcher recovery after an interrupted Outline assessment

Issue #2723 follows the Windows Product Gate failure on merged PR #2720.
Human instruction: take that failure into a new issue, build, test, fix and merge
when green. Merge authority applies only after all required checks succeed on
the same current head.

## Assessment and owners

GO. The existing rendered product proof completes the first normal Windows
launch, profile authentication and interruption during Block 2, then times out
on restart. Vite and workerd remain alive before HTTP readiness. Two attempts
on head `5fae5b10ee23cb7ca5f188fc237e940cda99bda2` show this failure.
The focused Linux reopen/startup stage passes; full Linux provider execution is
unavailable here because user encryption is unavailable. Native Windows CI is
therefore necessary evidence, not an optional replacement for a local claim.

Reuse `build/startup/`, the existing normal Windows launcher, the existing Vite
configuration, and `scripts/pi/durable/outline-product-proof.mjs`. Diagnose the
blocked startup phase before choosing the repair. Preserve the same profile,
runtime and task through interruption/reopen. The encrypted task/controller
already owns spent reservations and explicit resume; do not change those
contracts merely to avoid a startup failure.

## Acceptance

- Repair the demonstrated startup/recovery root cause under its existing owner.
- Add the nearest focused regression that fails for the old behavior.
- The real Windows launcher must restart within the existing readiness bound;
  the rendered proof must expose Resume without automatic inference, retain the
  interrupted attempt, and execute only the remaining Blocks after explicit
  resume. Saved story/profile data and cancellation remain intact.
- Diagnostics must be bounded operational metadata, excluding prompts, story
  text, responses and credentials. Do not increase timeouts or skip assertions.
- Focused regressions, focused UAT contracts, convergence, architecture/security
  checks and native Windows production build must pass at the exact merged head.

## Plan and limits

First collect fixture-only worker/optimizer startup diagnostics and inspect the
native Windows result. Then make the smallest cause-specific repair, strengthen
the nearest regression, and rerun the failed recovery proof. Keep one persistent
PR development ledger. Completion requires independent full native product
evidence. Keep issue #2706 separate.
No provider, task-budget, authentication or writer-content authority expansion.

## Observed diagnosis and repair

Run 37215178747 confirms that cached RSC/SSR worker initialization is the pending
phase at the fixture's 180-second restart deadline. Run 37223932464 at head
`c290ba1b6c60f7278153e1530824fd19015a51dd` subsequently completes the same full
native recovery, cancellation and production build; its recovery stage takes
about 161 seconds. This disproves a consistently permanent startup wedge.

The demonstrated contract defect is that the fixture terminates the normal
launcher after 180 seconds, while `Start-PlotPickle.bat` explicitly gives normal
startup 240 seconds. The repair derives the fixture's Windows restart deadline
from that existing launcher policy. It does not change the launcher's timeout,
force a cache rebuild, replace workerd, or bypass a readiness/recovery assertion.
Missing or invalid launcher policy fails closed. Linux retains its 180-second
bound and cold installation retains its existing 480-second allowance.

Remove diagnostic debug logging before verification. Record only stage, cold
flag, deadline, measured duration and pass/fail in `launcher-startup.json`,
labelled with the source head. The independent Windows run must prove the full
rendered recovery without diagnostic logging; until it does, the deadline
repair remains UNPROVEN. This repair addresses the verification deadline;
optimizing the application's startup latency would be a separate scope.
