import { evaluateCaseRun, validateCaseDefinition } from "./casebook-contract.mjs";
import { resultText, toolArguments } from "./creative-uat/mcp-runtime.mjs";

export const CASEBOOK_EVIDENCE_SCHEMA_VERSION = 1;
export const CASEBOOK_INTERACTION_KINDS = Object.freeze([
  "navigate",
  "pointer",
  "type",
  "keyboard",
  "scroll",
  "focus",
  "select",
  "observe",
  "runtime",
]);

const hiddenKeys = new Set(["reasoning", "chainofthought", "chain_of_thought", "scratchpad", "prompt", "messages"]);
const secretKeyPattern = /(password|passphrase|secret|token|cookie|authorization|api[_-]?key|private[_-]?key|nsec)/i;

function scrubEvidenceText(value) {
  return String(value ?? "")
    .replace(/\bnsec1[a-z0-9]{8,}\b/gi, "[REDACTED_NOSTR_PRIVATE_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_PROVIDER_KEY]")
    .replace(/\b(api[_-]?key|password|passphrase|secret|token|cookie|private[_-]?key)\b\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "[local-user]")
    .replace(/\/home\/[^/\s]+/g, "/home/[user]")
    .replace(/\/Users\/[^/\s]+/g, "/Users/[user]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function redactCaseEvidence(input) {
  const serialized = JSON.stringify(input ?? null, (key, value) => {
    const normalized = String(key || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (hiddenKeys.has(normalized)) return undefined;
    if (secretKeyPattern.test(String(key || ""))) return "[REDACTED]";
    return typeof value === "string" ? scrubEvidenceText(value) : value;
  });
  return JSON.parse(serialized);
}

function safeId(value, fallback) {
  const id = String(value || "").trim().replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
  return id || fallback;
}

function caseStep(caseDefinition, stepId) {
  return caseDefinition.humanJourney.find((item) => item.id === stepId) || null;
}

function artifactRef(input = {}) {
  return redactCaseEvidence({
    id: safeId(input.id, "artifact"),
    kind: String(input.kind || "note"),
    status: ["verified", "contradicted", "unverified"].includes(input.status) ? input.status : "unverified",
    source: String(input.source || "casebook-observer"),
    independent: input.independent === true,
    ref: String(input.ref || ""),
    summary: String(input.summary || ""),
    phase: ["before", "after", "state"].includes(input.phase) ? input.phase : "state",
    capturedAt: String(input.capturedAt || new Date().toISOString()),
    metadata: input.metadata || {},
  });
}

export function createCaseEvidenceManifest(caseDefinition, input = {}) {
  const validation = validateCaseDefinition(caseDefinition);
  if (!validation.valid) throw new Error(`Cannot create evidence for invalid Case: ${validation.errors.join(" ")}`);
  return {
    schemaVersion: CASEBOOK_EVIDENCE_SCHEMA_VERSION,
    caseId: caseDefinition.id,
    domain: caseDefinition.domain,
    priority: caseDefinition.priority,
    runId: safeId(input.runId, `${caseDefinition.id}:${Date.now()}`),
    expectedOutcome: caseDefinition.expectedOutcome,
    startedAt: String(input.startedAt || new Date().toISOString()),
    completedAt: "",
    timeline: [],
    artifacts: [],
    blockers: [],
    realIntegrationVerified: false,
    criticalInteractionsUnreached: 0,
    faultResults: [],
  };
}

export function appendCaseEvidenceArtifact(manifest, input = {}) {
  if (!manifest || !Array.isArray(manifest.artifacts)) throw new Error("Casebook evidence manifest is invalid.");
  manifest.artifacts.push(artifactRef(input));
  return manifest;
}

export function appendCaseEvidenceStep(manifest, caseDefinition, input = {}) {
  if (!manifest || !Array.isArray(manifest.timeline)) throw new Error("Casebook evidence manifest is invalid.");
  const definition = caseStep(caseDefinition, input.stepId);
  if (!definition) throw new Error(`Unknown Casebook journey step: ${input.stepId || "missing"}.`);
  const interaction = CASEBOOK_INTERACTION_KINDS.includes(input.interaction) ? input.interaction : "observe";
  const outcome = ["pass", "fail", "blocked", "uncertain"].includes(input.outcome) ? input.outcome : "uncertain";
  const workerClaim = ["pass", "fail", "blocked", "uncertain"].includes(input.workerClaim) ? input.workerClaim : "uncertain";
  const entry = redactCaseEvidence({
    sequence: manifest.timeline.length + 1,
    stepId: definition.id,
    action: definition.action,
    interaction,
    target: input.target || "",
    expected: input.expected || definition.action,
    observed: input.observed || "",
    workerClaim,
    outcome,
    critical: input.critical !== false,
    beforeScreenshot: input.beforeScreenshot || "",
    afterScreenshot: input.afterScreenshot || "",
    evidenceIds: Array.isArray(input.evidenceIds) ? input.evidenceIds : [],
    startedAt: input.startedAt || new Date().toISOString(),
    completedAt: input.completedAt || new Date().toISOString(),
  });
  manifest.timeline.push(entry);
  return manifest;
}

export function validateCaseEvidenceManifest(caseDefinition, manifest) {
  const errors = [];
  if (Number(manifest?.schemaVersion) !== CASEBOOK_EVIDENCE_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${CASEBOOK_EVIDENCE_SCHEMA_VERSION}.`);
  if (manifest?.caseId !== caseDefinition.id) errors.push("caseId does not match the Business Case.");
  if (!String(manifest?.runId || "").trim()) errors.push("runId is required.");
  if (!Array.isArray(manifest?.timeline)) errors.push("timeline must be an array.");
  if (!Array.isArray(manifest?.artifacts)) errors.push("artifacts must be an array.");
  const seen = new Set();
  for (const entry of manifest?.timeline || []) {
    if (!caseStep(caseDefinition, entry.stepId)) errors.push(`Unknown timeline step: ${entry.stepId || "missing"}.`);
    if (seen.has(entry.stepId)) errors.push(`Duplicate timeline step: ${entry.stepId}.`);
    seen.add(entry.stepId);
    if (!String(entry.expected || "").trim()) errors.push(`${entry.stepId}: expected result is required.`);
    if (!String(entry.observed || "").trim()) errors.push(`${entry.stepId}: observed result is required.`);
    if (entry.critical && (!entry.beforeScreenshot || !entry.afterScreenshot)) errors.push(`${entry.stepId}: critical transition requires before and after screenshots.`);
  }
  const serialized = JSON.stringify(manifest || {});
  if (/\bnsec1[a-z0-9]{8,}\b/i.test(serialized) || /\bsk-[A-Za-z0-9_-]{8,}\b/.test(serialized)) errors.push("Evidence contains an unredacted secret.");
  if (/"(?:reasoning|chainOfThought|chain_of_thought|scratchpad|prompt|messages)"\s*:/i.test(serialized)) errors.push("Evidence contains hidden reasoning/prompt material.");
  return { valid: errors.length === 0, errors };
}

export function caseRunFromEvidenceManifest(caseDefinition, manifest) {
  const validation = validateCaseEvidenceManifest(caseDefinition, manifest);
  if (!validation.valid) throw new Error(`Invalid Casebook evidence manifest:\n${validation.errors.map((item) => `- ${item}`).join("\n")}`);
  const contradiction = manifest.timeline.some((entry) => entry.outcome === "fail" || (entry.workerClaim === "pass" && entry.outcome !== "pass"));
  return {
    runId: manifest.runId,
    steps: manifest.timeline.map((entry) => ({ id: entry.stepId, status: entry.outcome })),
    evidence: manifest.artifacts.map((item) => ({
      id: item.id,
      kind: item.kind,
      status: item.status,
      source: item.source,
      independent: item.independent,
      ref: item.ref,
      summary: item.summary,
    })),
    blockers: manifest.blockers || [],
    outcomeContradicted: contradiction,
    realIntegrationVerified: manifest.realIntegrationVerified === true,
    criticalInteractionsUnreached: Number(manifest.criticalInteractionsUnreached || 0),
    faultResults: manifest.faultResults || [],
  };
}

export function evaluateCaseEvidenceManifest(caseDefinition, manifest) {
  const result = evaluateCaseRun(caseDefinition, caseRunFromEvidenceManifest(caseDefinition, manifest));
  return {
    ...result,
    evidenceSchemaVersion: CASEBOOK_EVIDENCE_SCHEMA_VERSION,
    timelineSteps: manifest.timeline.length,
    contradictoryWorkerClaims: manifest.timeline.filter((entry) => entry.workerClaim === "pass" && entry.outcome !== "pass").length,
  };
}

export function completeCaseEvidenceManifest(manifest, input = {}) {
  manifest.completedAt = String(input.completedAt || new Date().toISOString());
  manifest.realIntegrationVerified = input.realIntegrationVerified === true;
  manifest.criticalInteractionsUnreached = Math.max(0, Number(input.criticalInteractionsUnreached || 0));
  manifest.blockers = redactCaseEvidence(Array.isArray(input.blockers) ? input.blockers : []);
  manifest.faultResults = redactCaseEvidence(Array.isArray(input.faultResults) ? input.faultResults : []);
  return manifest;
}

export function createCasebookHumanInteractionAdapter({ client, tools, creativeBrowser }) {
  if (!client || !Array.isArray(tools) || !creativeBrowser) throw new Error("Casebook Human interaction adapter requires the existing MCP client, tools and Creative Browser.");
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  if (!toolMap.has("browser_evaluate")) throw new Error("Casebook Human interaction adapter requires browser_evaluate.");

  const evaluate = async (fn) => resultText(await client.call("browser_evaluate", { function: fn }));
  const pointerClick = async (label) => creativeBrowser.clickVisible(label);
  const typeByLabel = async (label, value) => creativeBrowser.fillByLabel(label, value);
  const navigate = async (url) => creativeBrowser.navigate(url);
  const screenshot = async (name) => creativeBrowser.screenshot(name);

  async function pressKey(key) {
    const tool = toolMap.get("browser_press_key");
    if (!tool) return { ok: false, reason: "browser_press_key unavailable" };
    await client.call("browser_press_key", toolArguments(tool, { key: String(key) }));
    return { ok: true, key: String(key) };
  }

  async function scrollBy(pixels) {
    const amount = Number.isFinite(Number(pixels)) ? Number(pixels) : 0;
    const text = await evaluate(`() => { window.scrollBy(0, ${JSON.stringify(amount)}); return JSON.stringify({ x: window.scrollX, y: window.scrollY }); }`);
    return { ok: true, state: text };
  }

  async function focusByLabel(label) {
    const wanted = JSON.stringify(String(label));
    const text = await evaluate(`() => {
      const wanted = ${wanted}.trim().toLowerCase();
      const nodes = [...document.querySelectorAll('button,a,input,textarea,select,[tabindex]')];
      const target = nodes.find((node) => {
        const name = (node.getAttribute('aria-label') || node.textContent || node.getAttribute('name') || '').trim().toLowerCase();
        return name === wanted;
      });
      if (!target || typeof target.focus !== 'function') return JSON.stringify({ ok: false });
      target.focus();
      return JSON.stringify({ ok: document.activeElement === target });
    }`);
    return { ok: /"ok"\s*:\s*true/.test(text), state: text };
  }

  return { pointerClick, typeByLabel, navigate, screenshot, pressKey, scrollBy, focusByLabel };
}

export function createCasebookBrowserEvidenceRecorder({ caseDefinition, browser, runId, startedAt }) {
  if (!browser || typeof browser.screenshot !== "function") throw new Error("Casebook browser evidence recorder requires the existing browser screenshot capability.");
  const manifest = createCaseEvidenceManifest(caseDefinition, { runId, startedAt });

  async function recordStep(input = {}) {
    const definition = caseStep(caseDefinition, input.stepId);
    if (!definition) throw new Error(`Unknown Casebook journey step: ${input.stepId || "missing"}.`);
    const critical = input.critical !== false;
    const prefix = `${String(manifest.timeline.length + 1).padStart(2, "0")}-${safeId(input.stepId, "step")}`;
    let beforeScreenshot = "";
    let afterScreenshot = "";
    if (critical) {
      beforeScreenshot = `${prefix}-before.png`;
      await browser.screenshot(beforeScreenshot.replace(/\.png$/, ""));
    }
    let actionError = null;
    try {
      if (typeof input.act === "function") await input.act(browser);
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    }
    let observed = actionError ? `Action error: ${actionError}` : "Action completed; no observer supplied.";
    let outcome = actionError ? "fail" : "uncertain";
    if (typeof input.observe === "function") {
      const observation = await input.observe(browser, actionError);
      if (typeof observation === "string") observed = observation;
      else if (observation && typeof observation === "object") {
        observed = String(observation.observed || observed);
        outcome = ["pass", "fail", "blocked", "uncertain"].includes(observation.outcome) ? observation.outcome : outcome;
      }
    }
    if (critical) {
      afterScreenshot = `${prefix}-after.png`;
      await browser.screenshot(afterScreenshot.replace(/\.png$/, ""));
    }
    appendCaseEvidenceStep(manifest, caseDefinition, {
      stepId: input.stepId,
      interaction: input.interaction,
      target: input.target,
      expected: input.expected || definition.action,
      observed,
      workerClaim: input.workerClaim || (actionError ? "fail" : "pass"),
      outcome,
      critical,
      beforeScreenshot,
      afterScreenshot,
      evidenceIds: input.evidenceIds,
    });
    return manifest.timeline.at(-1);
  }

  return { manifest, recordStep };
}
