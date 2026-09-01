import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA = /^[a-f0-9]{40}$/i;
const FINGERPRINT = /^qa-defect-[a-f0-9]{32}$/;
const SAFE_REF = /^[a-z0-9][a-z0-9._:/-]{1,239}$/i;
const MAX_REFS = 64;
const MAX_OBSERVATIONS = 8;
const MAX_ISSUE_PAGES = 10;
const SEVERITIES = new Set(["blocker", "critical", "major", "minor"]);

function safeToken(value, label, allowEmpty = false) {
  const normalized = String(value || "").trim();
  if (allowEmpty && normalized === "") return "";
  if (!SAFE_REF.test(normalized)) throw new Error(`Autonomous QA defect publication ${label} is missing or invalid.`);
  return normalized;
}

function safeRefs(values, label) {
  if (!Array.isArray(values)) throw new Error(`Autonomous QA defect publication ${label} must be an array.`);
  const result = [...new Set(values.map((value) => safeToken(value, label)))];
  if (result.length > MAX_REFS) throw new Error(`Autonomous QA defect publication ${label} exceeds its bounded size.`);
  return result;
}

function validateCandidate(value) {
  if (!value || typeof value !== "object") throw new Error("Autonomous QA defect publication requires a candidate.");
  if (!FINGERPRINT.test(String(value.fingerprint || ""))) throw new Error("Autonomous QA defect publication requires a deterministic fingerprint.");
  if (value.reproducible !== true || value.severity === "flaky") {
    return Object.freeze({ disposition: "record-flaky", fingerprint: String(value.fingerprint || "") });
  }
  if (!Array.isArray(value.observations) || value.observations.length < 2 || value.observations.length > MAX_OBSERVATIONS) {
    throw new Error("Autonomous QA defect publication requires two to eight matching observations.");
  }
  const observations = value.observations.map((observation) => {
    if (!SHA.test(String(observation.commitSha || ""))) throw new Error("Autonomous QA defect publication requires an exact failing commit SHA.");
    return Object.freeze({
      commitSha: String(observation.commitSha).toLowerCase(),
      buildId: safeToken(observation.buildId, "build ID"),
    });
  });
  if (new Set(observations.map((item) => `${item.commitSha}:${item.buildId}`)).size !== 1) {
    throw new Error("Autonomous QA defect publication observations must reproduce on the same exact build.");
  }
  const severity = safeToken(value.severity, "severity");
  if (!SEVERITIES.has(severity)) throw new Error("Autonomous QA defect publication severity is invalid.");
  return Object.freeze({
    fingerprint: value.fingerprint,
    severity,
    testerRole: safeToken(value.testerRole, "tester role"),
    routeId: safeToken(value.routeId, "route ID", true),
    assertionRef: safeToken(value.assertionRef, "assertion reference"),
    expectedRef: safeToken(value.expectedRef, "expected-result reference"),
    actualRef: safeToken(value.actualRef, "actual-result reference"),
    errorClass: safeToken(value.errorClass, "error class", true),
    observations: Object.freeze(observations),
    reproductionRefs: Object.freeze(safeRefs(value.reproductionRefs, "reproduction reference")),
    evidenceRefs: Object.freeze(safeRefs(value.evidenceRefs, "evidence reference")),
    reproducible: true,
  });
}

function repositoryName(value) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)) {
    throw new Error("Autonomous QA defect publication requires an owner/repository identity.");
  }
  return normalized;
}

function marker(fingerprint) {
  return `<!-- plotpickle-autonomous-qa:${fingerprint} -->`;
}

function evidenceBody(candidate, heading) {
  const build = candidate.observations[0];
  const lines = [
    marker(candidate.fingerprint),
    heading,
    "",
    `- Fingerprint: \`${candidate.fingerprint}\``,
    `- Severity: \`${candidate.severity}\``,
    `- Tester role: \`${candidate.testerRole}\``,
    `- Route: \`${candidate.routeId || "route-independent"}\``,
    `- Exact failing commit: \`${build.commitSha}\``,
    `- Build: \`${build.buildId}\``,
    `- Assertion: \`${candidate.assertionRef}\``,
    `- Expected ref: \`${candidate.expectedRef}\``,
    `- Actual ref: \`${candidate.actualRef}\``,
  ];
  if (candidate.errorClass) lines.push(`- Error class: \`${candidate.errorClass}\``);
  lines.push("", "Reproduction evidence:", ...candidate.reproductionRefs.map((ref) => `- \`${ref}\``));
  lines.push("", "Machine evidence:", ...candidate.evidenceRefs.map((ref) => `- \`${ref}\``));
  lines.push("", "This report was reproduced at least twice. Deterministic tests, build, and exact-head CI remain authoritative.");
  return lines.join("\n");
}

async function githubRequest(fetchImpl, token, url, init = {}) {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub defect publication failed with HTTP ${response.status}.`);
  return response.status === 204 ? {} : response.json();
}

async function listOpenIssues(fetchImpl, token, apiRoot) {
  const issues = [];
  for (let page = 1; page <= MAX_ISSUE_PAGES; page += 1) {
    const batch = await githubRequest(fetchImpl, token, `${apiRoot}/issues?state=open&per_page=100&sort=updated&direction=desc&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("GitHub defect publication received an invalid Issue list.");
    issues.push(...batch);
    if (batch.length < 100) return issues;
  }
  throw new Error("GitHub defect publication exceeded its bounded open-Issue search.");
}

export async function publishAutonomousQaDefect({ candidate: rawCandidate, repository, token, fetchImpl = fetch }) {
  const candidate = validateCandidate(rawCandidate);
  if (candidate.disposition === "record-flaky") return candidate;
  const repo = repositoryName(repository);
  if (!String(token || "").trim()) throw new Error("Autonomous QA defect publication requires a GitHub token.");
  const apiRoot = `https://api.github.com/repos/${repo}`;
  const issues = await listOpenIssues(fetchImpl, token, apiRoot);
  const fingerprintMarker = marker(candidate.fingerprint);
  const existing = issues.find((issue) => !issue.pull_request && String(issue.body || "").includes(fingerprintMarker));
  if (existing) {
    const result = await githubRequest(fetchImpl, token, `${apiRoot}/issues/${existing.number}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: evidenceBody(candidate, "Additional autonomous QA reproduction") }),
    });
    return Object.freeze({
      disposition: "append-existing",
      fingerprint: candidate.fingerprint,
      linkedIssue: String(existing.html_url || ""),
      commentUrl: String(result.html_url || ""),
    });
  }
  const titleSurface = candidate.routeId || candidate.assertionRef;
  const result = await githubRequest(fetchImpl, token, `${apiRoot}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `[Autonomous QA][${candidate.severity}] ${titleSurface}`,
      body: evidenceBody(candidate, "Reproducible autonomous QA defect"),
    }),
  });
  return Object.freeze({
    disposition: "create-new",
    fingerprint: candidate.fingerprint,
    linkedIssue: String(result.html_url || ""),
    commentUrl: "",
  });
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Usage: node scripts/autonomous-qa/publish-defect.mjs <candidate.json>");
  const candidate = JSON.parse(await readFile(inputPath, "utf8"));
  const result = await publishAutonomousQaDefect({
    candidate,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
