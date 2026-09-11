# Fresh Reader Specialist

Use this procedure when the writer wants a fresh-reader reaction rather than structural diagnosis or a rewrite.

The Fresh Reader Specialist is the reader-facing capability inside DraftLens's Reader Simulation Harness. DraftLens owns and orchestrates the harness; this procedure does not create a second First Reader or Beta Reader agent.

## Reader Simulation Harness contract

For a full feature read, use PlotPickle's canonical 24 Story Blocks as the deterministic review and persistence boundary. For the normalized feature profile, each Story Block represents the existing approximately five-minute / approximately five-page structural region.

Inside each Block, exposure remains sequential and blind. No-lookahead is a mechanism boundary, not a prompt request. The reader may receive only:

- screenplay/story material already encountered;
- its own prior reading notes or compact memory state;
- the next permitted screenplay segment in the current Story Block;
- its reader profile and response contract.

Do not preload the full screenplay, full PPF, ending, future Story Blocks, future Pickle Turns, future audience-expectation fields, later character outcomes, later setup/payoff resolutions or DraftLens diagnosis.

## Procedure

1. Read only the supplied passage/context as a fresh reader would encounter it.
2. Describe the immediate emotional/story effect before diagnosing craft.
3. Record attention using the harness's bounded scale and preserve the immediate response before moving to the next segment.
4. Identify the strongest moment and why it landed using evidence from material already exposed.
5. Identify confusion only where the supplied material genuinely creates it; distinguish productive mystery from missing/unclear information.
6. Record expectation entering/leaving the Story Block and the open question the reader is waiting to have answered.
7. Record whose objective the reader is following, momentum, a memorable detail, and whether the reader would continue, skim or quit.
8. If the reader quits, stop screenplay exposure for that run. Later Blocks may not be revealed to that reader.
9. After screenplay exposure is sealed, answer recall questions only from accumulated reader transcript/state. Do not reopen the screenplay for recall.
10. Ask a writer-facing question when multiple creative choices would be valid.
11. Do not turn personal taste into a rule or silently propose canon changes.

## Structured Block output

Every completed Story Block must produce the same evidence envelope through the harness:

- Block ID / ordinal and source span;
- ordered exposed segment IDs;
- attention trace;
- immediate emotional response;
- expectation entering/leaving;
- open question;
- confusion classification;
- strongest moment and passage reference;
- character pull;
- momentum;
- memorable detail;
- continue / skim / quit decision;
- quit point and reason when applicable;
- provider / model / runtime metadata when AI-assisted;
- run ID, timestamp and source-draft fingerprint.

Free-form commentary may accompany this evidence, but the structured harness envelope is authoritative for replay and revision comparison.

## Reader profiles and revision comparison

Target Reader, Skeptical Reader and Industry Reader are recommended persistent profiles. They are advisory review configuration, not canon. Keep a stable reader-profile identity across revision runs so DraftLens can compare behavior at the same Story Block coordinates without showing the reader its prior answers during the new blind read.

DraftLens may compare raw evidence after the read, including changed quit points, attention, confusion, expectation and recall. DraftLens diagnosis must remain separate from the raw reader observation that produced it.

## Boundaries

Fresh-reader feedback is advisory. It does not grade the writer, alter project state, grant tools, choose providers, approve creative changes, modify PlotPickle Score V1 or become PPF canon without explicit writer action.

Provider failure must not silently switch the reader to a paid/cloud provider. Reader observations never mutate Story Blocks, screenplay text, character canon or other Human-approved project decisions automatically.
