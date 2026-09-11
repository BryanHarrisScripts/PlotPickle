# PlotPickle Score

**PlotPickle Score** is PlotPickle's deterministic structural story rating. It gives a loaded story one memorable 0–100 headline score backed by five transparent component metrics: **Alignment, Verbosity, Erosion, Progression, and Coverage**.

PlotPickle Score is intentionally source-agnostic. Human-written, AI-assisted, AI-generated, imported, example, and native PlotPickle stories are evaluated by the same structural evidence contract. Authorship provenance does not increase or decrease the number.

## Product purpose

PlotPickle Score makes story structure measurable without turning mathematics or AI into creative authority.

It does not answer whether a movie is beautiful, original, emotionally moving, commercially successful, or culturally important. It answers a narrower structural question:

> How coherently does the available story evidence occupy, progress through, and distribute itself across PlotPickle's addressable narrative structure?

A sufficiently represented movie or story can therefore be rated by PlotPickle regardless of whether it was written by a Human, assisted by AI, or generated elsewhere and imported.

## Narrative coordinate model

PlotPickle takes fluid Human storytelling practices — acts, sequences, scenes, beats, setup/payoff, escalation, character movement and pacing — and converts them into a deterministic, time-addressable story model.

Instead of treating structure only as subjective advice, PlotPickle represents a feature hierarchically as:

`runtime → sequences → 24 Story Blocks → 96 Mini-Blocks → production units → frames/timecode`

Each level has a stable address, duration context, state, and relationship to the levels above and below it. Human writers and bounded AI agents can therefore inspect the same story against the same coordinates.

The governing relationship is:

`Human narrative principles → addressable story structure → measurable evidence → Human creative judgment`

PlotPickle does **not** claim that storytelling itself is mathematical. The writer still decides what a story means, what a character feels, whether a moment should breathe, and when a convention should be broken. PlotPickle makes the structure surrounding those decisions computable.

A concise description is:

> **PlotPickle does for narrative structure what timecode does for film: it gives creative material a precise address.**

This common coordinate model allows a structural observation to be located. Instead of only saying that "the middle feels slow," PlotPickle can identify the Blocks and Mini-Blocks with low progression, repeated evidence, unusual narrative load, or missing coverage.

## Architectural differences from traditional beat-sheet methods

PlotPickle shares ancestry with established screenplay structure systems, including sequence approaches, beat sheets, index-card boards, act models, and page-based pacing rules. Its architectural difference is that these ideas are represented as a **complete machine-addressable coordinate system** rather than only as Human-readable milestones.

### 1. Subdivision granularity

Traditional beat sheets usually define a relatively small number of qualitative landmarks. For example, the *Save the Cat!* Beat Sheet names 15 major beats, while its Board workflow commonly expands planning into roughly 40 cards. Those are useful Human planning tools, but they do not define one universal coordinate for every small interval of a feature.

PlotPickle's default feature scaffold divides the whole narrative surface into:

`24 Story Blocks × 4 Mini-Blocks = 96 Mini-Blocks`

For a normalized 120-minute feature:

- one Block corresponds to a 5-minute structural region;
- one Mini-Block corresponds to a 75-second structural region.

The important difference is not simply that 96 is larger than 15 or 40. **Every Mini-Block has identity.** A diagnostic, agent, visual, note, setup/payoff relationship, revision, or production artifact can point to a stable coordinate such as `Block 17 / Mini-Block 67` rather than only saying "somewhere in the second half."

### 2. Normalized time buckets instead of heuristic page landmarks

Traditional screenplay methods often express timing as recommendations or ranges: a beat should occur near a page, an act turn around a percentage, or a section across a span of pages. These are intentionally flexible Human heuristics.

PlotPickle adds a normalized temporal address space. In the default 120-minute profile, its canonical coordinates correspond to 5-minute Blocks and 75-second Mini-Blocks.

That does **not** mean every scene must last 75 seconds or that the writer is prohibited from stretching/compressing dramatic time. The buckets are coordinates, not creative handcuffs.

The distinction is:

`traditional method: "this event generally happens around here"`

versus:

`PlotPickle: "this evidence belongs to this stable structural address"`

That makes the same story readable by software without turning the coordinate system into creative authority.

### 3. Complete structural coverage

A milestone-based beat sheet intentionally leaves the material between major beats open-ended. Human writers fill that space through scenes, sequences, transitions, reversals, and invention.

PlotPickle preserves that creative freedom while also assigning the entire normalized feature surface an address. There is no structurally anonymous interval between named milestones: all 96 Mini-Block positions exist whether they are populated, intentionally sparse, incomplete, or overloaded.

That enables metrics which require a complete denominator, particularly **Coverage**:

`Coverage = populated Mini-Blocks / 96`

It also allows PlotPickle to distinguish "this region is intentionally quiet" from "this part of the story has no represented evidence yet" rather than treating both as an unexamined gap.

