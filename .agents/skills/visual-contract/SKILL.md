---
name: visual-contract
description: Convert bounded PlotPickle story, visual-identity and Human image requirements into a provider-neutral constraint contract before generation.
license: MIT
metadata:
  author: PlotPickle
  version: "1.0.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/visual-contract
  progressiveDisclosure: true
---

# Visual Contract

Use this skill when PlotPickle is preparing a visual-generation request from approved project evidence. The skill organizes what must remain true before any provider-specific prompt is produced.

## Procedure

1. Read only the bounded request, canonical PPF/project facts, locked visual identity, approved references and visual-language context supplied by the host.
2. Separate requirements into three classes:
   - **Hard constraints** — explicit Human requirements and canonical/locked project facts. Preserve them exactly unless the Human or canonical authority changes them.
   - **Derived constraints** — minimum physical, spatial, relational or legibility requirements necessary to make the hard constraints coherent.
   - **Open choices** — genuinely unspecified details that a provider may resolve without changing a hard or derived constraint.
3. Assign every supplied visual reference one or more explicit roles such as identity, face, body proportion, pose, wardrobe, environment, composition, palette, lighting, typography, visual language or complete content. Never infer that image order alone grants authority.
4. Describe only the relevant macro scene, independently editable elements, ownership/relationships, geometry, composition, lighting and exact in-image text requirements.
5. Keep attributes attached to one clear owner. Keep relationships explicit whenever position, contact, support, gaze, containment, overlap or attachment affects the result.
6. Record failure controls for continuity breaks, invented facts, forbidden content, wrong counts, wrong text or other high-value generation errors.
7. Produce validation checks from the hard constraints, derived constraints and failure controls so an independent observer can evaluate the generated result.
8. Hand the contract back to the host. Provider adapters may translate the contract into provider syntax, but may not weaken or reorder its authority.

## Priority

Resolve conflicts in this order:
1. explicit current Human requirements;
2. canonical PPF/project facts and locked visual identity;
3. explicitly assigned reference roles;
4. physical/spatial/relational coherence;
5. established visual language and continuity rules;
6. provider capability constraints;
7. open decorative choices.

A lower-priority choice never overrides a higher-priority requirement.

## Authority boundary

The Visual Contract Skill does not select providers, spend money, store credentials, call image services, mutate PPF, accept/reject generated assets, unlock progression, publish to BUZZ, alter locked visual identity, edit code or change GitHub state.

The host owns provider routing, generation, persistence, acceptance policy and all side effects. PPF/project authority remains canonical. Locked Character Visual Identity and approved references remain authoritative where supplied.

## Provider neutrality

Do not encode a particular image vendor into the contract. ComfyUI, OpenAI Images or future providers may each receive a translated prompt, but the same Visual Contract remains the source of truth for the requested visual outcome.
