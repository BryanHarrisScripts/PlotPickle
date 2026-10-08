# PP-NARR-SEQ-001 — Sequence-Led Graphic Novel Storytelling

**Status:** PROPOSED Human-truth refinement; implementation candidate under #2855. No automatic amendment of approved PP-NARR-001 v1.0.0.
**Source:** Human Windows UAT on October 8, 2026 (seven bubble proposals, including the incorrect "FADE IN" result; sparse outcomes especially after Shot 10); [AI Programming Evolution white paper](../white-papers/AI_Programming_Evolution_White_Paper.md); [PP-NARR-001](./PP-NARR-001.md); [PP-COMP-002](./PP-COMP-002.md).

## Human intent

The selected 25 approximately three-second Storyboard images tell one coherent ~75-second part of the movie, rather than 25 unrelated captions. The words capture genuine dialogue, dramatic tension, important change and the audience's questions—not screenplay formatting. The story can be stronger with a text-free frame; only the Human commits **No Bubble**.

The screenplay page-per-minute rule is approximate; it must **never** be converted into a compulsory page number, invented screenplay event, or one-to-one passage-to-Shot allocation.

## Behavioural truths, with independent proof boundaries

| ID | Human promise | Observable, separately testable rule |
| --- | --- | --- |
| SEQ-T1 | Understand the opening sequence before captioning a selected Shot. | Agent receives original-order, formatting-filtered screenplay plus the authored intentions for all 25 positions. No fabricated Beat map. |
| SEQ-T2 | Each image contributes to one progressing story. | Do not map a passage using Shot index / passage count or repeat the final passage for Shots 11–25 by arithmetic default. A Shot with insufficient authentic evidence cannot be made green through filler. |
| SEQ-T3 | "FADE IN" is never the story we print. | Screenplay transitions, sluglines, page/Shot metadata and formatting commands are excluded from source prose and rejected if returned as captions. Authored on-screen titles would need separate explicit provenance, not accidental acceptance as a transition. |
| SEQ-T4 | Dialogue comes from the actual character, not the generator. | A bubble quotes contiguous screenplay dialogue with its actual speaker, never invented speech. Correct placement within the moment remains subject to Human review if the project contains no explicit Shot-to-line anchor. |
| SEQ-T5 | Words serve character pressure, revelation and suspense. | Target 5–8 words, maximum 12, in a single caption **or** speech bubble; no generic camera label. The Human judges artistic quality; CI cannot prove an emotional hook. |
| SEQ-T6 | The Human owns text, silence and recovery. | Existing Save & Lock / Regenerate / No Bubble, exact locked image, local Quality writer, cross-surface Previs parity and restart readback remain unchanged. No silent regeneration or overwrite. |
| SEQ-T7 | Missing evidence and failed output stay visibly unresolved. | Zero authentic screenplay/Shot intention is not treated as creative success; empty/invalid compute doesn't silently create an approved bubble or a new story event. |

## Mathematical / state constraints

For Mini-Block `M` and selected Shot `p ∈ {1,…,25}`, define `S(M)` as the authored-order screenplay passages (excluding structural format-only lines), and `I(M)` as 25 positions with their existing authored visual intentions (empty when unknown).

- `Candidate(p) => 1 <= p <= 25 AND |I(M)| = 25 AND (|S(M)| > 0 OR I(M)[p].intention != "")`.
- `SeqContext(p) = (S(M), I(M), p)`; no function of `floor(p * |S(M)| / 25)` is allowed to declare passage ownership.
- `PrintedCaption(p) => NOT StructuralFormattingDirective(text)`.
- `Dialogue(p) => ContiguousScreenplayQuote(text) AND ExactScreenplaySpeaker`. Lexical proof is necessary, not sufficient, for semantic placement.
- `WordCount(printedExpression) <= 12`.
- `Failure(p) => NoMutation(LockedImage, ApprovedBubble, OtherShots, StoryCanon)`.
- `ConfirmedSave(p) => DurableCommit(p)` and `CurrentStoryboardText(p) = CurrentPrevisText(p)` across supported restart.
- `CIGreen != HumanCreativeQualityAccepted`.

## Implementation / evaluation strategy

1. Keep the UI, writer and source-key authorities already approved. Use a pure, reviewable sequence-evidence collector; **no additional mutable canon store**.
2. Pass original screenplay order (not opaque passage-ID sort) and the **real authored** intents of all 25 shots. Remove structural instructions from author-facing prose. Use a single locally configured Quality writing request to interpret the dramatic progression before generating a selected-shot draft; no implicit Cloud or Hybrid selection.
3. Reject output that reproduces screenplay format directives even if syntactically short.
4. Independently check the format leaks (FADE IN, CUT TO, scene headings), sparse five-line screenplay across all 25 Shots, missing evidence, wrong dialogue speaker, source identity, Save & Lock, No Bubble and Previs readback. Run the existing impact-selected Windows proof.
5. Real local inference and whether the first 25 Afterglow frames communicate the intended hook remain **UNPROVEN** until Human Windows UAT. Preserve already approved printed decisions as stored, and keep creative changes reviewable.

**Explicit limitation:** Sequence context enables the selected-shot writer to consider the whole story but does not magically create a true scene/beat-to-shot semantic anchor where no author has established one. Such placement is still subject to artistic review. This iteration is not a certified autonomous Story Director or guarantee of 25 high-quality outputs.