### 4. Persistent identity rather than disposable planning cards

A physical or digital index card is primarily a planning representation. PlotPickle's structural units are persistent product identities.

A Block or Mini-Block can remain the same address while its planning text, visual candidate, storyboard state, screenplay evidence, production material, or score changes over time.

That persistent identity allows PlotPickle to support:

- save/reopen continuity;
- revision comparison;
- setup/payoff references;
- visual provenance;
- agent context boundaries;
- targeted regeneration;
- diagnostics tied to exact story locations;
- future historical Score comparison.

The coordinate survives the revision. The content at the coordinate may change.

### 5. Multi-resolution mapping from story to production

Traditional structural methods generally stop at story planning or screenplay pages. PlotPickle continues the same address hierarchy downstream into technical production space.

The default scaffold can be represented as:

`12 sequences → 24 Blocks → 96 Mini-Blocks → 2,400 technical render slots → frame/timecode space`

This lets a high-level narrative observation be traced downward and a production artifact be traced upward. A render slot can belong to a Mini-Block, which belongs to a Block, which belongs to a sequence and Act/story context.

The **2,400 technical render slots are not a claim that every finished movie contains 2,400 editorial shots**. They are deterministic three-second production addresses. One creative shot or camera intention may occupy several technical slots.

### 6. Computational consequences

The coordinate system makes operations possible that are difficult to define consistently against a purely qualitative beat sheet.

Because units have stable addresses and a complete structural denominator, PlotPickle can deterministically calculate or assist with:

- structural **Alignment**;
- narrative **Verbosity**;
- structural **Erosion**;
- **Progression** between adjacent units;
- **Coverage** of the story surface;
- overloaded or unusually sparse regions;
- story-state continuity;
- setup/payoff tracing;
- bounded agent context;
- exact-location revision and regeneration;
- future before/after structural comparisons.

This is the key architectural distinction:

> **A beat sheet describes landmarks. PlotPickle adds an address system around the whole territory.**

The landmarks remain useful. PlotPickle's contribution is to make the territory between and around them addressable enough for Humans and software to reason about together.

## Five dimensions

All five internal dimensions normalize to 0–1. Display values use percentages.

### Alignment

**Higher is better.**

Alignment measures whether story evidence is coherently distributed across PlotPickle's structural coordinates. V1 considers Block presence, Act presence/balance, and Mini-Block ordinal balance.

Alignment does not require every unit to have equal length or equal creative importance. It detects gross structural concentration and absence.

### Verbosity

**Lower is better.**

Verbosity measures repeated or near-duplicate story units that consume structural space without enough new evidence. V1 uses deterministic normalized-text comparison rather than an LLM judge.

It is a structural redundancy signal, not a rule that dialogue, repetition, motifs, refrains, or deliberate echoes are artistically wrong.

### Erosion

**Lower is better.**

Erosion measures how much narrative mass is concentrated in disproportionately overloaded units. V1 uses bounded word mass and passage-type diversity to identify structural load substantially above the story's normal distribution.

The concept parallels software complexity concentration: a system can contain all required material yet still become hard to reason about when too much responsibility accumulates in a small number of units.

### Progression

**Higher is better.**

Progression measures whether adjacent populated story units materially differ instead of repeating or resetting the same evidence. V1 uses deterministic textual distinctiveness as a proxy.

Future versions may incorporate richer canonical state-transition evidence while retaining explicit score-version semantics.

### Coverage

**Higher is better.**

Coverage measures how much of the canonical 96 Mini-Block surface contains usable story evidence.

`Coverage = populated Mini-Blocks / 96`

Coverage is not the same as quality. A complete but weak story can have high Coverage; the other dimensions exist to keep completeness from being mistaken for structural health.

## Headline formula

V1 uses a geometric mean so a severe weakness cannot be hidden by strong averages elsewhere:

`Score = 100 × fifthRoot(Alignment × (1 − Verbosity) × (1 − Erosion) × Progression × Coverage)`

The displayed PlotPickle Score is rounded to the nearest whole number.

Verbosity and Erosion remain displayed as problem percentages, so lower values are better even though the formula uses their complements.

## Rating states

The headline has three evidence states:

- **NOT RATED / NR** — fewer than 8 populated Mini-Blocks. PlotPickle refuses to fabricate a quality number from too little evidence.
- **PROVISIONAL** — enough evidence to calculate a score, but less than 60% of the 96 Mini-Blocks are populated, or imported screenplay mapping has not reached reviewed state.
- **RATED** — at least 60% structural coverage and, for imported screenplay evidence, reviewed mapping.

The formula remains deterministic for provisional and rated stories. The state communicates confidence in structural completeness, not artistic certainty.

## Evidence selection

### Imported screenplay

When imported screenplay evidence exists, PlotPickle uses bounded `ImportedScreenplayPassage` records already mapped to Block and Mini-Block coordinates.

