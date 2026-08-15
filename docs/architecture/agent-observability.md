# PlotPickle agent observability

PlotPickle now exposes a small local-first operational trace for the agents that run through the Writing Assistant gateway: Sage Brinewick, Foundations Planner, Master Oaken-Vague, the Wyrmwood Curriculum Evaluator, and any future agent that uses the same chat route.

The trace is intentionally separate from model reasoning. It records operational metadata only: agent id, provider, runtime, model, model role, start/finish time, latency, success/failure, structured-vs-text output, character counts, and a short timeline of runtime events. It does not store prompts, responses, hidden reasoning, chain-of-thought, credentials, or project/story content.

Retention is session-memory only. Up to 100 runs are retained in the current local PlotPickle server process and disappear when the app restarts. The Settings workspace shows the most recent 40 runs and allows the user to clear the session immediately.

The local API is:

- `GET /api/writing-assistant/traces` — summary, privacy contract, and recent traces.
- `DELETE /api/writing-assistant/traces` — clear the in-memory session trace.

The observer is registered before the existing Writing Assistant gateway and passively watches the local JSON response metadata. It does not alter the request body, agent prompt, model selection, Mastra execution, provider configuration, or response returned to the product.

This shape deliberately resembles an agent trajectory: one run with ordered operational events. It gives PlotPickle a native observability contract that can later be adapted to external agent harnesses without making the core runtime depend on one harness.

DeepSeek Harness / `dsh` is not a dependency of this PR. Ollama publicly documents `ollama launch` for agent/coding integrations and built-in web-search support in compatible agent environments, but the specific DeepSeek Harness announcement supplied during development was newer than the currently indexed Ollama public documentation. PlotPickle therefore keeps the integration boundary open rather than silently installing or launching external software.
