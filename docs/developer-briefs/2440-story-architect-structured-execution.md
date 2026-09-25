# Developer Brief — Story Architect Structured Execution

Issue: #2440

## Problem

Outline's Story Architect assessment is a structured evidence task, but it currently enters Mastra through the ordinary free-form text path. The caller then parses the returned text as JSON.

That mismatch produced a real Human-visible failure:

- Assess Act 1 started.
- Block 01 did not complete.
- Mastra/provider returned no text.
- The Outline correctly persisted a failed receipt with 0/6 Blocks and did not alter accepted story content.

The receipt behavior is correct. The execution path is not.

## Intent

Make Story Architect use Mastra structured output natively, while retaining PlotPickle's existing evidence/citation validator as the final authority.

## Architecture

### 1. Mastra schema

Add a dedicated Story Architect schema with:
- structural:
  - state: covered | condensed-shared | gap-underdeveloped | unresolved
  - evidence-based reason
  - passage IDs
- characters:
  - characterId
  - governed arc state
  - evidence-based reason
  - passage IDs
- miniBlocks:
  - exactly four entries
  - ordinal 1–4
  - supported | partial | unsupported
  - evidence-based reason
  - passage IDs
  - storyboardCue

The schema governs output shape only.

### 2. Existing evidence validator remains authoritative

Do not weaken or duplicate `validateOutlineAgentAssessment`.

It continues to enforce:
- the current Block fingerprint
- allowed sampled passage IDs
- structural citation requirements
- exact character membership
- character-specific citation constraints
- four distinct Mini-Block ordinals
- supported/partial evidence rules
- accepted-canon boundary

Structured generation does not make source claims trustworthy by itself.

### 3. No free-form fallback

For a non-conversation Story Architect call:
- call `agent.generate(... structuredOutput ...)`
- require `result.object`
- serialize that object for the existing Outline validator
- if no structured object is returned, fail explicitly

Do not retry through ordinary `result.text`.

Mastra's existing bounded internal retry behavior remains allowed.

### 4. Response budget

Use a Story Architect-specific model setting:
- low temperature suitable for assessment
- bounded output large enough for structural + character + four Mini-Block findings

Do not make this an unbounded generation path.

### 5. Safe diagnostics

The writing-assistant gateway already knows:
- requested provider
- runtime provider
- model
- model role
- compute source

If Story Architect execution throws or returns no structured result, append those safe route details to the error sent back to Outline.

Never include:
- API keys
- auth headers
- provider secrets
- raw provider payloads

Because Outline already persists the error in the assessment run receipt, this automatically makes future failed runs diagnosable.

### 6. Success metadata

The successful assessment's existing `model` display metadata should include a compact safe execution route rather than only a bare model name.

No project schema migration is required; the field is already bounded text.

## Human-visible behavior

Success:
- assessment proceeds Block by Block
- current findings still pass the existing evidence validator
- history shows the provider/runtime/model route
- accepted story content remains unchanged

Failure:
- history still records failed / partial run
- error explains which safe provider/model/role/compute route failed
- no fake assessment is created
- no silent fallback occurs

## Non-goals

- no Outline redesign
- no automatic provider switching
- no fallback to another provider
- no canon mutation
- no weakening of citation checks
- no change to Act-level serial execution semantics

## Verification

Focused regressions must prove:
1. Story Architect has a native Mastra schema.
2. Its runtime branch uses `structuredOutput` and requires `result.object`.
3. It does not fall through to generic free-form text generation.
4. Its output budget is explicitly bounded.
5. The gateway adds provider/runtime/model/model-role/compute-source to Story Architect failures.
6. Outline keeps the existing evidence validator.
7. Successful model metadata contains the execution route.
8. No secrets are included in diagnostics.
9. Full exact-head Architecture Verification passes before merge.