Imported screenplay evidence is preferred because it represents the source story rather than a later planning summary.

### Native PlotPickle story

When no imported screenplay passages exist, PlotPickle uses the most downstream non-empty canonical 24/96 stage content for each Mini-Block in this order:

1. storyboard;
2. build;
3. plan.

PlotPickle does not stack all three versions into one story unit merely to inflate evidence volume.

### Source neutrality

The scoring engine does not use AI provenance, provider identity, author identity, or generation history as positive or negative weight.

The same represented story should receive the same structural score regardless of who or what drafted it.

## Historical lineage

PlotPickle builds on established practices and does not claim ownership of standard film mathematics or long-standing story concepts.

Established precedents include:

- dimensional analysis and time/frame conversion;
- act, sequence, scene and beat-based screenplay structure;
- card and beat-sheet planning traditions;
- setup/payoff, escalation and pacing analysis;
- Average Shot Length and quantitative film-style analysis;
- frame-accurate timecode and production scheduling.

Frank Daniel's Sequence Approach, Blake Snyder's beat/card systems, and Barry Salt's quantitative film analysis are useful historical reference points, but PlotPickle's 24/96 model should not be presented as merely renaming any one of those systems.

## PlotPickle-specific design attribution

Within PlotPickle, the following are documented as **PlotPickle-specific design by Bryan Harris**:

- the canonical **24 Story Blocks → 96 Mini-Blocks** story-addressing model;
- the current **12 sequences → 24 Blocks → 96 Mini-Blocks** hierarchy;
- the PlotPickle vocabulary and deterministic identity of Blocks and Mini-Blocks in the product;
- the **PPF (PlotPickle Project File)** as durable story/canon authority;
- the deterministic mapping of the default feature scaffold into **2,400 addressable 3-second technical render slots** and **2,401 continuity boundaries**;
- the separation between creative story/shot intention and technical generation slots;
- the PlotPickle Score contract combining **Alignment, Verbosity, Erosion, Progression, and Coverage**;
- the geometric-mean headline formula and source-neutral Human/AI scoring policy.

This attribution is intentionally bounded. Documentation should use wording such as **"PlotPickle-specific design by Bryan Harris"** rather than claiming that no comparable concept has ever existed elsewhere.

## Dimensional coherence

The default 120-minute production scaffold can be represented as:

`Feature runtime → 24 Story Blocks → 96 Mini-Blocks → 2,400 technical render slots → frame/timecode space`

For the default render plan:

`24 Blocks × 4 Mini-Blocks × 25 render slots × 3 seconds = 7,200 seconds = 120 minutes`

At 24 fps:

`7,200 seconds × 24 frames/second = 172,800 frames`

This proves dimensional coherence of the production scaffold. It does **not** prove narrative quality and does not mean every finished film contains 2,400 editorial shots. A technical render slot is an addressable generation/continuity unit; one creative shot may span multiple technical slots.

A useful academic description of the structure is **hierarchical temporal partitioning** or **discrete temporal structural modeling**. "Fractal" may be used informally for nested repetition, but PlotPickle does not claim a mathematical fractal property that it does not calculate.

## Authority boundary

PlotPickle Score:

- reads story evidence;
- never mutates story canon;
- never automatically accepts creative changes;
- does not invoke an AI provider to determine the numeric V1 score;
- does not use provenance as a quality weight;
- does not replace Human review;
- does not claim artistic merit, audience approval, box-office prediction, or proof that PlotPickle improves films.

The PPF remains canonical story authority. PlotPickle Score is analysis.

## Dashboard contract

When an active story is loaded, the canonical Dashboard renders a dedicated **SCORE** section immediately below the Dashboard image.

It shows:

- `PLOTPICKLE SCORE`;
- 0–100 headline value or `NR`;
- `RATED`, `PROVISIONAL`, or `NOT RATED` state;
- story title;
- Alignment;
- Verbosity;
- Erosion;
- Progression;
- Coverage;
- compact evidence-basis information.

The presentation uses existing Skin tokens. The Score is a product capability, not a Skin-specific calculation.

## Versioning

The scoring contract is versioned. Historical scores must remain interpretable if deterministic proxies evolve.

A future revision may add stronger canonical state-transition analysis, scene timing, setup/payoff relationships, character-state evidence, or validated semantic features. Such changes must increment score semantics rather than silently redefining a previously stored or published number.

## Validation claim

PlotPickle Score creates a falsifiable structural rating framework. It does **not** by itself prove that PlotPickle produces better movies.

That larger claim requires comparative evidence: sufficiently large sets of PlotPickle-developed and control stories, predefined outcome measures, and statistical evaluation.

The bounded V1 claim is:

> **PlotPickle can deterministically rate represented story structure using a transparent five-dimension coordinate model, independent of whether the story originated with a Human or AI.**
