# The Pickle audience engine

The Pickle is PlotPickle's audience-engagement layer. It describes the unresolved tension viewers keep testing while the story unfolds.

Plot structure answers what happens. Character development answers why choices matter. The Pickle answers why an audience keeps leaning forward.

## Core design

A strong Pickle combines five ideas:

1. A clear audience question gives viewers something active to solve, predict, hope for, or fear.
2. A recognizable story promise teaches viewers what kind of pattern they are watching.
3. An expectation gap allows the broad destination to feel possible while the route remains difficult to predict.
4. Two live answers keep more than one interpretation or outcome plausible.
5. A signature move makes the execution specific to this story rather than relying on genre convention alone.

The ending should answer or deliberately reframe the audience question. A reveal without earlier pressure feels arbitrary; an answer that became certain too early feels flat.

## Canonical project data

Schema version 1.2.0 stores The Pickle in the project development object.

| Field | Purpose |
| --- | --- |
| centralTension | The unstable situation capable of sustaining the whole story. |
| audienceQuestion | What viewers repeatedly test, predict, hope, or fear. |
| storyPromise | The pattern, rule, or dramatic contract the story teaches the audience. |
| expectedDestination | The broad result viewers may reasonably anticipate. |
| unpredictableRoute | The events, choices, identities, or consequences that must remain uncertain. |
| liveAnswerA | One plausible explanation, outcome, hope, or fear. |
| liveAnswerB | A competing answer the story can also support. |
| escalationPattern | How clues, reversals, complications, and near-answers refresh the tension. |
| finalAnswer | How the ending resolves or reframes the audience question. |
| signatureMove | The execution choice that makes the pattern belong to this story. |

Each of the 24 blocks adds two local fields:

| Field | Purpose |
| --- | --- |
| audienceExpectation | What viewers are likely to believe, expect, hope, or fear after the block. |
| pickleTurn | The clue, reversal, complication, near-answer, or reframe that changes that expectation. |

## Workspace integration

Instructions teaches The Pickle as an audience contract and supplies focused diagnostic questions.

Story Planner provides the full global editor, then carries audience expectation and Pickle turn into every block.

Visual Board displays the global question beside the selected block's expectation and turn so storyboard images can create, support, or disrupt the intended audience belief.

All three workspaces read and write the same canonical project object.

## Block-level diagnostic

A developed block should answer four questions:

1. What did the audience believe before this block?
2. What visible event or choice supplies new information?
3. What does the audience believe now?
4. Why does that changed expectation make the next block necessary?

Not every block needs a major reveal. Confirmation, contradiction, delay, escalation, and emotional recontextualization can all refresh The Pickle.

## Originality test

Genre can make the broad destination predictable. Originality lives in the route and execution.

The signature move should identify a repeatable technique specific to the project: an unusual point of view, visual grammar, character behaviour, source of evidence, pattern of reversals, or relationship between theme and plot. It should be concrete enough to guide block writing and storyboard choices.

## Migration

The 1.2.0 normalizer accepts 1.0.0 and 1.1.0 projects. Missing Pickle and block-level audience fields are added with empty values, preserving all existing story data.
