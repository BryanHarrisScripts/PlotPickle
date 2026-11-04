# ADR-0005: One Elara, connected factories, continuous improvement

Status: Proposed for repository acceptance; product-owner direction confirmed 2026-11-04  
Date: 2026-11-04  
Scope: PlotPickle-wide operating and product architecture

## Context

PlotPickle's Software Factory, storyboard/production, research/learning and gaming work have been described and managed as separate "factories." Engineering release gates, workers and process supervision became increasingly visible, while a usable end-to-end creative product remained unproven. Labels and separate workstreams must not create competing project truths or make creative work unnecessarily dependent on coding-worker availability.

The product owner's analogy is one factory able to make different products on different days: the equipment, recipes and verification change with the order. The equally important brain analogy is a persistent intelligence coordinating connected specialized functions, with software engineering able to improve their supporting structures.

Guiding principle: **Structure governs function.**

## Decision

1. **One Elara.** Elara is PlotPickle's persistent coordinating intelligence, not an agent contained inside the Software Factory. Software development, story/film production, research, learning, presentations/screenings and games share Elara's identity, authorized context, work history and mission continuity. Continuity must be implemented with durable state and authorized agents/runners; do not imply a ChatGPT chat continues executing in the background.
2. **One shared truth.** Factories, skills, plugins and human interfaces operate on the existing canonical project/PPF, Canon Binder, asset, task and evidence records. Existing ownership and provenance rules remain authoritative, including ADR-0004. Stable IDs, typed headless interfaces, version/source and truthful status must underpin both human UI and agent workflows. Do not duplicate story stores or rely on browser navigation to retrieve agent-accessible facts.
3. **Connected specialized factories.** Storyboard/film production, research, learning, gaming and presentation/screening are product capabilities or workflows, whether the human-facing label remains "Factory" or changes. They can compose one another and reuse approved assets, models, tools and project context. They are not separate agent operating systems.
4. **Software Factory evolves the structure.** It builds, repairs, tests and releases software capabilities used by the creative factories. Creative workflows provide observed failures, user needs and quality feedback to engineering, which returns verified capabilities to those workflows. The Software Factory does not own creative decisions, and creative deliveries are not all software releases.
5. **Independence with truthful degradation.** A coding worker or release gate that is offline must not prevent unrelated existing production, learning, presentation or playback features from working. A feature needing an unavailable provider or worker reports the actual limitation; it must not simulate success.
6. **Verification appropriate to the product.** Source changes retain approved test-truth, identity, independent review where required, CI, Windows acceptance and authorized release controls. Creative artifacts retain provenance, quality review and rights/canon approval as applicable. Shared orchestration must not be used to bypass either class of control.

## Design implications

- Elara can move from making a film to requesting a bounded software repair and back to that film without losing project, revision, shot or task context.
- A factory or plugin describes its inputs, outputs, tools, permissions, completion criteria, evidence and dependencies through existing contracts wherever possible.
- The same saved project and assets can support a story, storyboard, playable film, pitch, learning experience or later interactive game.
- Feedback to engineering is a traceable, prioritized requirement connected to a failed or missing creative capability, not an automatic mandate to create another subsystem.
- New terminology is not a reason to reorganize code or create additional agents, release gates, user interfaces or control planes.

## First implementation proof — Brotherly Love

Prioritize a usable, source-verifiable product slice over additional Factory infrastructure.

1. Open the existing Brotherly Love project and its selected saved revision from Library; preserve selection through Outline and Storyboard, without an Untitled fallback or duplicate workspace shell.
2. Expose Act 1 / Sequence 1 / Block 01 / Mini-Block 01 / Shot 01 through the same canonical structured/headless record and human Storyboard view. Display saved asset candidate, source/version, provenance and real saved/locked state; otherwise explicitly state what is missing.
3. Complete one real creative action (or consume one existing verified saved asset), persist its output, and demonstrate that it can be read back consistently in the human workspace and the authorized structured interface.
4. Capture one actual missing capability as a traceable Software Factory task, preserving the exact project/shot and acceptance criteria. Engineering execution and release use the existing authorized gates; if Worker 1 is offline, production still exposes its usable capabilities and the task remains honestly pending.
5. Resume the same creative project after the capability is available, with no re-import or manual re-creation of context. Subsequent slices should reuse the saved assets for pitch/screening and learning; gaming follows once a usable product exists.

**Acceptance evidence:** a reproducible owner-Windows walkthrough and matching structured record for the exact saved project/revision/shot; actual generated or saved artifact location/identifier; truthful runtime/source status; results of applicable checks. An engineering PR, a simulated worker cycle, a diagram or a screenshot without underlying durable truth is not sufficient to claim product delivery.

## Sequence and boundaries

- First inspect and reuse the existing implementation, including Agent Workspace #3355 and the current Brotherly Love source-truth work. Do not create duplicate systems or a new architecture program.
- Define progress by completed user-facing production orders, not counts of PRs or gates.
- Keep future learning, pitch/premiere and gaming opportunities visible as uses of the same foundation, but do not make a future feature a prerequisite to delivering the first usable storyboard.
- This ADR specifies direction and testable acceptance; it does **not** assert that Brotherly Love production, Worker 1 commissioning, or autonomous end-to-end delivery has already passed.

## Alternatives rejected

- Elara confined to the Software Factory and replaced by distinct assistants in every creative workflow.
- Multiple independent factories with competing project state, memories and agent-control planes.
- The Software Factory as a blocking prerequisite for unrelated creative runtime operations.
- Solving naming confusion through a wholesale rewrite, more control layers, or reduced security gates.

## Follow-up

Link this decision to the existing Agent Workspace and Brotherly Love acceptance work. Make the first verified Brotherly Love slice the next demonstrable product milestone. Revisit naming only after real workflows are connected and working.
