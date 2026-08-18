# Graph Engineering patterns

**Reviewed:** 2026-08-17  
**Project-provided sources:**
- https://x.com/iiiichigo_chan/status/2083529217493303647
- https://x.com/AnatoliKopadze
- https://www.anthropic.com/engineering/building-effective-agents

## Source-derived patterns

The reviewed Graph Engineering material argues that the important design question is not how many agents to add, but how work, evidence and failure move through a system.

Key patterns:

- **State lives outside the chat transcript.** Keep the brief, evidence, node status, retry counts, approvals and budgets as explicit workflow state.
- **A node owns one bounded job.** Its input and output should be defined and machine-consumable where possible.
- **Edges represent real dependencies/data transfer.** If one job does not need the previous job's result, do not serialize it merely because the prompt listed it second.
- **Use the diamond:** fan out independent work, reduce/dedupe with ordinary code, verify, then synthesize.
- **Verification needs its own branch/context.** Do not ask the worker to be the sole skeptic of its own output.
- **Failure routes are part of the graph.** Important nodes need explicit `pass`, `retry`, `reroute`, `escalate` and `stop` outcomes.
- **Track time, token and risk budgets.** Parallel work can lower wall-clock latency while increasing total cost and risk.
- **Use deterministic anchors.** Tests, schemas, source evidence, PPF revisions and explicit writer approvals outrank model self-report.
- **Do not graph small or genuinely sequential work.** Graphs add coordination overhead and should be justified by real width, isolation or verification needs.

## PlotPickle interpretation

The graph is an orchestration layer over bounded Responsibility Runs, not a replacement for the Agent Profile/Skill/Context/Policy model.

Target pattern:

`bounded Run nodes -> real dependency edges -> fan-out -> code reduction -> verifier -> synthesis -> writer gate`

Creative graph workers should produce proposals/evidence, not mutate canonical PPF concurrently.

## Decisions adopted

- #967 uses typed node contracts and explicit dependencies.
- Parallelism is permitted only for genuinely independent work.
- Layered fan-in is preferred over dumping all raw child transcripts into one synthesis prompt.
- Missing child results are surfaced; a merge node knows how many children it expected.
- A verifier gets fresh/narrow context and evidence rather than the worker's full conversation.
- Hard caps exist for nodes, retries, parallelism, context/tokens and paid-cloud budget.

## Decisions not adopted

- Do not turn every Agent Skill into a graph.
- Do not introduce LangGraph/AutoGen solely to obtain graph vocabulary.
- Do not treat agreement among several agents as ground truth.
- Do not let graph topology bypass host policy or PPF revision rules.

## Related issues

#964, #966, #967, #968, #970.
