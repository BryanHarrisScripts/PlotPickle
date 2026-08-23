# GitSkills supply-chain research

Reviewed: **2026-08-18**

Primary source:

- https://arxiv.org/abs/2608.10906

## What the source contributes

GitSkills is useful research into discovering/reusing repository-derived skills for coding agents. For PlotPickle the important idea is not “install everything from GitHub”; it is that existing repositories can be mined as a large research/discovery surface for reusable procedural knowledge.

That makes GitSkills relevant to **research intake and candidate discovery**, not to the production trust registry.

## PlotPickle takeaways

Adopted as a research direction:

- repository/public-source discovery can suggest candidate Skills;
- provenance should retain the source URL/repository and exact revision;
- candidate Skills need deterministic content hashes so changed source content is detectable;
- candidates should be evaluated on real PlotPickle tasks before approval.

## Not adopted

- no bulk GitHub Skill installation;
- no automatic download on app startup;
- no automatic activation after discovery;
- no executable script run during intake/inspection;
- no assumption that popularity/stars/source visibility implies trust;
- no capability grant because a discovered Skill asks for one.

## PlotPickle intake position

A GitSkills-style discovery result would enter this pipeline:

`discovery result -> quarantine copy -> pin revision -> hash -> inspect -> licence/provenance review -> focused eval -> local human approval`

Until that pipeline is deliberately implemented beyond the first #976 slice, GitSkills remains a **research source only**.

## Related PlotPickle work

- #976 Skill trust/quarantine
- #968 Skill portability/quality evaluation
- #965 connector and network-egress authority
