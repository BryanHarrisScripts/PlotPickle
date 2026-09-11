# PlotPickle Mathematical Narrative Model

## Status and attribution

This document defines the mathematical foundation used by PlotPickle to make narrative structure addressable and measurable.

The underlying mathematics — normalization, interval partitioning, dimensional analysis, timecode arithmetic, distributions, weighted error, and statistical comparison — are established mathematical tools and are **not** claimed as inventions of PlotPickle.

The specific application of those tools inside PlotPickle — the 24 Story Block / 96 Mini-Block coordinate system, its relationship to PPF story authority and production addresses, and its use as the basis for PlotPickle Score — is documented as **PlotPickle-specific design by Bryan Harris**.

For internal shorthand, PlotPickle may describe this model as **Hierarchical Discrete Temporal Story Quantization (HDTSQ)**. This is a PlotPickle term for its own architecture, not a claim that HDTSQ is an established academic name for a field or standard algorithm.

## Core idea

A story unfolds continuously through time, but software cannot reliably reason about an unbounded phrase such as "somewhere in the middle." PlotPickle therefore maps story time onto a nested set of stable coordinates.

The governing relationship is:

`Human narrative principles → normalized time → addressable structure → measurable evidence → Human creative judgment`

For a default feature, PlotPickle's hierarchy is:

```text
Total Runtime T
      ↓
4 Acts
      ↓
12 Sequences
      ↓
24 Story Blocks
      ↓
96 Mini-Blocks
      ↓
Creative shots / scenes / beats (variable)
      ↓
Technical production slots (when applicable)
      ↓
Frame / timecode coordinates
```

The mathematical structure is deterministic; the creative content placed into it is not.

## 1. Temporal normalization

Let total runtime be `T` seconds and let a point in the story occur at time `t`, where:

`0 ≤ t ≤ T`

PlotPickle normalizes that position to a dimensionless coordinate:

`u = t / T`

Therefore:

`0 ≤ u ≤ 1`

This normalized coordinate is the key to comparing stories of different runtimes.

A beat at 45 minutes in a 90-minute film and a beat at 60 minutes in a 120-minute film both occur at:

`u = 0.5`

The same structural mathematics can therefore be applied to a 90-minute comedy, 120-minute thriller, or 180-minute epic without rewriting the coordinate system.

## 2. Frame capacity

For runtime `T` seconds and frame rate `FPS`, the nominal frame capacity is:

`F = T × FPS`

For a 120-minute feature at 24 fps:

`T = 120 × 60 = 7,200 seconds`

`F = 7,200 × 24 = 172,800 frames`

A time coordinate can be converted into a zero-based frame index by:

`f(t) = floor(t × FPS)`

subject to the media container's actual timebase, drop-frame rules, variable-frame-rate behavior, and editorial conform requirements.

The 172,800 equality is dimensional coherence. It is not a quality claim.

## 3. Hierarchical temporal partitioning

For a hierarchy containing `n` equal normalized regions, region `i`, using one-based indexing, has the normalized interval:

`I(i, n) = [(i - 1)/n, i/n)`

and nominal duration:

`Δt(n) = T / n`

PlotPickle applies the same addressing principle at multiple levels.

### Acts

With four Acts:

`Δt_act = T / 4`

For a 120-minute profile:

`Δt_act = 30 minutes`

Act `a ∈ {1,2,3,4}` occupies:

`[(a - 1)T/4, aT/4)`

### Sequences

The current PlotPickle feature scaffold uses 12 sequences:

`Δt_sequence = T / 12`

For a 120-minute profile:

`Δt_sequence = 10 minutes`

Each sequence contains two canonical Story Blocks.

### Story Blocks

With 24 Story Blocks:

`Δt_block = T / 24`

For a 120-minute profile:

`Δt_block = 300 seconds = 5 minutes`

Block `i ∈ {1,...,24}` has nominal boundaries:

`t_start(i) = (i - 1)T/24`

`t_end(i) = iT/24`

Its normalized interval is:

`[(i - 1)/24, i/24)`

### Mini-Blocks

Each Story Block contains four Mini-Blocks, giving 96 total:

`24 × 4 = 96`

Therefore:

`Δt_mini = T / 96`

For a 120-minute profile:

`Δt_mini = 75 seconds`

Mini-Block `j ∈ {1,...,96}` has nominal boundaries:

`t_start(j) = (j - 1)T/96`

`t_end(j) = jT/96`

