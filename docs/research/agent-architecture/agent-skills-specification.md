# Official Agent Skills specification

Reviewed: **2026-08-18**

Primary sources:

- https://agentskills.io/specification
- https://github.com/agentskills/agentskills

## What the source says

The Agent Skills specification defines a portable directory-based Skill whose main entry point is `SKILL.md`. The specification uses YAML frontmatter for core metadata such as the Skill name and description, with the remaining Markdown carrying procedural instructions. Skill packages can also carry supporting material such as scripts, references and assets. The format is designed so an agent can discover lightweight metadata first and load deeper content only when the Skill is relevant.

## PlotPickle takeaways

Adopted:

- Keep `.agents/skills/<id>/SKILL.md` as the portable filesystem-first package.
- Preserve progressive disclosure: shortlist metadata first; load a full Skill only when relevant.
- Treat scripts/references/assets as package contents that must be included in the package hash and trust inspection.
- Keep the reusable Skill format separate from PlotPickle's authority model.

Added by PlotPickle beyond the portable format:

- host-owned trust record;
- source provenance and pinned revision;
- SHA-256 package hash;
- quarantine/blocked states;
- static risk inspection;
- requested vs explicitly forbidden capability classes;
- eval revision/status;
- human approval for external Skills.

## Not adopted

- A Skill package does not grant tools, network access, credentials, provider choice, developer authority or PPF mutation simply by declaring or describing them.
- External Skill discovery is not production activation.
- A valid package shape is not sufficient evidence that the package is safe or appropriate for the current Studio.

## Related PlotPickle work

- `config/agent-skills.json`
- `config/agent-skill-trust.json`
- `scripts/agent-skill-trust.mjs`
- #965 connector/egress trust boundary
- #968 model/Skill portability evals
- #976 Skill supply-chain foundation
