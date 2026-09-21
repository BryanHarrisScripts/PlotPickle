# Developer Brief — DSDD + Pi 0.87 Persistent Engineering Session

Parent: #2331

## Purpose

Promote PlotPickle's managed Pi developer runtime to **v0.87.0** through the existing isolated compatibility proof, then use Pi 0.87's canonical session/context-editing capabilities as the persistent engineering session underneath DSDD.

The Human-facing goal is to reduce the experience to four moments:

```text
TALK
  ↓
CONFIRM
  ↓
BUILD
  ↓
PROVE
```

The deterministic machinery remains underneath, but the Human should no longer experience separate handoffs between intent capture, specification reconstruction, coding, repair and verification.

## Governing DSDD rule

DSDD uses conversation to establish an authoritative, traceable definition of what the software is supposed to do, then uses deterministic engineering machinery to prove whether the software does it.

The authoritative semantic chain remains:

```text
WHAT THE HUMAN SAID
→ WHAT DSDD UNDERSTOOD
→ WHAT THE HUMAN APPROVED
→ WHAT BUILD RECEIVED
→ WHAT THE SOFTWARE DID
→ WHAT EVIDENCE OBSERVED
→ WHETHER THE APPROVED INTENT IS PROVEN
```

Pi 0.87 is being adopted because it can preserve this chain while changing only the model's active working context.

## Why Pi 0.87 changes the architecture

Pi v0.87.0 adds the exact primitives DSDD needs:

- `ContextEditEntry`: append-only changes to future model context without rewriting the original session history;
- `SessionManager.appendContextEdit(...)`: supported package-root SDK surface for those context edits;
- `buildSessionProjection()`: model-visible projection distinct from raw history;
- `context_with_system`: per-request transformation over the full transcript including system/tool state;
- actionable turn/settle extension boundaries for controlled continuation rather than loose prompt chaining;
- canonical session management that preserves branches/history.

For DSDD this means:

> Original Human language remains immutable provenance.  
> The current engineering context may be compacted, filtered or replaced without rewriting that provenance.

## Human experience

### TALK

The Human logs into PlotPickle and uses the real product with the DSDD LIVE UAT developer beside them.

They narrate naturally:

> "When I open this and come back, I expect to be exactly where I was."

DSDD captures:

- original Human statement;
- current governed surface/route;
- observed behavior;
- expected behavior;
- relevant constraints and business workflow.

The conversation is local/private developer-session state, not GitHub telemetry.

### CONFIRM

The DSDD interpreter reflects a concise candidate meaning:

```text
You expect:
- this action to open Characters without destroying Draft context;
- returning to restore the same Draft working position;
- unrelated Draft behavior and canon ownership to remain unchanged.
```

Only material ambiguity should interrupt the Human.

When the Human says **Build this**, the accepted meaning becomes a versioned locked intent.

The original Human language remains in the session history. The locked interpretation is added as a new authoritative DSDD entry; it does not replace the original statement.

### BUILD

The same Pi engineering session now changes working context rather than starting from a reconstructed prompt.

Pi receives:

- locked intent;
- relevant surface/runtime context;
- relevant repository files;
- required PlotPickle Skills;
- allowed tools;
- current build/repair state.

Old exploratory or superseded context may be removed from future model context with append-only `ContextEditEntry` values while remaining intact in raw history.

Implementation uses the existing bounded coding/repair authority and isolated worktree rules.

The Human does not have to repeat the business case.

### PROVE

WebMCP, deterministic tests, architecture verification and CI remain evidence authorities.

DSDD compares evidence to the locked intent.

Possible requirement states:

- PASS — sufficient evidence proves it;
- FAIL — observed behavior contradicts it;
- UNPROVEN — evidence is insufficient.

If implementation fails, the same Pi session receives the failed requirement plus evidence and repairs the code **without changing locked intent**.

If the Human changes what they want, DSDD creates Intent v2 rather than rewriting Intent v1.

## Persistent session model

The Pi session is the local engineering continuity layer.

### Immutable provenance

Keep:

- Human statements;
- accepted interpretation/version;
- explicit intent revisions;
- build/repair milestones;
- evidence references.

Do not rewrite these entries.

### Mutable model context

The active model context may contain only what is useful for the current request:

- current locked intent;
- relevant surface/state;
- relevant repository context;
- current failing evidence;
- current tool/Skill contract.

Pi 0.87 context edits may omit or replace earlier model-visible content while raw history remains unchanged.

### Context extension

A PlotPickle-owned Pi extension may use `context_with_system` to ensure every DSDD engineering request receives the current locked intent and permitted tool/Skill state.

The extension must not:

