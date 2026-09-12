# PlotPickle C4-style Architecture Views

Generated projection of `architecture/plotpickle.architecture.json`. C4 is a view of the canonical map, not a separate model.

Source fingerprint: `sha256:92ad6f9591530ef3b5fb161edb5051f92d624f83da8c3d939f8d038ea9efee9c`

## System Context

```mermaid
flowchart LR
  human["Human author"] --> plotpickle["PlotPickle"]
  plotpickle --> canon["PPF Canon"]
  plotpickle <--> community["BUZZ / COMMUNITY PROVIDER"]
  plotpickle --> providers["AI / PROVIDER RUNTIME"]
  community -. candidate material .-> plotpickle
```

## Container view

```mermaid
flowchart TB
  human["Human author"]
  community["BUZZ / COMMUNITY PROVIDER"]
  bridge["BRING INTO STORY"]
  experience_skins["EXPERIENCE SKINS"]
  experience_contract["EXPANDED EXPERIENCE LAYER"]
  production_harness["GOVERNED PRODUCTION ORCHESTRATION"]
  agent_runtime["AGENT & SKILL MESH"]
  story_canon["STORY, CANON & EVIDENCE CORE"]
  provider_runtime["AI / PROVIDER RUNTIME"]
  verification["VALIDATION & OPERATIONS"]
  experience_skins -->|Semantic intents| experience_contract
  experience_contract -->|Validated requests| production_harness
  production_harness -->|Governed capabilities| agent_runtime
  agent_runtime -->|Candidates + evidence| story_canon
  story_canon -->|Scoped inference| provider_runtime
  production_harness -->|CALLS| community
  community -->|EVENTS| production_harness
  community -->|Selected material| bridge
  bridge -->|Candidate| story_canon
```

## Component view

```mermaid
flowchart TB
  subgraph experience_skins_components["EXPERIENCE SKINS"]
    experience_skins_1["Legacy Skin"]
    experience_skins_2["Skin V1"]
    experience_skins_3["Future skins"]
  end
  subgraph experience_contract_components["EXPANDED EXPERIENCE LAYER"]
    experience_contract_1["Semantic intents"]
    experience_contract_2["Results + revisions"]
    experience_contract_3["Capabilities"]
    experience_contract_4["Typed events"]
    experience_contract_5["Lean view models"]
    experience_contract_6["Surface registry"]
    experience_contract_7["Use-case pipeline"]
    experience_contract_8["Persistent context"]
    experience_contract_9["Reconciliation"]
  end
  subgraph production_harness_components["GOVERNED PRODUCTION ORCHESTRATION"]
    production_harness_1["Identity + authority"]
    production_harness_2["Policy, consent + budgets"]
    production_harness_3["Lifecycle + capability routing"]
    production_harness_4["Revision + provenance"]
    production_harness_5["Community capability"]
  end
  subgraph agent_runtime_components["AGENT & SKILL MESH"]
    agent_runtime_1["Guide + Story Council"]
    agent_runtime_2["Visual + character specialists"]
    agent_runtime_3["Resident Writer"]
    agent_runtime_4["Evidence learning"]
    agent_runtime_5["UI continuity + QA"]
  end
  subgraph story_canon_components["STORY, CANON & EVIDENCE CORE"]
    story_canon_1["STORY rules kernel"]
    story_canon_2["Context Engine"]
    story_canon_3["Story + evidence graph"]
    story_canon_4["References + candidates"]
    story_canon_5["Evidence / revision review"]
    story_canon_6["Explicit Human approval"]
    story_canon_7["PPF Canon"]
  end
  subgraph provider_runtime_components["AI / PROVIDER RUNTIME"]
    provider_runtime_1["Local LLMs"]
    provider_runtime_2["Compatible APIs"]
    provider_runtime_3["Vision models"]
    provider_runtime_4["ComfyUI"]
    provider_runtime_5["Media providers"]
  end
  subgraph verification_components["VALIDATION & OPERATIONS"]
    verification_1["Architecture Verification"]
    verification_2["Verification core"]
    verification_3["Live + runtime observers"]
    verification_4["Release + diagnostics"]
  end
```

For exact authority, component detail and migration state, inspect the canonical Architecture Knowledge Map and full architecture blueprint.
