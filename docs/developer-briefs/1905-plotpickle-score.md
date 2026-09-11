# Developer Brief — #1905 PlotPickle Score

## Purpose

Establish **PlotPickle Score** as a first-class, source-agnostic structural story rating that can be shown prominently whenever a story is loaded.

This is a core story-analysis capability, not an AI-judge feature and not a Skin-specific calculation. The score is derived deterministically from canonical story evidence and may be rendered by any current or future PlotPickle Skin.

## Product decision

The canonical Dashboard shows a dedicated **SCORE** section immediately beneath the Dashboard image whenever an active library story exists.

The headline value behaves like a familiar public rating surface: one memorable number from 0–100, backed by transparent sub-scores. A story without enough usable evidence is **NR** rather than receiving a misleading quality score.

PlotPickle Score must never reward or penalize authorship origin. A Human-written, AI-assisted, AI-generated, imported, example, or native PlotPickle story uses the same scoring contract.

## Five dimensions

All dimensions normalize to 0–1 internally and display as percentages.

| Dimension | Direction | V1 meaning |
| --- | --- | --- |
| Alignment | Higher is better | Story evidence is distributed coherently across the canonical 24 Blocks / 96 mini-blocks and across Acts and mini-block positions. |
| Verbosity | Lower is better | Repeated or near-duplicate story units consume narrative space without enough new evidence. |
| Erosion | Lower is better | Narrative mass is disproportionately concentrated into overloaded mini-blocks instead of remaining structurally distributed. |
| Progression | Higher is better | Consecutive populated story units materially differ rather than repeating/resetting the same evidence. |
| Coverage | Higher is better | The amount of the 96-mini-block structural surface that contains usable story evidence. |

## Headline formula

The V1 headline score uses the geometric mean so one severe structural weakness cannot be hidden by strong averages elsewhere:

`Score = 100 × fifthRoot(Alignment × (1 − Verbosity) × (1 − Erosion) × Progression × Coverage)`

Displayed component values remain intuitive: Verbosity and Erosion are shown as measured problem percentages with **lower is better** semantics.

## Evidence policy

### Preferred evidence

If an imported screenplay exists, use its bounded `ImportedScreenplayPassage` records because they are source story evidence already mapped to PlotPickle Block/mini-block coordinates.

### Native PlotPickle fallback

If no imported screenplay passages exist, use the most downstream non-empty canonical 24/96 stage content for each mini-block in this order:

1. storyboard;
2. build;
3. plan.

Do not combine all three versions into one unit merely to increase evidence mass.

### Rating states

- **unrated** — fewer than 8 populated mini-blocks; display `NR`.
- **provisional** — enough evidence to calculate, but fewer than 60% of the 96 mini-blocks are populated, or imported screenplay mapping has not reached `reviewed` state.
- **rated** — at least 60% structural coverage and, for imported screenplay evidence, the projection is `reviewed`.

The numeric formula remains deterministic in both provisional and rated states.

## V1 deterministic proxies

PlotPickle Score V1 deliberately avoids an LLM judge.

- Alignment uses Block presence, Act presence/balance, and mini-block ordinal balance.
- Verbosity uses exact duplicate and conservative near-duplicate comparison between story units.
- Erosion uses narrative word mass with a bounded passage-type diversity multiplier and detects units materially above the story's median/mean load.
- Progression uses adjacent populated-unit distinctiveness. This is a deterministic structural proxy, not a claim of semantic understanding.
- Coverage uses populated mini-blocks divided by 96.

These are versioned scoring rules. Future versions may add richer deterministic state-transition evidence without silently changing historical score semantics.

## Historical lineage and attribution

PlotPickle sits in a long tradition of dividing stories and films into manageable structural and temporal units. The documentation must distinguish that established lineage from PlotPickle-specific product design.

### Established lineage — not claimed as PlotPickle inventions

- **Dimensional analysis and frame/time conversion** are standard mathematics. Converting runtime into seconds or frames is not proprietary to PlotPickle.
- **Sequence-based screenplay structure** predates PlotPickle. Frank Daniel's Sequence Approach is commonly described as an eight-sequence method for feature screenplays. PlotPickle should cite that as historical context, not claim that its 24 Blocks are Daniel's method renamed.
- **Card/beat-sheet planning** predates PlotPickle. Blake Snyder's Save the Cat! system uses a 15-beat sheet and a roughly 40-card Board; this is useful precedent for discrete story planning, but it is not the source of PlotPickle's 96 Mini-Blocks.
- **Average Shot Length (ASL) and statistical film-style analysis** predate PlotPickle. Barry Salt is a major published figure in quantitative shot-length analysis.
- Broad concepts such as acts, sequences, scenes, beats, setup/payoff, pacing, runtime targets, and frame-accurate timecode are established screenwriting, editing, production, and film-analysis practices.

### PlotPickle-specific design credited to Bryan Harris

The following are documented as **PlotPickle-specific design choices by Bryan Harris**, without making the broader legal claim that no prior system anywhere has ever used a superficially similar idea:

