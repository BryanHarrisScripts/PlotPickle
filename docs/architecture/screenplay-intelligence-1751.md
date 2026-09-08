# Screenplay Intelligence — Issue #1751

PlotPickle adds five screenplay diagnostics without adding a second story structure.

The authority remains:

`4 Acts -> 24 Blocks -> 96 mini-blocks -> flexible scenes -> screenplay draft`

These lenses inspect or annotate that authority. They do not gate LEARN, replace the 24/96 model, silently rewrite screenplay text, or admit AI output into canon.

## 1. Character Misbelief

PlotPickle already owns the necessary character evidence in `CharacterArcMatrix`:

- `protectiveLie` is the character's working misbelief.
- `emergingTruth` is the truth the character may discover or choose.
- `checkpoints[]` are pressure points where belief, pressure, choice, consequence and evidence can be recorded.
- `character.ghost` and the existing development Ghost fields provide origin context.

The screenplay-intelligence layer therefore derives a Misbelief lens from existing canon instead of creating duplicate character fields.

## 2. Controlling Idea

A Controlling Idea is an optional writer-owned statement with two parts:

- **value** — the meaningful value change the story argues or proves;
- **cause** — the character choice/action/condition that produces that change.

It is stored as versioned optional PPF data under:

`extensions.screenplayIntelligence.version = 1`

This preserves PlotPickle 1.7 compatibility and avoids making the field mandatory. The diagnostic relates the idea to the existing anti-theme, ending proof, and Blocks containing choice plus consequence/turn evidence. It never changes theme or Block content automatically.

## 3. Character Perspective Audit

The audit projects one existing character across all 24 Blocks. For every Block it derives four evidence groups from Block, Scene and Mini-block data:

- objective;
- pressure;
- action;
- turn/consequence.

It can identify absence, passivity, missing opposition, or lack of change without inventing a new beat sheet. The same 24 Blocks remain the navigation and structural authority.

## 4. Challenge Location

A Scene can be challenged against alternative locations already present in `project.world.locations`.

The deterministic diagnostic:

1. keeps the current Scene location untouched;
2. excludes locations already assigned to the Scene;
3. ranks canonical alternatives using overlap with recorded Scene/Block dramatic context;
4. returns proposal reasons;
5. marks every result `requiresHumanAcceptance: true`.

It never applies a location automatically and never invents a new canonical location.

## 5. Spec Readiness

Spec Readiness inspects existing `screenplay.draftElements` and reports advisory findings for:

- dense action paragraphs;
- explicit camera/viewer direction;
- internal conclusions that may not be directly playable;
- malformed scene-heading prefixes;
- overlong dialogue blocks;
- heavy parentheticals;
- non-normalized character cues;
- production-draft mode when the writer is evaluating a submission/spec draft.

The result is deterministic and non-mutating. A high score means `ready-to-review`, not "professionally approved" or "submission guaranteed."

## Boundaries

- No third-party skill files, quotations or source text are copied.
- No Save-the-Cat/McKee/Field-style structure becomes a competing PlotPickle model.
- No provider dependency is introduced.
- No canon mutation happens during an audit.
- Controlling Idea changes require an explicit writer-owned update call.
- Challenge Location returns proposals only.
- Spec Readiness reports findings only.