The canonical conversion between a global Mini-Block number `j` and its Block address is:

`block(j) = ceil(j / 4)`

`ordinal(j) = ((j - 1) mod 4) + 1`

This gives every Mini-Block an exact structural address.

## 4. Coordinates, not creative handcuffs

The equal intervals define PlotPickle's **normalized address space**. They do not require every scene, beat, or creative shot to have equal duration.

A scene may span several Mini-Blocks. Several short scenes may occupy one Mini-Block. A writer may intentionally delay, compress, overlap, or omit a conventional event.

The mathematical bucket answers:

> Where in the normalized story space does this evidence belong?

It does not answer:

> How long is the writer permitted to let this moment breathe?

That distinction is central to PlotPickle.

## 5. Narrative evidence mapping

Let a narrative event or evidence item be `E_k` with observed time coordinate `t(E_k)`.

Its normalized coordinate is:

`u(E_k) = t(E_k) / T`

Its canonical Block address can be calculated by:

`B(E_k) = min(24, floor(24 × u(E_k)) + 1)`

and its canonical Mini-Block address by:

`M(E_k) = min(96, floor(96 × u(E_k)) + 1)`

with the terminal endpoint `u=1` clamped to the final unit.

This creates a deterministic mapping from continuous story time into discrete PlotPickle coordinates.

## 6. Structural drift

A narrative convention, planned milestone, or story-specific target may have an expected normalized coordinate `u_expected(k)` and an observed coordinate `u_actual(k)`.

Normalized structural drift is:

`δ_k = |u_actual(k) - u_expected(k)|`

The same error in seconds is:

`δ_seconds(k) = T × δ_k`

For a target expected at `u=0.50` that appears at `u=0.58`:

`δ = 0.08`

In a 120-minute film:

`δ_seconds = 7,200 × 0.08 = 576 seconds = 9.6 minutes`

A threshold should be profile- or target-specific rather than universally hard-coded. One possible Block-relative threshold is:

`δ_threshold = λ / 24`

where `λ` expresses the tolerated fraction of one Block. For example, `λ=0.5` means half a normalized Block width.

Crossing a threshold is a **structural anomaly signal**, not an automatic writing error. Deliberate deviation remains a Human creative decision.

## 7. Aggregate alignment from drift

For a set of `K` expected structural targets with non-negative weights `w_k`, normalized weighted drift can be defined as:

`D = (Σ w_k × min(1, δ_k / τ_k)) / Σ w_k`

where `τ_k` is the tolerated drift for target `k`.

A drift-based alignment score can then be expressed as:

`A_drift = 1 - D`

This produces:

`0 ≤ A_drift ≤ 1`

PlotPickle Score V1 currently uses deterministic distribution proxies for Alignment because not every loaded story contains trustworthy target-time evidence. Drift-based alignment is the natural extension once canonical timing evidence is sufficiently available.

## 8. Creative shots versus technical render slots

PlotPickle must distinguish two different concepts.

### Creative/editorial shot count

If a completed or measured film has Average Shot Length `ASL`, an estimated editorial shot count is:

`N_shot ≈ T / ASL`

This is descriptive film analysis. `ASL` varies by film, genre, sequence, director, and editing style. PlotPickle does not require a finished movie to use a three-second ASL.

### PlotPickle technical render grid

The default PlotPickle production plan uses a separate three-second technical generation slot:

`Δt_render = 3 seconds`

The number of technical slots is:

`N_render = ceil(T / Δt_render)`

For exactly 7,200 seconds:

`N_render = 7,200 / 3 = 2,400`

With fixed shared boundaries, that produces 2,401 boundary coordinates.

These are production addresses, not a declaration that the film contains 2,400 creative editorial shots. One creative shot may span multiple technical render slots.

## 9. Occupancy and coverage

Let each Mini-Block have an occupancy variable:

`x_j ∈ {0,1}`

where `x_j = 1` means usable story evidence is represented at Mini-Block `j`.

Coverage is:

`C = (Σ x_j) / 96`

This provides an exact denominator because all 96 canonical positions exist whether populated or not.

Coverage answers how much structural territory is represented. It does not answer whether the represented material is good.

## 10. Narrative load and erosion

Let `L_j ≥ 0` represent deterministic narrative load for Mini-Block `j`. V1 approximates load from bounded text mass and evidence-type diversity.

Let `O` be the set of Mini-Blocks classified as overloaded under the active score version's threshold.

