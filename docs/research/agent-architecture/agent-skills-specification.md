# Official Agent Skills specification notes

**Reviewed:** 2026-08-17  
**Specification repository:** https://github.com/agentskills/agentskills  
**Specification:** https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx

## Source-derived format

The official Agent Skills format defines a Skill as a directory containing at least `SKILL.md` with YAML front matter plus Markdown instructions.

A Skill may also contain optional resources such as:

- `scripts/` — executable code
- `references/` — documentation loaded when needed
- `assets/` — templates/static resources

The required front-matter fields are `name` and `description`. The format is designed for **progressive disclosure**:

1. discovery loads small metadata such as name/description
2. activation loads the full `SKILL.md`
3. additional resources are read only when required

The specification also documents an experimental `allowed-tools` field. Support can vary by client.

## PlotPickle interpretation

PlotPickle adopts the portable procedure format and progressive-disclosure idea, but does **not** treat Skill metadata as a permission grant.

Even if an external Skill contains `allowed-tools`, mentions shell commands, requests network access or says it may write files, the local PlotPickle host remains the authority.

Target separation:

`Agent Profile = identity/responsibility`  
`Agent Skill = procedure`  
`Context Engine = trusted/bounded task information`  
`Host Policy = actual permissions/egress`  
`Capability Router = actual model/runtime`

## PlotPickle rules

- Production-discoverable Skills require a host-owned Skill Trust Record.
- External Skills are quarantined by default.
- Bundled scripts are inspected without execution during intake.
- Skill source/revision/content SHA-256 becomes part of provenance and eval identity.
- A Skill cannot grant itself tools, model/provider selection, credentials, PPF mutation or GitHub/developer authority.
- Full procedure bodies are loaded only when needed; the progressive index exposes only safe discovery metadata.

## Decisions adopted

- Keep `.agents/skills/<id>/SKILL.md` as the primary portable procedure form.
- Preserve current `skill://plotpickle/...` stable URIs and progressive discovery.
- Keep resources small and focused so they can be loaded on demand.
- Validate structural metadata and host trust separately.

## Decisions not adopted

- Do not interpret experimental `allowed-tools` as host permission.
- Do not auto-execute `scripts/` simply because the Skill includes them.
- Do not require a central public package manager for PlotPickle operation.
- Do not expose every installed Skill body in every model context.

## Related issues

#913, #962, #963, #965, #968, #976, #977.
