import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const RESULT_PATH = "audit-result.json";
const REPORT_PATH = "audit-report.md";
const MARKER = "<!-- plotpickle-ui-ux-audit -->";
const MAX_FILE_BYTES = 200_000;
const MAX_TOTAL_BYTES = 600_000;

const criteria = [
  "Design System & Token Adherence",
  "Fluid Typography Scale",
  "Layout Mechanics & Grid Integrity",
  "Color Contrast & Theme Readiness",
  "Micro-Visual Polish",
  "Interactive State Matrix",
  "Touch Target Standard",
  "Line-Length & Readability",
  "Motion & Reduced Motion Support",
  "Form UX & Inline Feedback",
  "Semantic HTML Architecture",
  "Heading Hierarchy Integrity",
  "Asset Alt Text Strategy",
  "Keyboard Navigation & Tab Order",
  "ARIA Minimization & Validity",
  "Asset Loading Optimization",
  "Critical CSS & Render Blocking",
  "Font Loading Strategy",
  "DOM Depth & Node Count",
  "Icon & Graphic Delivery",
  "Container Overflow & Edge Defense",
  "Viewport & Safe-Area Bounds",
  "SEO & Social Graph Metadata",
  "Empty & Error States",
  "Dead Code & Scope Hygiene",
];

function changedFiles() {
  return (process.env.CHANGED_FILES || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function safeRelativeFile(value) {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  return normalized && !normalized.startsWith("../") && !path.posix.isAbsolute(normalized) ? normalized : "";
}

function cleanText(value, maximum = 2_000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, maximum);
}

function normalizeFinding(value) {
  if (!value || typeof value !== "object") return null;
  const kind = value.kind === "praise" ? "praise" : "issue";
  const criterion = Number(value.criterion);
  return {
    kind,
    criterion: Number.isInteger(criterion) && criterion >= 1 && criterion <= 25 ? criterion : 0,
    file: cleanText(value.file, 260) || "General",
    message: cleanText(value.message, 1_000),
    suggestion: cleanText(value.suggestion, 1_500),
  };
}

async function writeOutcome({ verdict, summary, findings = [], skipped = false }) {
  const normalized = findings.map(normalizeFinding).filter(Boolean);
  const issues = normalized.filter((finding) => finding.kind === "issue");
  const finalVerdict = verdict === "pass" && issues.length === 0 ? "pass" : "fail";
  const result = {
    verdict: finalVerdict,
    issueCount: issues.length,
    findingCount: normalized.length,
    skipped,
    summary: cleanText(summary, 1_000),
  };
  await writeFile(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const rows = [MARKER, "## UI/UX Code Audit", "", `**Verdict:** ${finalVerdict === "pass" ? "PASS" : "FAIL"}`, "", result.summary || "No summary was returned."];
  if (normalized.length) {
    const grouped = new Map();
    for (const finding of normalized) {
      const list = grouped.get(finding.file) || [];
      list.push(finding);
      grouped.set(finding.file, list);
    }
    for (const [file, fileFindings] of grouped) {
      rows.push("", `### ${file}`);
      for (const finding of fileFindings) {
        const label = finding.kind === "praise" ? "Praise" : "Issue";
        const criterion = finding.criterion ? ` · Criterion ${finding.criterion}` : "";
        rows.push("", `- **${label}${criterion}:** ${finding.message || "No detail supplied."}`);
        if (finding.suggestion) rows.push(`  - **Suggested fix:** ${finding.suggestion}`);
      }
    }
  }
  if (skipped) rows.push("", "No relevant UI files changed, so the required gate passed without calling an external model.");
  await writeFile(REPORT_PATH, `${rows.join("\n")}\n`, "utf8");
}

async function gatherCode(files) {
  let total = 0;
  const sections = [];
  for (const source of files) {
    const file = safeRelativeFile(source);
    if (!file) throw new Error(`Unsafe changed-file path: ${source}`);
    const content = await readFile(file, "utf8");
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > MAX_FILE_BYTES) throw new Error(`${file} exceeds the ${MAX_FILE_BYTES}-byte per-file audit limit.`);
    total += bytes;
    if (total > MAX_TOTAL_BYTES) throw new Error(`Changed UI files exceed the ${MAX_TOTAL_BYTES}-byte audit limit.`);
    sections.push(`\n--- FILE: ${file} ---\n${content}`);
  }
  return sections.join("\n");
}

async function callAuditModel(codePayload) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for the required UI/UX audit gate.");
  const model = process.env.OPENAI_UI_AUDIT_MODEL || "gpt-4o";
  const prompt = `You are PlotPickle's UI/UX and front-end design-system auditor. Review only the supplied changed files against these 25 criteria:\n\n${criteria.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\nReturn one JSON object only with this exact shape:\n{\n  "verdict": "pass" or "fail",\n  "summary": "concise summary",\n  "findings": [\n    {"kind":"issue" or "praise","criterion":1-25,"file":"path","message":"specific finding","suggestion":"specific code-level correction"}\n  ]\n}\n\nRules:\n- verdict must be fail when any actual issue is found, including a minor issue; praises never fail the gate.\n- verdict may be pass only when there are zero issue findings.\n- Every issue must identify the file and criterion and provide an actionable correction.\n- Do not invent files, runtime behavior, contrast values, or rendered output that cannot be inferred from the code.\n- Do not include credentials, secrets, or private repository information in the response.\n\nCODE TO AUDIT:\n${codePayload}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`The UI/UX audit provider returned HTTP ${response.status}.`);
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("The UI/UX audit provider returned no review content.");
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.findings)) throw new Error("The UI/UX audit provider returned an invalid result shape.");
  return parsed;
}

async function main() {
  const files = changedFiles();
  if (!files.length) {
    await writeOutcome({ verdict: "pass", summary: "No relevant UI files changed.", skipped: true });
    return;
  }
  try {
    const codePayload = await gatherCode(files);
    const audit = await callAuditModel(codePayload);
    await writeOutcome({ verdict: audit.verdict, summary: audit.summary, findings: audit.findings });
  } catch (error) {
    await writeOutcome({
      verdict: "fail",
      summary: error instanceof Error ? error.message : "The UI/UX audit could not complete.",
      findings: [{ kind: "issue", criterion: 0, file: "Audit infrastructure", message: "The required audit did not complete successfully.", suggestion: "Correct the audit configuration or provider failure and rerun the check." }],
    });
  }
}

await main();
