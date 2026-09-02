const categories = [
  "required-before-core-readiness",
  "required-deferrable-after-readiness",
  "workflow-triggered",
  "optional-integration",
  "developer-diagnostic-only",
];

const definitions = [
  {
    id: "existing-session-and-port-probe",
    label: "Existing PlotPickle session and port probe",
    category: "required-before-core-readiness",
    evidenceRefs: ["Start-PlotPickle.bat::probe_existing"],
    rationale: "The launcher must fail closed on a conflicting or unverified local server before opening a new core runtime.",
  },
  {
    id: "persistent-runtime-preparation",
    label: "Persistent runtime preparation",
    category: "required-before-core-readiness",
    evidenceRefs: ["measurements.startup.runtimePreparationStartedMs", "measurements.startup.runtimeReadyMs"],
    rationale: "The exact reusable runtime and platform identity must be available before the core server starts.",
  },
  {
    id: "dependency-and-native-binding-verification",
    label: "Dependency and native-binding verification",
    category: "required-before-core-readiness",
    evidenceRefs: ["Start-PlotPickle.bat::ensure_dependencies", "scripts/windows-runtime.mjs::verify-runtime"],
    rationale: "Required packages and the platform-native binding are correctness gates, not performance shortcuts.",
  },
  {
    id: "agent-skills-verification",
    label: "Agent Skills verification",
    category: "required-before-core-readiness",
    evidenceRefs: ["measurements.startup.agentSkillsCheckStartedMs", "measurements.startup.agentSkillsReadyMs"],
    rationale: "The launcher refuses to expose an agent-capable core runtime when registered procedures are incomplete or invalid.",
  },
  {
    id: "vite-and-core-http-readiness",
    label: "Vite and core HTTP readiness",
    category: "required-before-core-readiness",
    evidenceRefs: ["measurements.startup.viteReadyMs", "measurements.startup.firstValidHttpResponseMs", "measurements.startup.firstUsableCoreWorkspaceMs"],
    rationale: "A valid PlotPickle response and usable core workspace define the measured readiness boundary.",
  },
  {
    id: "source-update-check",
    label: "PlotPickle source update check",
    category: "required-deferrable-after-readiness",
    evidenceRefs: ["measurements.startup.sourceCheckStartedMs", "Start-PlotPickle.bat::windows-source-sync"],
    rationale: "Update awareness is required product maintenance, but a failed network check already permits safe use of the local source and is therefore a deferral candidate for later Human review.",
  },
  {
    id: "managed-browser-opening",
    label: "Managed PlotPickle app-window opening",
    category: "required-deferrable-after-readiness",
    evidenceRefs: ["measurements.startup.firstBrowserUsefulWorkspaceMs", "Start-PlotPickle.bat::open_when_ready"],
    rationale: "The app window is required for the normal desktop experience but is deliberately opened only after the server readiness contract succeeds.",
  },
  {
    id: "story-work-item-planning",
    label: "Story Work Item planning",
    category: "workflow-triggered",
    evidenceRefs: ["workflow.fullAudit.workItemCount", "workflow.fullAudit.elapsedMs"],
    rationale: "Planning is eligible only after a story workflow is requested; it must not run merely to prove the app is alive.",
  },
  {
    id: "story-council-specialists",
    label: "Bounded Story Council specialists",
    category: "workflow-triggered",
    evidenceRefs: ["workflow.fullAudit.specialistCount", "workflow.fullAudit.specialistIds"],
    rationale: "Specialists are bounded story-work workers and have no core-readiness role.",
  },
  {
    id: "targeted-story-reevaluation",
    label: "Targeted story re-evaluation",
    category: "workflow-triggered",
    evidenceRefs: ["workflow.targetedReevaluation", "workflow.comparison"],
    rationale: "Re-evaluation is caused by an accepted bounded story change and must preserve unrelated completed work.",
  },
  {
    id: "optional-companion-maintenance",
    label: "Ollama, ComfyUI, BUZZ and companion maintenance",
    category: "optional-integration",
    evidenceRefs: ["measurements.startup.optionalCompanionMaintenanceSuppressed", "environment.optionalIntegrations", "environment.buzzMode"],
    rationale: "Optional providers and collaboration transports cannot block core readiness and remain independently configurable.",
  },
  {
    id: "performance-observers",
    label: "Browser, process and benchmark observers",
    category: "developer-diagnostic-only",
    evidenceRefs: ["measurements.browser", "measurements.processIdle", "benchmarkIssue"],
    rationale: "The observers exist only to produce #1411 evidence and are not part of the PlotPickle product runtime.",
  },
  {
    id: "manual-developer-agents-and-uat",
    label: "Manual Full Story Builder, UI Continuity and Creative Writer UAT launchers",
    category: "developer-diagnostic-only",
    evidenceRefs: ["Start-PlotPickle.bat::manual developer tools"],
    rationale: "These retained diagnostics are explicitly excluded from normal startup.",
  },
];

function workflowCaptured(workflow) {
  return workflow?.status === "captured-deterministic-contract";
}

function activeForEvidence(definition, evidence) {
  if (definition.category === "workflow-triggered") return workflowCaptured(evidence.workflow);
  if (definition.id === "managed-browser-opening") return evidence.measurements?.startup?.browserSuppressed !== true;
  if (definition.id === "optional-companion-maintenance") {
    return evidence.measurements?.startup?.optionalCompanionMaintenanceSuppressed !== true
      && (evidence.environment?.optionalIntegrations?.length > 0 || evidence.environment?.buzzMode === "enabled");
  }
  if (definition.id === "performance-observers") return true;
  if (definition.id === "manual-developer-agents-and-uat") return false;
  return true;
}

export function validateWorkClassification(items = definitions) {
  const errors = [];
  const ids = new Set();
  for (const item of items) {
    if (!item?.id || ids.has(item.id)) errors.push(`Work classification id is missing or duplicated: ${item?.id || "<missing>"}.`);
    ids.add(item?.id);
    if (!categories.includes(item?.category)) errors.push(`${item?.id || "<missing>"} has unsupported category ${item?.category || "<missing>"}.`);
    if (!item?.label || !item?.rationale) errors.push(`${item?.id || "<missing>"} is missing its label or rationale.`);
    if (!Array.isArray(item?.evidenceRefs) || item.evidenceRefs.length === 0) errors.push(`${item?.id || "<missing>"} has no evidence references.`);
  }
  for (const category of categories) {
    if (!items.some((item) => item.category === category)) errors.push(`No work is classified as ${category}.`);
  }
  return errors;
}

export function classifyMeasuredWork(evidence = {}) {
  const errors = validateWorkClassification();
  if (errors.length) throw new Error(errors.join("\n"));
  const items = definitions.map((item) => ({ ...item, activeInSample: activeForEvidence(item, evidence) }));
  const counts = Object.fromEntries(categories.map((category) => [category, items.filter((item) => item.category === category).length]));
  return {
    schemaVersion: 1,
    authority: "classification-evidence-only",
    changesRuntimeBehavior: false,
    categories,
    counts,
    items,
    validation: {
      complete: true,
      unclassifiedObservedWork: [],
      note: "Classification identifies optimization candidates; it does not authorize deferral, deletion, provider activation or weaker correctness checks.",
    },
  };
}

export const measuredWorkDefinitions = definitions;
