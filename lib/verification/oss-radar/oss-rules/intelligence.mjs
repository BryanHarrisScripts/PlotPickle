const ORIGIN = "https://ossrules.md";
const MAX_RESPONSE = 128_000;
const RESEARCH_BUDGET_MS = 20_000;
const MAX_OBSERVATIONS = 3;
const PATTERN_PRIORITY = ["verification-matrix", "single-source", "skill-routing", "context-budget", "generated-file-guard", "scope-layering", "router-files"];
const ACTION = { "verification-matrix": "ADAPT", "single-source": "NO ACTION", "skill-routing": "LEARN", "context-budget": "WATCH" };
const FALLBACK_PATTERNS = [
  {
    patternId: "verification-matrix",
    area: "Validation & Operations",
    disposition: "ADAPT",
    plotPickleFit: "Compare this pattern with PlotPickle's change-class verification routing and keep validation proportional to the files and behavior changed.",
  },
  {
    patternId: "skill-routing",
    area: "Agent & Skill Mesh",
    disposition: "LEARN",
    plotPickleFit: "Compare this router-file pattern with PlotPickle's AGENTS.md and skill registry so agents load focused guidance only when the task requires it.",
  },
  {
    patternId: "single-source",
    area: "Experience Contract",
    disposition: "NO ACTION",
    plotPickleFit: "PlotPickle already points many changing rules at canonical config and ownership files; use this pattern as a drift check rather than copying values into instructions.",
  },
];

async function get(url, fetchImpl, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("OSS Rules research time budget exhausted.");
  const response = await fetchImpl(url, { method: "GET", signal: AbortSignal.timeout(Math.min(4000, remaining)), headers: { Accept: "application/json, text/plain" } });
  if (!response?.ok) throw new Error(`OSS Rules returned HTTP ${response?.status || "unknown"}`);
  const body = await response.text();
  if (body.length > MAX_RESPONSE) throw new Error("OSS Rules response exceeded the research boundary.");
  return body;
}

function sourceFromProject(project) {
  const sha = project?.instructions?.sha;
  const path = project?.instructions?.primaryPath || "AGENTS.md";
  if (!/^[0-9a-f]{40}$/iu.test(sha || "") || !/^[a-z0-9_.\-/]+$/iu.test(path) || path.includes("..")) return null;
  return `https://github.com/${project.repository}/blob/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function safeProjectUrl(value, repository) {
  const url = new URL(String(value || ""), ORIGIN);
  if (url.origin !== ORIGIN || url.pathname !== `/api/v1/projects/${repository}`) throw new Error("OSS Rules project link did not match the selected repository.");
  return url.href;
}

function pinnedExampleUrl(value, repository, sha) {
  if (typeof value !== "string" || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.origin === "https://github.com" && url.pathname.startsWith(`/${repository}/blob/${sha}/`) ? url.href : null;
}

function patternPageUrl(patternId) {
  return `${ORIGIN}/agent-rules/${encodeURIComponent(patternId)}`;
}

function chosenPattern(patterns) {
  const available = new Set(patterns || []);
  return PATTERN_PRIORITY.find((id) => available.has(id)) || null;
}

function plainText(value, limit) {
  return String(value || "").replace(/[\r\n\t]+/gu, " ").replace(/[<>`*\[\]]/gu, "").slice(0, limit);
}

async function fillPatternObservations(evidence, fetchImpl, deadline) {
  const seenPatterns = new Set(evidence.findings.map((item) => item.patternId));
  for (const fallback of FALLBACK_PATTERNS) {
    if (evidence.findings.length >= MAX_OBSERVATIONS) break;
    if (seenPatterns.has(fallback.patternId)) continue;
    try {
      const pattern = JSON.parse(await get(`${ORIGIN}/api/v1/patterns/${fallback.patternId}`, fetchImpl, deadline));
      evidence.findings.push({
        repository: "OSS Rules pattern library",
        area: fallback.area,
        patternId: fallback.patternId,
        pattern: plainText(pattern?.name || fallback.patternId, 100),
        meaning: plainText(pattern?.summary || "Review this OSS Rules instruction pattern.", 240),
        plotPickleFit: fallback.plotPickleFit,
        disposition: fallback.disposition,
        sourceUrl: patternPageUrl(fallback.patternId),
        ossRulesUrl: patternPageUrl(fallback.patternId),
        sourceSha: null,
        sourceKind: "pattern-library",
      });
      seenPatterns.add(fallback.patternId);
    } catch {
      // Pattern-library fallback is optional. Exact-match research remains usable.
    }
  }
}

