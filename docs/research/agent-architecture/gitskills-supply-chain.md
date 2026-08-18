# GitSkills and the Agent Skill supply chain

**Reviewed:** 2026-08-17  
**Primary paper:** GitSkills: A Dataset of Agent Skills on GitHub  
**Paper:** https://arxiv.org/abs/2608.10906

Additional related research reviewed:

- What Keeps Agent Skills from Being Reusable? Evidence from 138K SKILL.md Files: https://arxiv.org/abs/2608.08453
- Under the Hood of SKILL.md: Semantic Supply-chain Attacks on AI Agent Skill Registry: https://arxiv.org/abs/2605.11418

## Source-derived findings

GitSkills reports a July 2026 collection of:

- 3,797,117 `SKILL.md` file occurrences
- 282,200 public GitHub repositories
- 1,877,981 distinct file contents after grouping identical files

The dataset retains repository/path/content-hash information and enriches representative contents with parsed front matter, folder contents, repository metadata and some commit history in a self-contained SQLite research artifact.

The paper's motivating observation is important for PlotPickle: Skills are predominantly natural-language operational artifacts, are selected probabilistically at runtime, have no compiler/type checker proving selection correctness, and spread through repositories without a single central package manager.

Related 2026 research reports widespread packaging/routing defects in public Skills and demonstrates that Skill metadata/instructions can become a semantic supply-chain attack surface affecting discovery, selection and governance.

## PlotPickle interpretation

The public Skill ecosystem is a useful research/discovery corpus, not a trusted runtime registry.

PlotPickle should distinguish four things:

`Skill content` — procedure/instructions/resources  
`Skill provenance` — where this copy came from and which revision/hash it represents  
`Skill trust` — whether this Studio has reviewed/approved this exact content  
`Host capability` — what the local PlotPickle runtime actually permits

No combination of popularity, GitHub stars, publisher signature or Skill prose grants host authority.

## Intake model

`discover -> quarantine -> hash/pin -> structural validation -> static package inspection -> license/provenance review -> capability-request review -> focused eval -> human approval -> trusted progressive registry`

Important rules:

- external/community Skills are quarantined by default
- inspection does not execute bundled scripts
- changed source/hash can invalidate prior approval
- requested capabilities are not granted capabilities
- BUZZ transport/signatures prove origin/integrity, not safety or creative truth
- bulk corpus installation is explicitly out of scope

## How PlotPickle may use GitSkills later

Potential offline research/discovery searches include screenplay craft, character work, worldbuilding, continuity, visual development, posters/trailers, marketing, sales, QA and research procedures.

A useful public Skill can be:

1. studied as a pattern,
2. adopted only when license/provenance permit and it passes review/evals, or
3. re-expressed as a PlotPickle-native Skill grounded in our own authority model.

## Decisions adopted

- #976 adds host-owned Skill Trust Records and quarantine.
- #965 owns actual capability/egress decisions.
- #968 will evaluate Skill selection/quality/version changes as first-class artifacts.
- #963 will keep unapproved Skill text out of normal trusted task context.
- Future BUZZ Skill exchange lands in quarantine on the receiving Studio.

## Decisions not adopted

- No automatic search-and-install from millions of public Skills.
- No execution of arbitrary bundled Skill scripts during discovery/review.
- No popularity-based trust score as a security decision.
- No assumption that a signed Skill is safe, correct or appropriate for a project.

## Related issues

#963, #965, #968, #970, #976, #977.
