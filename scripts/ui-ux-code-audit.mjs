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
    evidence: cleanText(value.evidence, 500),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function suggestionAlreadySatisfied(finding) {
  const evidence = finding.evidence.toLowerCase();
  const requestedAttributes = [...finding.suggestion.matchAll(/\b(?:add|include|apply|set)\s+[`'\"]?(aria-[\w-]+|role|tabindex|loading)[`'\"]?(?:\s*=\s*[`'\"]?([\w-]+))?/gi)];
  return requestedAttributes.some((match) => {
    const attribute = match[1].toLowerCase();
    const expectedValue = (match[2] || "").toLowerCase();
    if (!evidence.includes(attribute)) return false;
    return !expectedValue || evidence.includes(`${attribute}="${expectedValue}"`) || evidence.includes(`${attribute}='${expectedValue}'`);
  });
}

function referencedIdsExist(finding, source) {
  const reference = finding.evidence.match(/aria-(?:labelledby|describedby)=["']([^"']+)["']/i);
  if (!reference) return false;
  const claimsMissing = /(?:does not exist|missing|invalid reference|cannot be found)/i.test(`${finding.message} ${finding.suggestion}`);
  if (!claimsMissing) return false;
  return reference[1].split(/\s+/).filter(Boolean).every((id) => new RegExp(`id=["']${escapeRegExp(id)}["']`).test(source));
}

function tokenValue(value, context) {
  const trimmed = value.trim();
  const variable = trimmed.match(/^var\((--[\w-]+)\)$/i);
  if (!variable) return trimmed;
  const definition = context.match(new RegExp(`${escapeRegExp(variable[1])}\\s*:\\s*(#[0-9a-f]{3,8})`, "i"));
  return definition?.[1] || "";
}

function channelLuminance(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function colorLuminance(value) {
  const hex = value.toLowerCase();
  const full = /^#[0-9a-f]{3}$/.test(hex)
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  if (!/^#[0-9a-f]{6}$/.test(full)) return null;
  const red = channelLuminance(Number.parseInt(full.slice(1, 3), 16));
  const green = channelLuminance(Number.parseInt(full.slice(3, 5), 16));
  const blue = channelLuminance(Number.parseInt(full.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastClaimIsUnsubstantiated(finding, context) {
  if (finding.criterion !== 4 || !/contrast/i.test(`${finding.message} ${finding.suggestion}`)) return false;
  const foregroundMatch = finding.evidence.match(/(?:^|[;{]\s*)color\s*:\s*([^;\n}]+)/i);
  const backgroundMatch = finding.evidence.match(/background(?:-color)?\s*:\s*([^;\n}]+)/i);
  if (!foregroundMatch || !backgroundMatch) return true;
  const foreground = tokenValue(foregroundMatch[1], context);
  const background = tokenValue(backgroundMatch[1], context);
  const foregroundLuminance = colorLuminance(foreground);
  const backgroundLuminance = colorLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return true;
  const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
  return ratio >= 4.5;
}

function contradictsPlatformStandards(finding, source, context) {
  const combined = `${finding.message} ${finding.suggestion}`;
  const evidence = finding.evidence;
  if (/\b(?:may|might|could|potential(?:ly)?|consider|review|unnecessary|excessive|not used to full potential)\b/i.test(combined)) return true;
  if (contrastClaimIsUnsubstantiated(finding, context)) return true;
  if ((finding.criterion === 11 || finding.criterion === 15) && /<div\b[^>]*\brole=["']status["']/i.test(evidence) && /(?:non-semantic|use a semantic element|<status>|aria-live.*static|static content)/i.test(combined)) return true;
  if (finding.criterion === 11 && /<span\b/i.test(evidence) && /(?:block-level|replace\s+<span>\s+with\s+<div>|use\s+<div>)/i.test(combined)) return true;
  if (finding.criterion === 14 && /<(?:button|a|input|textarea|summary|video)\b/i.test(evidence) && /(?:tabindex|tab order|always focusable)/i.test(combined)) return true;
  if (finding.criterion === 11 && /<div><dt>/i.test(evidence) && /<dl\b/i.test(source)) return true;
  if (finding.criterion === 12 && /(?:require|start with|add).*h1/i.test(combined) && /<h[23]\b/i.test(evidence)) return true;
  if (finding.criterion === 16 && /<video\b/i.test(evidence) && /loading/i.test(combined)) return true;
  if (finding.criterion === 17 && finding.file.endsWith(".module.css") && /(?:critical css|render.block)/i.test(combined)) return true;
  if (finding.criterion === 23 && !/(?:^|\/)(?:page|layout|head|document|metadata)\.[^/]+$/i.test(finding.file)) return true;
  return false;
}

function validateFindings(findings, sources, context) {
  const normalized = findings.map(normalizeFinding).filter(Boolean);
  return normalized.filter((finding) => {
    if (finding.kind === "praise") return finding.message.length > 0;
    if (!finding.criterion || !finding.message || !finding.suggestion || !finding.evidence) return false;
    const source = sources.get(finding.file);
    if (typeof source !== "string" || !source.includes(finding.evidence)) return false;
    if (suggestionAlreadySatisfied(finding)) return false;
    if (referencedIdsExist(finding, source)) return false;
    if (contradictsPlatformStandards(finding, source, context)) return false;
    return true;
  });
}

async function writeOutcome({ verdict, summary, findings = [], skipped = false }) {
  const issues = findings.filter((finding) => finding.kind === "issue");
  const finalVerdict = issues.length === 0 ? "pass" : "fail";
  const result = {
    verdict: finalVerdict,
    issueCount: issues.length,
    findingCount: findings.length,
    skipped,
    summary: cleanText(summary, 1_000),
  };
  await writeFile(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const rows = [MARKER, "## UI/UX Code Audit", "", `**Verdict:** ${finalVerdict === "pass" ? "PASS" : "FAIL"}`, "", result.summary || "No summary was returned."];
  if (findings.length) {
    const grouped = new Map();
    for (const finding of findings) {
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
        if (finding.evidence) rows.push(`  - **Evidence:** \`${finding.evidence.replaceAll("`", "\\`")}\``);
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
  const sources = new Map();
  for (const source of files) {
    const file = safeRelativeFile(source);
    if (!file) throw new Error(`Unsafe changed-file path: ${source}`);
    const content = await readFile(file, "utf8");
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > MAX_FILE_BYTES) throw new Error(`${file} exceeds the ${MAX_FILE_BYTES}-byte per-file audit limit.`);
    total += bytes;
    if (total > MAX_TOTAL_BYTES) throw new Error(`Changed UI files exceed the ${MAX_TOTAL_BYTES}-byte audit limit.`);
    sources.set(file, content);
    sections.push(`\n--- FILE: ${file} ---\n${content}`);
  }
  const designContext = await readFile("app/globals.css", "utf8").catch(() => "");
  return { codePayload: sections.join("\n"), sources, designContext: `${designContext}\n${sections.join("\n")}` };
}

async function callAuditModel(codePayload) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for the required UI/UX audit gate.");
  const model = process.env.OPENAI_UI_AUDIT_MODEL || "gpt-4o";
  const prompt = `You are PlotPickle's UI/UX and front-end design-system auditor. Review only the supplied changed files against these 25 criteria:\n\n${criteria.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\nReturn one JSON object only with this exact shape:\n{\n  "verdict": "pass" or "fail",\n  "summary": "concise summary",\n  "findings": [\n    {"kind":"issue" or "praise","criterion":1-25,"file":"exact changed path","message":"specific finding","suggestion":"specific code-level correction","evidence":"exact contiguous source excerpt"}\n  ]\n}\n\nBlocking rules:\n- verdict must be fail when any actual issue is found, including a minor issue; praises never fail the gate.\n- verdict may be pass only when there are zero substantiated issue findings.\n- Every issue must identify a definite standards or design-rule violation, not a possibility, preference, or generic optimization.\n- Every issue must quote an exact contiguous source excerpt in evidence. The excerpt must exist verbatim in the named changed file.\n- Every issue must provide a correction that is valid for the actual HTML, CSS, React, and browser platform involved.\n- Before reporting an issue, inspect the complete supplied file and verify that the requested fix is not already present elsewhere in the same element or component.\n- A contrast issue must include both the foreground and background declarations in the quoted evidence and must be based on resolved color values rather than an unsupported guess.\n- Do not use wording such as may, might, could, potential, consider, review, unnecessary, excessive, or not used to full potential for an issue. Return such observations as praise or omit them.\n- Do not invent files, runtime behavior, contrast values, rendered output, or missing context that cannot be inferred from the supplied code.\n\nPlatform correctness rules:\n- This is a React component audit, not a whole-document audit. A leaf component does not require its own h1. h2 followed by h3 is a valid hierarchy when the component sits beneath a page-level heading.\n- Native buttons, links, inputs, textareas, summary elements, checkboxes, and video controls are keyboard focusable. Do not request tabindex unless the code demonstrably removes focusability or uses a non-interactive element as a control.\n- aria-disabled on a native button intentionally keeps it reachable so the control can explain unmet prerequisites; do not require a disabled attribute as well.\n- ARIA should be minimized. Do not request additional roles or attributes unless there is a specific missing accessible name, state, or relationship.\n- A video described by aria-label, aria-labelledby, aria-describedby plus figcaption, or meaningful fallback text has a description.\n- preload=none is a valid deferred-loading strategy for video. The loading attribute is not a standard HTML video attribute and must never be suggested.\n- CSS Modules are extracted and code-split by the build. Do not flag critical CSS or render blocking merely because a changed file is a CSS Module.\n- SEO and social metadata findings apply only to page, layout, head, metadata, or document-level files, not leaf UI components.\n- A div is a standards-valid grouping child inside dl when it wraps one or more dt/dd groups.\n- A span may contain phrasing content and may be displayed as a block through CSS; that alone is not a semantic defect.\n- DOM-depth findings require an exact excessive nesting path and a concrete simplification that preserves semantic structure.\n- Do not flag semantic strong/em/span choices unless the quoted usage actually conveys the wrong meaning. Decorative marks should be aria-hidden and may use span.\n- Do not include credentials, secrets, or private repository information in the response.\n\nCODE TO AUDIT:\n${codePayload}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
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
    const { codePayload, sources, designContext } = await gatherCode(files);
    const audit = await callAuditModel(codePayload);
    const findings = validateFindings(audit.findings, sources, designContext);
    const issueCount = findings.filter((finding) => finding.kind === "issue").length;
    const summary = issueCount === 0 && audit.verdict === "fail"
      ? "The model returned no standards-valid evidence-backed issue after deterministic contradiction and contrast checks, so the audit passed."
      : audit.summary;
    await writeOutcome({ verdict: issueCount === 0 ? "pass" : audit.verdict, summary, findings });
  } catch (error) {
    await writeOutcome({
      verdict: "fail",
      summary: error instanceof Error ? error.message : "The UI/UX audit could not complete.",
      findings: [{ kind: "issue", criterion: 0, file: "Audit infrastructure", message: "The required audit did not complete successfully.", suggestion: "Correct the audit configuration or provider failure and rerun the check.", evidence: "audit infrastructure failure" }],
    });
  }
}

await main();
