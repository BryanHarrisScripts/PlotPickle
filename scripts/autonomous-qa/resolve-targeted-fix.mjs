import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA = /^[a-f0-9]{40}$/i;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DEFECT_MARKER = /<!--\s*plotpickle-autonomous-qa:(qa-defect-[a-f0-9]{32})\s*-->/i;
const CLOSING_REFERENCE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;
const MAX_REFERENCES = 8;
const TESTER_ADAPTERS = Object.freeze({
  "fresh-install": "windows-installer",
  "beginner-writer": "focused-uat",
  "full-story-journey": "autonomous-story-reference",
  "visual-production": "autonomous-story-reference",
  "persistence-recovery": "autonomous-story-reference",
  "adversarial-boundary": "deterministic-boundary",
});

function exactSha(value, label) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!SHA.test(normalized)) throw new Error(`Autonomous QA targeted fix requires an exact ${label} commit SHA.`);
  return normalized;
}

function repositoryName(value) {
  const normalized = String(value || "").trim();
  if (!REPOSITORY.test(normalized)) throw new Error("Autonomous QA targeted fix requires an owner/repository identity.");
  return normalized;
}

function closingIssueNumbers(body) {
  const values = [];
  for (const match of String(body || "").matchAll(CLOSING_REFERENCE)) {
    const number = Number(match[1]);
    if (Number.isInteger(number) && number > 0 && !values.includes(number)) values.push(number);
    if (values.length > MAX_REFERENCES) throw new Error("Autonomous QA targeted fix PR references too many closing Issues.");
  }
  return values;
}

function field(body, label, allowEmpty = false) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = String(body || "").match(new RegExp(`^- ${escaped}: \\`([^\\`]+)\\`$`, "mi"))?.[1]?.trim() || "";
  if (!value && !allowEmpty) throw new Error(`Autonomous QA targeted fix defect is missing ${label}.`);
  return value;
}

function refsBetween(body, heading, nextHeading) {
  const start = String(body || "").indexOf(`${heading}:`);
  if (start < 0) return [];
  const remainder = String(body).slice(start + heading.length + 1);
  const end = nextHeading ? remainder.indexOf(`${nextHeading}:`) : -1;
  const section = end >= 0 ? remainder.slice(0, end) : remainder;
  const refs = [...section.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1].trim()).filter(Boolean);
  return Object.freeze([...new Set(refs)].slice(0, 64));
}

function parseAutonomousDefectIssue(issue) {
  const body = String(issue?.body || "");
  const fingerprint = body.match(DEFECT_MARKER)?.[1]?.toLowerCase() || "";
  if (!fingerprint) return null;
  const testerRole = field(body, "Tester role");
  const adapter = TESTER_ADAPTERS[testerRole];
  if (!adapter) throw new Error(`Autonomous QA targeted fix defect has an unsupported tester role: ${testerRole}.`);
  const failingCommitSha = exactSha(field(body, "Exact failing commit"), "failing");
  const routeId = field(body, "Route", true);
  const reproductionRefs = refsBetween(body, "Reproduction evidence", "Machine evidence");
  if (!reproductionRefs.length) throw new Error("Autonomous QA targeted fix defect has no bounded reproduction evidence.");
  return Object.freeze({
    issueNumber: Number(issue.number),
    issueUrl: String(issue.html_url || ""),
    fingerprint,
    testerRole,
    adapter,
    routeId: routeId === "route-independent" ? "" : routeId,
    failingCommitSha,
    reproductionRefs,
  });
}

async function githubIssue(fetchImpl, token, repository, issueNumber) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/issues/${issueNumber}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`Autonomous QA targeted fix Issue lookup failed with HTTP ${response.status}.`);
  return response.json();
}

export async function resolveAutonomousQaTargetedFix({ pullRequest, repository, token, fetchImpl = fetch }) {
  const repo = repositoryName(repository);
  const fixCommitSha = exactSha(pullRequest?.head?.sha, "fix head");
  if (String(pullRequest?.base?.ref || "") !== "main") {
    throw new Error("Autonomous QA targeted fix is limited to pull requests targeting main.");
  }
  const issueNumbers = closingIssueNumbers(pullRequest?.body);
  if (!issueNumbers.length) {
    return Object.freeze({ matched: false, reason: "no-closing-issue-reference", fixCommitSha });
  }
  if (!String(token || "").trim()) throw new Error("Autonomous QA targeted fix Issue lookup requires a GitHub token.");

  const candidates = [];
  for (const issueNumber of issueNumbers) {
    const issue = await githubIssue(fetchImpl, token, repo, issueNumber);
    if (issue?.pull_request) continue;
    const candidate = parseAutonomousDefectIssue(issue);
    if (candidate) candidates.push(candidate);
  }
  if (!candidates.length) {
    return Object.freeze({ matched: false, reason: "no-autonomous-defect-reference", fixCommitSha });
  }
  if (candidates.length !== 1) {
    throw new Error("Autonomous QA targeted fix requires exactly one linked autonomous defect per repair PR.");
  }
  const defect = candidates[0];
  if (defect.failingCommitSha === fixCommitSha) {
    throw new Error("Autonomous QA targeted fix must run on a different exact commit than the failing build.");
  }

  return Object.freeze({
    matched: true,
    campaignType: "targeted-rerun",
    fixCommitSha,
    ...defect,
    sourceMutationAllowed: false,
    repairAuthorityGranted: false,
    mergeAuthorityGranted: false,
    deterministicGateRequired: true,
    aiSelfCertified: false,
  });
}

function githubOutputValue(value) {
  return String(value ?? "").replace(/[\r\n]/g, "");
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("Autonomous QA targeted fix resolver requires GITHUB_EVENT_PATH.");
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const result = await resolveAutonomousQaTargetedFix({
    pullRequest: event.pull_request,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
  });
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    const entries = {
      matched: result.matched ? "true" : "false",
      adapter: result.adapter || "",
      tester_role: result.testerRole || "",
      fingerprint: result.fingerprint || "",
      fix_head: result.fixCommitSha,
      failing_head: result.failingCommitSha || "",
      linked_issue_number: result.issueNumber || "",
    };
    await writeFile(outputPath, `${Object.entries(entries).map(([key, value]) => `${key}=${githubOutputValue(value)}`).join("\n")}\n`, { flag: "a" });
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