- the PlotPickle **24 Story Blocks → 96 Mini-Blocks** canonical story-addressing model;
- the current **12 sequences → 24 Blocks → 96 Mini-Blocks** hierarchy used by PlotPickle;
- the PlotPickle vocabulary, interaction model, and deterministic identity of **Blocks** and **Mini-Blocks** inside the product;
- the **PPF (PlotPickle Project File)** as the durable story/canon authority used by the software;
- the deterministic production mapping from story structure into **2,400 addressable 3-second render slots** and **2,401 continuity boundaries** for the default 120-minute render plan;
- the deliberate separation between **creative story/shot intent** and **technical 3-second generation slots** so one creative shot may span multiple render slots;
- the PlotPickle Score product contract that combines **Alignment, Verbosity, Erosion, Progression, and Coverage** into one source-agnostic structural rating;
- the geometric-mean headline score and the policy that **Human and AI-authored stories are rated by the same structural evidence contract**.

Use wording such as **"PlotPickle-specific design by Bryan Harris"** or **"within PlotPickle, designed by Bryan Harris"** rather than unsupported claims such as "the first ever" or "unique in all of film history."

### Mathematical description

PlotPickle's default 120-minute production scaffold can be expressed hierarchically:

`Feature runtime → 24 Story Blocks → 96 Mini-Blocks → 2,400 technical render slots → frame/timecode space`

For the default render plan:

`24 Blocks × 4 Mini-Blocks × 25 render slots × 3 seconds = 7,200 seconds = 120 minutes`

At 24 fps that same runtime contains:

`7,200 seconds × 24 frames/second = 172,800 frames`

This equality demonstrates dimensional coherence of the production scaffold. It does **not** by itself prove narrative quality, nor does it claim that a finished movie must contain 2,400 editorial shots. PlotPickle Score is the separate structural-analysis layer intended to evaluate story evidence rather than merely confirm runtime arithmetic.

A useful academic description is **hierarchical temporal partitioning** or **discrete temporal structural modeling**. "Fractal" may be used informally to describe repeating nested organization, but the system should not claim mathematical fractal properties that it does not calculate.

## Narrative coordinate model

PlotPickle takes fluid Human storytelling practices — acts, sequences, scenes, beats, setup/payoff, escalation, character movement and pacing — and converts them into a deterministic, time-addressable story model.

Instead of treating structure only as subjective advice, PlotPickle represents a feature hierarchically as:

`runtime → sequences → 24 Story Blocks → 96 Mini-Blocks → production units → frames/timecode`

Each level has a stable address, duration context, state, and relationship to the levels above and below it. This allows Human writers and bounded AI agents to inspect the same story using shared coordinates and measurable evidence.

The central design principle is:

`Human narrative principles → addressable story structure → measurable evidence → Human creative judgment`

PlotPickle does **not** claim that storytelling itself is mathematical. A high structural score does not make a film artistically good, and a deliberate structural deviation may be exactly the right creative choice. The writer still decides what the story means, what a character feels, whether a moment should breathe, and when a convention should be broken.

PlotPickle makes the **structure surrounding those creative decisions computable**. The Score can therefore identify where a structural issue occurs rather than merely describe a vague impression. For example, instead of only reporting that "the middle feels slow," PlotPickle can identify Blocks and Mini-Blocks with low progression, repeated evidence, unusually high narrative load, or missing coverage.

A concise description of the model is:

> **PlotPickle does for narrative structure what timecode does for film: it gives creative material a precise address.**

That addressable model is what makes the five Score dimensions possible. Alignment, Verbosity, Erosion, Progression, and Coverage are all measured against the same structural coordinate system rather than being free-floating AI opinions.

## Authority and privacy

PlotPickle Score:

- reads canonical project/source evidence;
- does not mutate canon;
- does not invoke a provider;
- does not inspect AI provenance for bonus/penalty purposes;
- does not become creative authority;
- does not claim artistic merit, audience approval, box-office success, or proof that PlotPickle improves films.

It is a transparent **structural story rating**.

## Dashboard presentation

When an active story exists, render the SCORE section directly after the canonical Dashboard image and before the PlotPickle brand block.

Show:

- `PLOTPICKLE SCORE`;
- the 0–100 headline or `NR`;
- rating state (`RATED`, `PROVISIONAL`, `NOT RATED`);
- current story title;
- Alignment, Verbosity, Erosion, Progression, Coverage;
- a compact evidence basis note.

Use only Skin V1 design tokens. Do not create a score-only palette.

The Dashboard listens to the existing Project Library change event so switching, creating, importing, or saving the active story refreshes the visible score.

## Documentation contract

The root README must introduce PlotPickle Score as a core capability.

Durable system documentation lives at `docs/architecture/PLOTPICKLE-SCORE.md` and records:

- formula;
- five dimensions;
- evidence selection;
- rating states;
- source-agnostic Human/AI policy;
- historical lineage and Bryan Harris attribution;
- the narrative coordinate model;
- limitations;
- versioning/evolution rules.

The public claim is bounded: **any movie/story can be rated once its story evidence is represented in PlotPickle/PPF**. The score does not infer a film from nothing and does not equate structural score with artistic taste.

## Acceptance

1. Canonical score engine exists outside the UI.
2. Engine returns five dimensions, headline score, rating state, and evidence metadata.
3. Imported screenplay and native 24/96 evidence are supported.
4. No AI/provider call or provenance weighting participates in the numeric score.
5. Dashboard SCORE section is immediately beneath Dashboard art for an active story.
6. Insufficient evidence is `NR`.
7. README documents the feature.
8. System documentation preserves the complete V1 contract, lineage, Bryan Harris attribution, and narrative-coordinate rationale.
9. Focused regression verifies core contract, Dashboard placement, source neutrality, and docs.
10. PR Gate and Product Gate remain authoritative exact-head verification.