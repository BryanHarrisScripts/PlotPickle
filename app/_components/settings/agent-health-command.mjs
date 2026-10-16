// All Agent Health commands are bounded and handled before free-form DSDD input.
// A status/registry check is never presented as a successful agent I/O test.
const PREFIX = /^\/?plotpickle\s+agents(?:\s|$)/iu;
const MAX_REQUESTS = 16;
const MAX_ELAPSED_MS = 120_000;
const PER_REQUEST_MS = 22_000;
const HELP = "PlotPickle agents inventory | status | report | test quick [local] | test one <agent-id> [local] | cancel | confirm <16-character-token> [CHARGES SHARE]. No inference is started until a preview is confirmed.";
const CLOUD = new Set(["openai", "gemini", "minimax"]);

export function parseAgentHealthCommand(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!PREFIX.test(text)) return null;
  const words = text.replace(PREFIX, "").trim().split(/\s+/u).filter(Boolean);
  if (!words.length || (words.length === 1 && ["inventory", "status", "report", "cancel"].includes(words[0])))
    return { action: words[0] || "inventory" };
  if (words.length === 2 && words[0] === "test" && words[1] === "quick") return { action: "test", selection: "quick", localOnly: false };
  if (words.length === 3 && words[0] === "test" && words[1] === "quick" && words[2] === "local") return { action: "test", selection: "quick", localOnly: true };
  if ((words.length === 3 || words.length === 4) && words[0] === "test" && words[1] === "one"
      && /^[a-z0-9][a-z0-9:-]{1,90}$/u.test(words[2])
      && (words.length === 3 || words[3] === "local"))
    return { action: "test", selection: "one", agentId: words[2], localOnly: words[3] === "local" };
  if (words[0] === "confirm" && (words.length === 2 || words.length === 3 || words.length === 4)
      && /^[a-f0-9]{16}$/u.test(words[1])
      && words.slice(2).every(x => ["charges", "share"].includes(x))
      && new Set(words.slice(2)).size === words.slice(2).length)
    return { action: "confirm", token: words[1], charges: words.includes("charges"), share: words.includes("share") };
  return { action: "invalid" };
}
function err(message) { return "BLOCKED: " + message; }
function safeResponseText(value) {
  return typeof value === "string" ? value.trim() : "";
}
function schemaValid(role, text) {
  const response = safeResponseText(text);
  if (response.length < 18 || response.length > 40_000) return false;
  let obj;
  try { obj = JSON.parse(response); } catch { obj = null; }
  if (role === "story-architect")
    return Boolean(obj?.structural?.state && Array.isArray(obj?.characters)
      && Array.isArray(obj?.miniBlocks) && obj.miniBlocks.length === 4
      && obj.miniBlocks.every((b, i) => b.ordinal === i + 1 && Array.isArray(b.passageIds)));
  if (role === "foundations-planner") return typeof obj?.values?.["output-1"] === "string" && obj.values["output-1"].length > 3;
  if (role === "discovery-mapper") return [1, 2, 3, 4].includes(obj?.act) && typeof obj?.lane === "string" && Array.isArray(obj?.evidenceRefs);
  if (role === "wyrmwood-rival-director") return Boolean(obj?.pickle?.goal && obj.rivals && Object.keys(obj.rivals).length === 5);
  if (role === "wyrmwood-curriculum-evaluator") return Boolean(obj?.dimensions?.storyLogic !== undefined && obj?.whatWorked?.length && obj?.teachingDebrief);
  // A freeform advisory smoke does not certify a story/canon or BUZZ side effect.
  return response.length >= 24 && response.toLowerCase() !== syntheticPrompt(role).toLowerCase();
}
function syntheticPrompt(role) {
  const story = "SYNTHETIC NONCANON FICTION: Nia leaves a brass compass on a table. Later, Taro takes it before Nia returns. No real writer, private PPF, location, memory, or character is involved.";
  const general = "Using this synthetic fiction, give one role-specific observation or proposal, without changing project state: " + story;
  const prompts = {
    "curriculum-guide": "Teach one general story-craft principle using this invented scenario, without claiming a specific PlotPickle lesson: " + story,
    "foundations-planner": "Provide a provisional one-sentence logline for this synthetic exercise in field output-1. " + story,
    "discovery-mapper": "Classify this entirely synthetic plot detail into Act 1; explain your placement, with evidenceRefs using only synthetic-01. " + story,
    "story-architect": "Assess ONE synthetic Outline Block with source passage synthetic-01: " + story + " Return the Story Architect schema, a structural assessment, characters and EXACTLY four source-linked Mini-Block entries. Unsupported portions must be marked unsupported rather than invented as canon.",
    "wyrmwood-rival-director": "Using a synthetic, noncanonical Wyrmwood learning exercise about choices and consequences, generate one Pickle and the five fixed rivals' different moves. Do not mutate gameplay or story.",
    "wyrmwood-curriculum-evaluator": "Evaluate this fictional turn using the six required learning dimensions: the learner used the compass without checking permission, then apologized. Provide what worked, what needs work and a teaching debrief. No real game state.",
    "graphic-novel": "Write two concise narration sentences for this synthetic storyboard still without claiming an image was supplied: " + story,
    "character": "Observe one character motivation and note what is unsupported in this synthetic excerpt: " + story,
    "world": "Give one spatial/environmental observation and one missing world fact: " + story,
    "screenwriter": "Propose ONE screenplay-format action beat for this fiction, no private draft: " + story,
    "production": "Suggest one read-only production planning concern for this fictional scene: " + story,
    "workflow-change": "Identify one safe review checkpoint for changing a synthetic screenplay workflow, no code or project writes.",
    "continuity": "Identify which character possesses the brass compass after Taro takes it, and one uncertainty: " + story,
    "critic": "Give one constructive story-craft critique on this invented excerpt: " + story,
    "creative-director": "Propose one noncanonical cinematic framing idea for: " + story,
    "visual-director": "Suggest one storyboard composition for this fictional scene without creating an image: " + story,
  };
  return prompts[role] || general;
}
function statusLabel(item, buzz, mastra) {
  if (item.testMode === "mastra") return mastra?.mastra?.ready && mastra.mastra.agents?.includes(item.roleId) ? "registered, I/O not tested" : "Mastra unavailable/not registered";
  if (item.owner === "buzz-managed" || item.owner === "buzz-actor" || item.owner === "external-buzz-peer") {
    const actor = buzz?.agents?.find(x => x.actorId === (item.profileId || item.id.replace("buzz-actor:", "")));
    return !buzz?.identityVerified ? "BUZZ not verified" : !actor ? "BUZZ actor absent from live official roster" : actor.verified ? "BUZZ identity verified, I/O untested" : "BUZZ identity unverified";
  }
  return "registered only; on-demand worker/observer I/O untested";
}
function summarize(census, buzz, mastra) {
  const entries = census?.entries || [];
  const warnings = census?.warnings || [];
  return ["AGENT INVENTORY — no model requests, BUZZ messages or project mutation.",
    "Discovered " + entries.length + " distinct source entries (aliases deduplicated). " + JSON.stringify(census.sources || {}),
    ...entries.map(x => x.id + " | " + x.owner + (x.roleId ? " / " + x.roleId : "") + " | " + statusLabel(x, buzz, mastra)),
    ...warnings.map(x => "WARNING: " + x),
    "External BUZZ peers are NOT enumerable from the existing official-only roster endpoint; exhaustive dynamic-peer coverage is UNVERIFIED.",
    "0/" + entries.length + " live I/O results in this registry view. " + HELP,
  ].join("\n");
}
function resultRow(x) {
  return x.id + ": " + x.result + " [" + x.stage + "] " + x.reason
    + (x.provider ? "; route=" + x.provider + "/" + (x.model || "unknown") : "")
    + (Number.isFinite(x.latencyMs) ? "; observed latency=" + x.latencyMs + "ms" : "")
    + (x.dispatch ? "; dispatched=" + x.dispatch : "; dispatch=not proven");
}
function report(census, results, provider, title) {
  const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, UNKNOWN: 0 };
  for (const x of results) counts[x.result]++;
  const complete = results.length === census.entries.length;
  const healthy = complete && results.length > 0 && results.every(x => x.result === "PASS");
  return [title, "Route: " + provider + ". Coverage: " + results.length + "/" + census.entries.length
    + " accounted for; live PASS: " + counts.PASS + ". " + JSON.stringify(counts),
    healthy ? "All reported I/O contracts passed." : "NOT ALL AGENTS VERIFIED. Registry presence, BUZZ presence and HTTP success are not output proof.",
    ...results.map(resultRow),
    "No test output, private story, API credentials or synthetic prompts were saved in PPF. Usage/cost unknown unless independently reported by provider.",
  ].join("\n");
}
function blockedRow(item, reason) {
  return { id: item.id, result: "BLOCKED", stage: "execution-owner", reason };
}
function notSelected(item) {
  return { id: item.id, result: "SKIPPED", stage: "human-scope", reason: "Excluded by explicit one-agent/local-only selection; no inference." };
}
export function createAgentHealthCommandSession(services) {
  let pending = null, last = null, working = false;
  async function read() {
    const [compute, mastra, buzz, route] = await Promise.all([
      services.request("/api/writing-assistant/agent-compute"),
      services.request("/api/writing-assistant/status"),
      services.request("/api/local-buzz/agent-roster").catch(() => ({ identityVerified: false, agents: [] })),
      services.request("/api/ai-routing/status"),
    ]);
    const census = compute?.agentHealthCensus;
    if (!Array.isArray(census?.entries) || census.entries.length < 20) throw Error("Agent registry census is unavailable; refuse partial success.");
    return { census, mastra, buzz, route };
  }
  return { async execute(command) {
    if (working) return err("An Agent Health operation is already running. No duplicate request.");
    working = true;
    try {
      if (command.action === "invalid") return err("Unrecognized Agent Health command. Input withheld from transcript. " + HELP);
      if (command.action === "cancel") { pending = null; return "Agent Health preview cancelled. No inference or BUZZ post was submitted."; }
      const profile = await services.profile();
      if (!profile) return err("Unlock the current Human profile before Agent Health.");
      if (command.action === "report") return last?.profile === profile ? last.text : "NO REPORT: No live Agent Health test in the current unlocked session.";
      const snapshot = await read();
      const { census, mastra, buzz, route } = snapshot;
      if (command.action === "inventory" || command.action === "status") return summarize(census, buzz, mastra);
      const selected = route.text?.selected || "off";
      if (command.action === "test") {
        pending = null;
        if (!command.localOnly && (selected === "off" || selected === "disabled")) return err("Select and verify a writing provider first.");
        const provider = command.localOnly ? "local" : selected;
        if (!["local", "ollama", "openai", "gemini", "minimax"].includes(provider)) return err("Selected text route is unsupported.");
        const option = route.text?.options?.[provider];
        if (!option?.ready) return err("The requested writing route is not READY. Use Connections Test first.");
        const targets = census.entries.filter(x => x.testMode === "mastra" && (command.selection !== "one" || x.id === command.agentId || x.roleId === command.agentId));
        if (command.selection === "one" && !census.entries.some(x => x.id === command.agentId || x.roleId === command.agentId)) return err("Unknown agent ID. Use agents inventory.");
        if (command.selection === "one" && targets.length === 0) return err("This agent has no approved live I/O adapter; listed as BLOCKED in inventory.");
        if (targets.length > MAX_REQUESTS) return err("More than " + MAX_REQUESTS + " callable roles; do not silently truncate the health scan.");
        const token = services.token();
        if (!/^[a-f0-9]{16}$/u.test(token)) throw Error("Invalid preview token generator.");
        pending = { profile, expires: services.now() + 120_000, token, provider, routeIdentity: JSON.stringify({ selected: route.text?.selected, option }), command, targets: targets.map(x => x.id) };
        const cloud = CLOUD.has(provider);
        return "AGENT HEALTH LIVE TEST PREVIEW — " + targets.length + " Mastra roles; " + census.entries.length + " source entries accounted for."
          + "\nProvider=" + provider + "; model=" + (option.model || "unknown")
          + "; up to " + targets.length + " inference requests, one per role, no retries, one-at-a-time, at most 120 seconds total."
          + "\n" + (cloud ? "PAID CLOUD REQUESTS: exact usage/charge quote unavailable; actual provider charges may apply. Synthetic fiction is sent externally." : "Local execution requested; no automatic cloud fallback. Local model/GPU work may occur.")
          + "\nBUZZ-managed agents, external peers and production sidecars remain BLOCKED without their own signed/job proof; NO BUZZ POST, PPF mutation or GitHub write."
          + "\nWITHIN TWO MINUTES SEND:\nPlotPickle agents confirm " + token + (cloud ? " CHARGES SHARE" : "")
          + "\n" + HELP;
      }
      if (command.action !== "confirm") return err("Unrecognized Agent Health action.");
      const grant = pending;
      pending = null; // consumed before even one request: no duplicate retries.
      if (!grant || grant.token !== command.token || grant.profile !== profile || services.now() > grant.expires) return err("The Agent Health preview expired or the Human profile changed. No inference started.");
      if (CLOUD.has(grant.provider) && (!command.charges || !command.share)) return err("Paid cloud charges and external sharing both require explicit confirmation; preview again.");
      if (JSON.stringify({ selected: route.text?.selected, option: route.text?.options?.[grant.provider] }) !== grant.routeIdentity) return err("Provider, model, readiness or selection changed. No inference started.");
      const start = services.now();
      const targetIds = new Set(grant.targets);
      const results = [];
      for (const item of census.entries) {
        if (item.testMode !== "mastra") results.push(blockedRow(item, "No reviewed safe, side-effect-free I/O adapter for this " + item.owner + " role."));
        else if (!targetIds.has(item.id)) results.push(notSelected(item));
        else results.push(null);
      }
      const outstanding = census.entries.map((item, i) => ({ item, i })).filter(({ i }) => results[i] === null);
      let dispatchedCount = 0;
      for (const { item, i } of outstanding) {
        if (services.now() - start >= MAX_ELAPSED_MS) { results[i] = { id: item.id, result: "SKIPPED", stage: "time-bound", reason: "Total 120-second execution limit reached." }; continue; }
        if (await services.profile() !== profile) { results[i] = { id: item.id, result: "UNKNOWN", stage: "profile-changed", reason: "Human scope changed; no more requests authorized." }; break; }
        const ms = Math.min(PER_REQUEST_MS, MAX_ELAPSED_MS - (services.now() - start));
        const sentAt = services.now();
        const role = item.roleId;
        dispatchedCount++;
        try {
          const output = await services.request("/api/writing-assistant/chat", {
            agentId: role, provider: grant.provider, tone: "direct", message: syntheticPrompt(role),
            ...(role === "foundations-planner" ? { foundationFieldIds: ["output-1"] } : {}),
            conversationMode: false,
          }, ms);
          const candidate = output?.text;
          results[i] = schemaValid(role, candidate)
            ? { id: item.id, result: "PASS", stage: ["story-architect", "discovery-mapper", "foundations-planner", "wyrmwood-rival-director", "wyrmwood-curriculum-evaluator"].includes(role) ? "structured-output" : "advisory-output", reason: "Actual nonempty role-conforming synthetic output observed; no canon effects claimed.",
              provider: output.provider || grant.provider, model: output.model || "", latencyMs: services.now() - sentAt, dispatch: "response" }
            : { id: item.id, result: "FAIL", stage: "output-validation", reason: "Response missing, unstructured for this role or did not meet synthetic fixture contract.",
              provider: output?.provider || grant.provider, model: output?.model || "", latencyMs: services.now() - sentAt, dispatch: "response" };
        } catch {
          results[i] = { id: item.id, result: "UNKNOWN", stage: "dispatch-or-timeout", reason: "Endpoint failed or timed out; provider dispatch/charge uncertain. Inspect protected provider diagnostics, do not automatically retry.", provider: grant.provider, latencyMs: services.now() - sentAt, dispatch: "unknown" };
        }
        if (services.progress) services.progress(resultRow(results[i]));
      }
      for (let i = 0; i < results.length; i++) if (!results[i]) results[i] = { id: census.entries[i].id, result: "SKIPPED", stage: "profile-changed", reason: "Stopped after Human profile change; no request." };
      const title = "AGENT HEALTH LIVE RESULTS — " + dispatchedCount + " attempted model requests; no automatic retry.";
      const text = report(census, results, grant.provider, title);
      last = { profile, text };
      return text;
    } catch { return err("Agent Health could not complete securely. Provider dispatch is unknown if confirmation was already used; do not automatically retry."); }
    finally { working = false; }
  } };
}