- overwrite Human provenance;
- expose hidden reasoning;
- introduce cloud/provider fallback;
- silently alter acceptance criteria;
- persist credentials or full private product/user content to GitHub.

## Model routing

The roles remain intentionally separate.

| Role | Default |
| --- | --- |
| Live DSDD intent interpretation | PlotPickle Quality local model, currently Qwen3.5-9B class |
| Fast classification/routing | PlotPickle Fast local model |
| Persistent engineering/session harness | Pi 0.87 |
| Coding/repair inference | strongest approved local coding model that safely fits, loaded on demand |
| Final correctness authority | deterministic verification/WebMCP/CI, not an LLM |

Pi is the engineering harness/session authority, not the final oracle of correctness.

## Phase A — promote Pi 0.87 safely

Do not replace PlotPickle's authoritative Pi 0.84.4 pin until an isolated Windows candidate proof passes.

Candidate proof must:

1. install exact `@earendil-works/pi-coding-agent@0.87.0` in a temporary project;
2. install PlotPickle's exact currently pinned Pi extension set unchanged;
3. verify exact Pi version;
4. load/register all pinned extensions through supported package-root APIs;
5. verify package-root SDK import;
6. prove an in-memory Pi session can:
   - append a Human message;
   - append a `ContextEditEntry`;
   - retain the original raw entry;
   - produce a changed model-visible projection;
7. prove stdio RPC still starts and answers `get_state`;
8. reject PlotPickle use of source-only `client` / `experimental/plugin` subpaths;
9. emit machine-readable evidence;
10. run on Windows Product Gate.

Only after that proof is green may the authoritative managed Pi pin, developer-agent metadata, OSS inventory and lock metadata move together to 0.87.0.

## Phase B — persistent DSDD session

After 0.87 promotion:

1. create one local DSDD Pi session for an authenticated developer/UAT session;
2. associate it with DSDD LIVE UAT without exposing it as an ordinary end-user chat;
3. append Human narration as provenance;
4. append accepted DSDD interpretations as explicit versioned entries;
5. add a minimal PlotPickle DSDD Pi extension using supported 0.87 package-root APIs;
6. inject the current locked intent at request time without reconstructing the entire transcript;
7. hand BUILD/repair work to the existing local Pi coding boundary;
8. attach evidence references and requirement status back to the same DSDD session.

## Phase C — Build this

Add explicit **Build this** confirmation.

Before confirmation:
- conversation/interpretation only;
- no repository mutation.

After confirmation:
- lock Intent vN;
- create bounded build packet;
- open/use isolated coding worktree;
- execute existing coding/repair loop;
- verify;
- report against original approved intent.

## Correction classification

### Implementation mismatch

Intent remains locked.

```text
repair → rerun relevant proof
```

### Specification ambiguity

The accepted interpretation was incomplete.

```text
reopen interpretation → Human confirms Intent vN+1 → rebuild
```

### Intent revision

The implementation may be correct but the Human now wants different behavior.

```text
preserve prior version → create Intent vN+1
```

## Non-goals

This issue does not:

- make Pi the correctness authority;
- remove WebMCP, CI, seven-layer verification or exact-head gates;
- give conversation automatic merge authority;
- upload private DSDD transcripts to GitHub;
- silently install a larger local model;
- force one model to perform conversation, coding and verification;
- rewrite Human history during context management;
- adopt Pi source-only/experimental subpaths.

## Acceptance criteria

1. Pi v0.87.0 is proven against the exact pinned extension stack on Windows before promotion.
2. The managed Pi version and authoritative metadata move together only after proof.
3. The candidate proof demonstrates raw-session provenance remains unchanged while model-visible context can change through `ContextEditEntry`.
4. DSDD LIVE UAT can own/recover one persistent local Pi engineering session after authentication.
5. Human narration and accepted intent remain distinguishable in the session record.
6. A locked intent can be injected into later build/repair requests without rebuilding the entire Human transcript into a fresh prompt.
7. Build/repair cannot silently mutate the locked intent.
8. Verification results map back to approved intent requirements.
9. Failed implementation may loop through Pi repair using the same session and locked meaning.
10. An intent change produces a new intent version instead of rewriting history.
11. No hidden reasoning, credentials or full private transcript is committed to GitHub.
12. Existing local-only provider, isolated worktree and deterministic merge boundaries remain intact.
13. Focused regression coverage and required exact-head gates are green.

## North-star experience

The Human should experience:

```text
I talk while using PlotPickle.
        ↓
DSDD tells me what it understood.
        ↓
I say "Build this."
        ↓
The same engineering session builds, observes, repairs and proves it.
        ↓
I am told whether the result satisfies what I originally approved.
```

The Human should re-enter only when the meaning changes, not because the engineering system forgot the meaning.