Structural erosion is:

`E = (Σ_{j∈O} L_j) / (Σ_j L_j)`

This measures how much of the story's represented narrative mass is concentrated inside disproportionately overloaded units.

Low Erosion means narrative responsibility is comparatively distributed. High Erosion means a relatively small set of units carries an unusually large fraction of the story's structural load.

## 11. Redundancy and verbosity

Let `r_j ∈ {0,1}` indicate that populated unit `j` is deterministically classified as redundant under the active score version.

A simple unit-based Verbosity measure is:

`V = (Σ r_j) / N_populated`

where `N_populated` is the number of represented Mini-Blocks.

Future versions may use weighted redundant time or evidence mass:

`V_mass = redundant narrative mass / total narrative mass`

The purpose is to quantify repeated structural evidence, not to forbid intentional motifs, refrains, thematic recurrence, or repetition as an artistic device.

## 12. Progression

Let `S_j` denote the represented story state or deterministic evidence signature at populated Mini-Block `j`.

An ideal state-transition formulation is:

`p_j = 1 if S_j materially differs from S_(j-1), else 0`

Then:

`P = Σ p_j / (N_transitions)`

PlotPickle Score V1 uses deterministic adjacent-unit textual distinctiveness as a proxy because canonical semantic state vectors are not yet guaranteed for every imported story.

Future score versions may construct richer state vectors including plot condition, character state, relationship state, audience knowledge, stakes, setup/payoff state, and world condition.

## 13. PlotPickle Score

The five normalized dimensions are:

- `A` = Alignment;
- `V` = Verbosity;
- `E` = Erosion;
- `P` = Progression;
- `C` = Coverage.

The PlotPickle Score V1 headline formula is:

`PPScore = 100 × (A × (1 - V) × (1 - E) × P × C)^(1/5)`

The geometric mean is deliberate: a severe weakness in one dimension cannot be completely hidden by strong values elsewhere.

The formula rates structural evidence. It does not measure artistic worth.

## 14. Why normalization matters

Raw clock time alone makes cross-film comparison difficult. Normalized coordinates make structural position dimensionless.

For runtime `T`, a normalized position `u` converts back to time by:

`t = uT`

The same Block/Mini-Block coordinate system therefore scales automatically with runtime.

For example, Mini-Block width is:

`T/96`

which yields approximately:

- 56.25 seconds for a 90-minute film;
- 75 seconds for a 120-minute film;
- 112.5 seconds for a 180-minute film.

The identity of Mini-Block 48 remains structurally comparable even though its raw duration changes with the runtime profile.

## 15. Deterministic anomaly reporting

Once an observation is mapped to a coordinate, PlotPickle can report the location and magnitude of a deviation instead of only offering an impression.

Examples include:

- expected structural event shifted by `+0.06T`;
- Mini-Block 55 exceeds its active load threshold by 1.8×;
- Blocks 13–16 contain seven adjacent units with low progression evidence;
- 18 of 96 canonical positions currently contain no usable evidence;
- repeated evidence occupies 11% of represented Mini-Blocks.

This changes feedback from:

> "The middle feels slow."

into evidence such as:

> "Blocks 13–16 contain 16 Mini-Blocks; seven currently show low progression, three repeat earlier evidence, and Block 15 carries 2.1× the median narrative load."

The Human remains free to decide that the detected pattern is intentional and correct.

## 16. Mathematical narrative principle

The mathematics are core to PlotPickle's narrative architecture because they provide the **coordinate system**, not because mathematics replace storytelling.

The model separates three layers:

1. **Mathematical address** — where evidence exists in normalized story time.
2. **Measured structural evidence** — what deterministic properties can be observed at and between those addresses.
3. **Creative judgment** — whether the observed structure serves the story.

PlotPickle owns the first two as software responsibilities. The third remains Human authority.

The resulting principle is:

> **Mathematics gives the narrative an address. Evidence gives the address meaning. The Human decides whether that meaning serves the story.**

## 17. Versioning and falsifiability

The mathematical contract must be versioned. Changing a threshold, weighting, state model, or metric definition must not silently redefine historical scores.

PlotPickle should therefore preserve:

- score-model version;
- runtime profile;
- frame/timebase assumptions where relevant;
- evidence basis;
- populated coordinate count;
- component metrics;
- headline score.

This makes PlotPickle Score reproducible and allows future empirical studies to compare the framework against external outcomes without moving the scoring rules after seeing the results.
