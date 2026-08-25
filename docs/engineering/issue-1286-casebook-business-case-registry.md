# Issue #1286 — Casebook Business Case Registry

PlotPickle Casebook now discovers Business Cases through a reusable contribution registry rather than requiring a central numbered execution list.

The registry contract keeps the Business Case definition as semantic authority and records ownership, capability, setup/cleanup references, Human Gate requirements, production fulfillment and UAT adapter references.

The first promoted 1:1 contracts are:

- Human connects an existing BUZZ identity;
- Human enters/reads the PlotPicklePlayhouse Great Hall through the signed-conversation case;
- Human configures/tests local ComfyUI and observes the generated image in PlotPickle.

Existing Casebook coverage that has not yet been promoted remains discoverable through generated legacy compatibility contributions. That avoids a broad UAT rewrite and lets migration remain business-case-first.

The central runner supports discovery/listing, selection by Business Case ID, plugin/owner, or capability, single-case retry, and release execution. Each selected attended case is delegated to the existing attended Casebook runner as an isolated process, preserving existing Human-only Gate behavior and preventing one failed case from mechanically blocking unrelated cases.

No React selectors, Agent IDs, room names, provider browser syntax, or product-specific execution order are embedded in the registry or central runner.