export async function researchOssRules({ candidates = [], fetchImpl = globalThis.fetch } = {}) {
  const deadline = Date.now() + RESEARCH_BUDGET_MS;
  const checked = candidates.slice(0, 21).filter((candidate) => /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu.test(candidate.fullName || ""));
  const evidence = { schemaVersion: 1, source: ORIGIN, status: "available", repositoriesChecked: checked.length, findings: [], checks: [] };
  try {
    await get(`${ORIGIN}/llms.txt`, fetchImpl, deadline);
    const catalog = JSON.parse(await get(`${ORIGIN}/api/v1/catalog`, fetchImpl, deadline));
    if (catalog?.version !== 1 || !catalog?.links?.projects) throw new Error("OSS Rules overview is unsupported.");
  } catch (error) {
    return { ...evidence, status: "unavailable", reason: String(error?.message || error).slice(0, 160), repositoriesChecked: 0 };
  }

  for (const candidate of checked) {
    if (evidence.findings.length >= MAX_OBSERVATIONS) break;
    const repository = candidate.fullName;
    const area = candidate.selectedArchitectureArea?.label || "Unmapped";
    try {
      const filtered = JSON.parse(await get(`${ORIGIN}/api/v1/projects?q=${encodeURIComponent(repository)}&limit=5`, fetchImpl, deadline));
      const summary = filtered?.items?.find((item) => item.repository?.toLowerCase() === repository.toLowerCase());
      if (!summary) { evidence.checks.push({ repository, status: "no-match" }); continue; }
      const patternId = chosenPattern(summary.patterns);
      if (!patternId) { evidence.checks.push({ repository, status: "no-relevant-pattern" }); continue; }
      const project = JSON.parse(await get(safeProjectUrl(summary.apiUrl, repository), fetchImpl, deadline));
      if (project?.repository?.toLowerCase() !== repository.toLowerCase()) throw new Error("OSS Rules project identity changed during lookup.");
      const sourceUrl = sourceFromProject(project);
      if (!sourceUrl) { evidence.checks.push({ repository, status: "unpinned" }); continue; }
      const pattern = JSON.parse(await get(`${ORIGIN}/api/v1/patterns/${patternId}`, fetchImpl, deadline));
      const example = pattern?.examples?.find((item) => item.projectApiUrl === summary.apiUrl && pinnedExampleUrl(item.sourceUrl, repository, project.instructions.sha));
      const finding = {
        repository, area, patternId, pattern: plainText(pattern?.name || patternId, 100),
        meaning: plainText(pattern?.summary || summary.summaryPreview || "Review the documented agent instructions.", 240),
        plotPickleFit: patternId === "single-source" ? "Already uses AGENTS.md and canonical verification ownership." : "Compare with PlotPickle's governed verification and agent instructions.",
        disposition: ACTION[patternId] || "WATCH",
        sourceUrl: example ? pinnedExampleUrl(example.sourceUrl, repository, project.instructions.sha) : sourceUrl,
        ossRulesUrl: patternPageUrl(patternId),
        sourceSha: project.instructions.sha,
        sourceKind: "exact-project",
      };
      evidence.findings.push(finding);
      evidence.checks.push({ repository, status: "matched", patternId, sourceSha: finding.sourceSha });
    } catch (error) {
      evidence.checks.push({ repository, status: "unavailable", reason: String(error?.message || error).slice(0, 120) });
      if (Date.now() >= deadline) {
        for (const remaining of checked.slice(evidence.checks.length)) evidence.checks.push({ repository: remaining.fullName, status: "budget-exhausted" });
        break;
      }
    }
  }

  await fillPatternObservations(evidence, fetchImpl, deadline);
  evidence.findings = evidence.findings.slice(0, MAX_OBSERVATIONS);
  if (evidence.checks.some((item) => ["unavailable", "budget-exhausted"].includes(item.status))) evidence.status = "partial";
  return evidence;
}
