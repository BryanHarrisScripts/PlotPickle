# PlotPickle Writer-in-Residence

The Writer-in-Residence is a synthetic product-research agent that behaves like a first-time writer rather than a deterministic QA script.

## Purpose

PlotPickle already has focused UAT and an older deterministic Creative Writer UAT. Those systems answer whether known contracts work. The Writer-in-Residence answers a different question: **what does the current product feel like to a writer trying to accomplish a real creative goal?**

The first persona is **Avery North**, an aspiring screenwriter with no PlotPickle knowledge and a disposable original story, **The Last Crossing**. The agent is asked to orient itself, use LEARN, talk naturally with Sage, apply learning in PLAN/Foundations, revisit progress, and try Wyrmwood when it seems relevant.

## Human-like boundary

The agent is deliberately blind to implementation details.

It may use only:

- Playwright MCP accessibility snapshots;
- visible click actions;
- visible typing actions;
- approved PlotPickle route navigation;
- short waits when the UI is visibly loading.

It does **not** use `browser_evaluate`, DOM inspection, localStorage, source files, tests, logs, repository files, credentials, developer tools, or GitHub. The Playwright MCP runtime may expose developer-oriented tools, but this agent never calls them.

The browser profile is isolated under `%LOCALAPPDATA%\PlotPickle\writer-in-residence\<session>`. It does not reuse the writer's normal browser profile.

## Experience diary

Every session stores a local JSON report and a readable Markdown diary. Observations can be:

- positive;
- confusion;
- friction;
- need;
- possible bug;
- abandonment risk.

The diary keeps all observations locally. Only distinct **medium/high actionable** observations are eligible for GitHub promotion, with a maximum of five per session by default.

## GitHub and Modem

Run:

```text
node scripts/run-writer-in-residence.mjs --github-report
```

The deterministic reporter creates or updates GitHub issues using labels such as:

- `synthetic-writer`
- `product-feedback`
- `needs-triage`
- `experience:need`
- `experience:friction`
- `experience:confusion`
- `experience:bug`
- `experience:abandonment-risk`

Every issue explicitly states that the source is an AI synthetic writer and **not a real customer**. Because Modem is already connected to the PlotPickle GitHub repository, these issues can become product-intelligence input while remaining distinguishable from future human feedback.

## Repair boundary

Writer-in-Residence feedback does not automatically create a PR and does not receive `uat:auto-repair` by default.

A synthetic writer can misunderstand a product just as a human can. Confusion may be the product problem; it is not automatically a code defect. Technical-looking findings must first be reproduced by a human or deterministic UAT. Once verified, the normal PlotPickle path applies:

`verified defect -> UAT issue -> Pi/Cline local repair -> isolated worktree -> regression -> build/UAT -> draft PR -> GitHub CI`

This keeps the product-research role separate from the engineering-repair role.

## Commands

Default exploratory session with local diary only:

```text
node scripts/run-writer-in-residence.mjs
```

Promote medium/high actionable findings to GitHub for Modem:

```text
node scripts/run-writer-in-residence.mjs --github-report
```

Short smoke session:

```text
node scripts/run-writer-in-residence.mjs --max-turns 8
```

Use another local PlotPickle server:

```text
node scripts/run-writer-in-residence.mjs --base-url http://127.0.0.1:5173 --github-report
```

The agent uses the configured local PlotPickle Writing Assistant runtime. It prefers the Quality role when available and falls back to Fast. It does not activate a cloud provider.
