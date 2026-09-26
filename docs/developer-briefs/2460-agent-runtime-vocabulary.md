# Developer Brief — Canonical Agent / Runtime Vocabulary

Issue: #2460

## Objective

Standardize PlotPickle's agent/runtime execution vocabulary so observability, DSDD/developer tooling, provider accounting and future UI traces use the same nested terms.

Reference reviewed:
- https://www.aicodingdictionary.com/?term=turn

The external dictionary is a terminology reference only. PlotPickle owns its final definitions.

## Canonical execution hierarchy

Session
→ Turn
→ Agent Run
→ Provider Request
→ Tool Call
→ Tool Result

These terms apply only to agent/runtime execution. They do not replace narrative uses of terms such as "scene turn", "story turn" or dramatic turning point.

## Definitions

Session

A bounded interactive/runtime continuity span. A session can contain multiple user-visible turns and may survive multiple provider requests.

Turn

One user-visible interaction unit: input enters PlotPickle and control eventually returns to the Human with a visible result, actionable failure or bounded handoff. One turn may contain multiple agent runs, provider requests and tool calls.

Agent Run

One bounded execution of an Agent role/worker under a resolved instruction/skill/tool context. Retries or delegated workers should receive distinct run identities rather than being hidden inside one opaque run.

Provider Request

One request sent to an AI provider/runtime. Streaming chunks are not separate provider requests unless the provider API actually creates a separate request.

Tool Call

One invocation of a declared tool/capability from an Agent Run or other authorized runtime owner.

Tool Result

The bounded outcome returned for one Tool Call. A result can be success, failure or cancellation. It is not itself a new Tool Call.

## Parent/child model

- sessionId may parent many turnIds.
- turnId may parent many agentRunIds.
- agentRunId may parent many providerRequestIds and toolCallIds.
- toolCallId has at most one terminal toolResult record, though streaming/progress events may precede it.
- retries use new request/run/call IDs and may reference a retryOf identifier.

The hierarchy is descriptive observability, not creative authority.

## Operational trace policy

Allowed:
- opaque IDs;
- timestamps/durations;
- role/agent/provider/tool/runtime identifiers;
- model identifier when safe;
- status/error code;
- token/cost counters where available;
- parent/retry relationships;
- evidence/artifact references that are already safe for the development ledger.

Not allowed in ordinary developer telemetry:
- hidden reasoning;
- chain-of-thought;
- full prompts;
- full model responses;
- private story text;
- credentials/tokens/secrets;
- raw user files unless a separate evidence contract explicitly allows them.

## Machine-readable contract

A small host-owned vocabulary module should export:
- the six canonical kind strings;
- the parent relation map;
- an allowlist of safe trace fields;
- an explicit denylist of sensitive content categories.

This reduces naming drift without creating a telemetry database or forcing immediate migration of every historical field.

## Migration rule

New agent/runtime observability code should use these terms.

Existing code is migrated only when touched for a real reason. Do not perform a repository-wide mechanical rename.

Narrative product language is unaffected.

## Verification

Focused tests must prove:
- the six canonical kinds are stable and uniquely named;
- hierarchy relationships are explicit;
- Turn remains below Session and above Agent Run;
- Provider Request, Tool Call and Tool Result are not collapsed into Turn;
- safe trace fields exclude prompt/response/reasoning/story/credential content;
- documentation explicitly protects narrative uses of "turn".

## Non-goals

- building a telemetry database;
- changing story terminology;
- exposing internal reasoning;
- inventing billing data;
- renaming every existing "run", "request" or "turn" string immediately;
- changing provider APIs;
- changing Human approval/canon authority.

## Acceptance

- [ ] Canonical hierarchy is documented.
- [ ] Machine-readable vocabulary contract exists.
- [ ] Privacy-safe trace allow/deny policy is explicit.
- [ ] Narrative "turn" usage is out of scope.
- [ ] Focused regression prevents terminology drift.
