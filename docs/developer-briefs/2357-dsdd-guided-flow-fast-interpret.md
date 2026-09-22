# Developer Brief — #2357 DSDD guided 3-step flow and fast production-grade interpretation

## Definition

**DSDD = Deterministic Specification-Driven Development.**

Architectural shorthand:

> Deterministic connective tissue around autonomous agents.

DSDD connects Human intent, agents, artifacts, checkpoints, evidence, testing and software-delivery systems into a controlled development chain without micromanaging every agent step.

GitHub is one current software-delivery child implementation, not part of the architecture-level definition.

## Human UAT evidence

Conversational UAT reached the correct semantic conclusion for a simple narration — “this is not a problem” — but took too long and generated pages of repetition before the 6,000-character persistence bound cut it off.

The rendered provenance showed `smollm2:135m-instruct-q2_K` as the intent model. PlotPickle already defines SmolLM2 135M as a non-production health-check/bootstrap model, so it must not satisfy a production Fast/Quality/Deep text role.

The Human also found the action row unclear. DSDD should teach its own workflow through three numbered actions rather than four peer buttons.

## Product flow

```text
Narrate / edit
      ↓
01 INTERPRET
      ↓
Human reviews meaning
      ↓
02 PI DRAFT
      ↓
Human reviews repository-aware technical brief
      ↓
03 PUBLISH BRIEF
      ↓
software-delivery work item
```

`CLEAR DRAFT` is removed. The narration field itself remains editable.

## Experience contract

The three actions are both the controls and the process indicator.

Each step has a visible state:
- active / available;
- complete;
- locked.

Step 02 remains locked until a current interpretation exists.
Step 03 remains locked until Pi Draft is ready.

If interpretation concludes that no development action is required, steps 02 and 03 remain disabled and visibly say `NOT REQUIRED`.

## Interpretation contract

DSDD interpretation remains local Quality-role work.

For DSDD intent requests only:
- provider output is bounded to at most 384 output tokens;
- returned text is compacted to at most 3,500 characters before the existing 6,000-character client/session backstop;
- exact repeated sentences are collapsed when pathological repetition appears;
- the prompt asks for under 1,200 characters and at most five concise bullets.

When the Human clearly says there is no problem/no development change, the requested canonical response is:

> Understood. This is not a problem and no development action is required. I’ll retain it as a UAT observation.

No Pi Draft, publication or coding action is automatic.

## Production model boundary

Fast, Quality and Deep are production text roles.

The SmolLM2 135M bootstrap model remains:
- `health-check`;
- `production: false`;
- installer/inference diagnostics only.

Shared local runtime selection filters the health-check model out before:
- manual override resolution;
- preference recommendation;
- catalog fallback;
- availability/prod status.

If only the health-check model is reachable, Quality is unavailable and DSDD fails truthfully instead of silently downgrading.

## Existing DSDD authority preserved

Pi Draft remains read-only and uses only read/grep/find/ls.

Publish Brief remains explicit and publishes the durable work item. The current adapter creates a GitHub Issue, but the DSDD UI stays software-delivery neutral.

DSDD still has no authority to create a coding worktree, edit source, commit, push, create a PR or merge.

## Verification

Focused regression must prove:
1. ordered 01/02/03 action labels and source order;
2. Clear Draft is absent;
3. prerequisite gating and no-action stop state;
4. exact no-action instruction;
5. DSDD max output token budget <= 384;
6. repetitive-output compaction;
7. health-check exclusion from production text-role selection;
8. existing Pi Draft read-only and Publish Brief Issue-only boundaries;
9. Layer 2 and Layer 6 ownership/catalog selection.

GitHub exact-head CI remains merge authority.
