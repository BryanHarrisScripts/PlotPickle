import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Plugin } from "vite";

const exec = promisify(execFile);
type JsonRecord = Record<string, unknown>;

type WritingAssistantStatus = {
  readonly localRuntime?: {
    readonly ready?: boolean;
    readonly runtime?: string;
    readonly models?: Record<string, { readonly available?: boolean; readonly model?: string; readonly name?: string }>;
  };
  readonly mastra?: {
    readonly ready?: boolean;
    readonly mode?: string;
    readonly version?: string;
    readonly agents?: string[];
  };
};

type ChatResult = {
  readonly text?: string;
  readonly latencyMs?: number;
  readonly message?: string;
};

type SageProbeAttempt = {
  readonly text: string;
  readonly antiEcho: boolean;
  readonly repetitionSafe: boolean;
  readonly grounded: boolean;
};

type SageProbeResult = SageProbeAttempt & {
  readonly latencyMs: number;
  readonly route: "Fast" | "Fast retry" | "Quality fallback" | "Fast retry; Quality unavailable";
  readonly recovered: boolean;
};

type FoundationProbeResult = {
  readonly latencyMs: number;
  readonly structured: boolean;
  readonly route: "Quality" | "Quality retry" | "per-field recovery" | "failed";
  readonly attempts: number;
};

const DISPLAY_WIDTH = 34;
const ANSI = {
  green: "\u001b[92m",
  yellow: "\u001b[93m",
  red: "\u001b[91m",
  cyan: "\u001b[96m",
  reset: "\u001b[0m",
} as const;
const INTERNAL_SCAFFOLD_LINE = /^(?:\[LOCAL CURRICULUM BLOCK\b.*\]|Status:|Authority:|Lesson:|Section:|Bundled curriculum material:|Material type:|Curriculum scope:|Historical claim:|Current correction \().*$/i;
const SAGE_DIAGNOSTIC_REPAIR_INSTRUCTION = [
  "STARTUP HEALTH RETRY.",
  "Answer the craft question directly in one or two fresh sentences under 70 words.",
  "Use only curriculum_context for the teaching claim.",
  "Explain that theme is an idea or question tested by what characters decide or do and by what follows from those decisions.",
  "Do not repeat the question, expose prompt scaffolding, or mention this retry.",
].join(" ");
const SAGE_DIAGNOSTIC_QUALITY_INSTRUCTION = [
  "STARTUP HEALTH QUALITY FALLBACK.",
  "Give one clean two-sentence answer under 70 words.",
  "Paraphrase the curriculum instead of copying the question.",
  "Explain theme and how story choices/actions lead to outcomes/consequences that test it.",
  "Do not mention this fallback or internal machinery.",
].join(" ");
const FOUNDATION_REPAIR_INSTRUCTION = [
  "STARTUP PLAN STRUCTURED REPAIR.",
  "Return JSON only in the exact shape requested.",
  "Include every requested field ID with a substantive story answer.",
  "Do not omit fields, copy the field label, return only the word Provisional, or add prose outside JSON.",
].join(" ");

function clock() {
  return new Date().toTimeString().slice(0, 8);
}

function stateColor(state: "PASS" | "FAIL" | "WARN" | "SKIP") {
  if (state === "PASS") return ANSI.green;
  if (state === "FAIL") return ANSI.red;
  return ANSI.yellow;
}

function printResult(label: string, state: "PASS" | "FAIL" | "WARN" | "SKIP", detail = "") {
  const dots = ".".repeat(Math.max(3, DISPLAY_WIDTH - label.length));
  const coloredState = `${stateColor(state)}${state}${ANSI.reset}`;
  console.log(`[${clock()}] ${label} ${dots} ${coloredState}${detail ? `  ${detail}` : ""}`);
}

function stripInternalScaffolding(value: string) {
  return value
    .replace(/&lt;\s*\/?\s*[a-z][a-z0-9_-]*(?:\s+[^&\n]{0,120})?&gt;/gi, "")
    .replace(/\\u003c\s*\/?\s*[a-z][a-z0-9_-]*(?:[^\\\n]{0,120})?\\u003e/gi, "")
    .replace(/<\s*\/?\s*[a-z][a-z0-9_-]*(?:\s+[^>\n]{0,120})?>/gi, "")
    .replace(/^\s*(?:student_question|conversation_memory|project_memory|curriculum_context)\s*:?\s*$/gim, "")
    .replace(/\r/g, "");
}

function cleanDiagnosticSageAnswer(value: string) {
  const uniqueLines: string[] = [];
  for (const line of stripInternalScaffolding(value).split("\n")) {
    const normalized = line.trim();
    if (INTERNAL_SCAFFOLD_LINE.test(normalized)) continue;
    if (/^(?:Curriculum|Lesson references)\s*:/i.test(normalized)) continue;
    if (!normalized && !uniqueLines.at(-1)) continue;
    if (normalized && normalized === uniqueLines.at(-1)?.trim()) continue;
    uniqueLines.push(line.trimEnd());
  }
  return uniqueLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function comparableText(value: string) {
  return cleanDiagnosticSageAnswer(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function contentWords(value: string) {
  const ignored = new Set(["a", "an", "and", "are", "as", "by", "does", "how", "in", "is", "it", "of", "or", "the", "this", "to", "what"]);
  return comparableText(value).split(/\s+/).filter((word) => word && !ignored.has(word));
}

function antiEchoPass(answer: string, question: string) {
  const normalizedAnswer = comparableText(answer);
  const normalizedQuestion = comparableText(question);
  if (!normalizedAnswer || normalizedAnswer === normalizedQuestion) return false;
  const answerWords = normalizedAnswer.split(/\s+/).filter(Boolean);
  const questionWords = normalizedQuestion.split(/\s+/).filter(Boolean);
  if (normalizedAnswer.includes(normalizedQuestion) && answerWords.length <= questionWords.length + 8) return false;
  const questionContent = contentWords(question);
  if (questionContent.length < 3 || answerWords.length > questionWords.length + 12) return true;
  const answerSet = new Set(contentWords(answer));
  const overlap = questionContent.filter((word) => answerSet.has(word)).length / questionContent.length;
  return overlap < 0.85;
}

function repetitionPass(answer: string) {
  const words = comparableText(answer).split(/\s+/).filter(Boolean);
  if (words.length < 24) return true;
  const counts = new Map<string, number>();
  for (let index = 0; index <= words.length - 5; index += 1) {
    const phrase = words.slice(index, index + 5).join(" ");
    const count = (counts.get(phrase) || 0) + 1;
    if (count >= 3) return false;
    counts.set(phrase, count);
  }
  return true;
}

function groundingPass(answer: string) {
  const words = new Set(comparableText(answer).split(/\s+/).filter(Boolean));
  const hasThemeMeaning = ["theme", "idea", "question", "argument", "proposition", "belief", "worldview", "meaning"].some((term) => words.has(term));
  const hasStoryTest = ["choice", "choices", "decision", "decisions", "action", "actions", "behavior", "behaviour", "conflict", "test", "tests", "pressure", "climax"].some((term) => words.has(term));
  const hasResult = ["consequence", "consequences", "outcome", "outcomes", "result", "results", "effect", "effects", "cost", "costs", "payoff", "ending"].some((term) => words.has(term));
  return hasThemeMeaning && hasStoryTest && hasResult;
}

function sageAttemptPass(attempt: SageProbeAttempt) {
  return Boolean(attempt.text) && attempt.antiEcho && attempt.repetitionSafe && attempt.grounded;
}

function parseFoundationValues(value: string, fieldIds: readonly string[]) {
  const unfenced = value.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    const parsed = JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const root = parsed as Record<string, unknown>;
    const candidate = root.values && typeof root.values === "object" && !Array.isArray(root.values)
      ? root.values as Record<string, unknown>
      : root;
    const values: Record<string, string> = {};
    for (const fieldId of fieldIds) {
      const text = typeof candidate[fieldId] === "string" ? candidate[fieldId].trim() : "";
      if (text.length < 20 || /^provisional\s*[—:-]?\s*$/i.test(text) || /placeholder for a concrete working choice/i.test(text)) return null;
      values[fieldId] = text;
    }
    return values;
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const value = await response.json() as JsonRecord;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : `${response.status} ${response.statusText}`);
  return value as T;
}

async function loadThemeProbe() {
  const raw = await readFile(path.resolve(process.cwd(), "learn/theme.json"), "utf8");
  const document = JSON.parse(raw) as { readonly lessons?: Array<{ readonly id?: string; readonly title?: string; readonly overview?: string; readonly sections?: Array<{ readonly heading?: string; readonly paragraphs?: string[]; readonly points?: string[] }>; readonly definitions?: Array<{ readonly term?: string; readonly meaning?: string }> }> };
  const lessons = document.lessons || [];
  const lesson = lessons.find((item) => item.id === "essentials-theme") || lessons.find((item) => /theme/i.test(item.title || "")) || lessons[0];
  const themeDefinition = lesson?.definitions?.find((definition) => definition.term?.trim().toLowerCase() === "theme");
  const context = [lesson?.title, lesson?.overview, themeDefinition ? `Theme: ${themeDefinition.meaning}` : "", ...(lesson?.sections || []).slice(0, 2).flatMap((section) => [section.heading, ...(section.paragraphs || []), ...(section.points || [])])].filter(Boolean).join("\n").slice(0, 4_000);
  return {
    question: "In one or two fresh sentences, explain this curriculum's view of theme and how a story tests the idea through character decisions and their outcomes.",
    context,
  };
}

async function loadRole(baseUrl: string, role: "fast" | "quality") {
  return fetchJson<JsonRecord>(`${baseUrl}/api/local-ai/runtime/model/${role}/load`, { method: "POST" }, 40_000);
}

async function requestSageProbeAttempt(baseUrl: string, message: string, question: string, modelRole: "fast" | "quality", timeoutMs: number): Promise<SageProbeAttempt> {
  const result = await fetchJson<ChatResult>(`${baseUrl}/api/writing-assistant/chat`, {
    method: "POST",
    body: JSON.stringify({ agentId: "curriculum-guide", provider: "local", modelRole, tone: "gentle", message }),
  }, timeoutMs);
  const text = cleanDiagnosticSageAnswer(result.text?.trim() || "");
  return { text, antiEcho: antiEchoPass(text, question), repetitionSafe: repetitionPass(text), grounded: groundingPass(text) };
}

async function runSageProbe(baseUrl: string): Promise<SageProbeResult> {
  const { question, context } = await loadThemeProbe();
  const message = [
    "CONVERSATION MODE: PlotPickle/story craft. Answer the actual craft question first. Use curriculum_context as the source of truth.",
    "<curriculum_context>",
    `[LOCAL CURRICULUM BLOCK startup-health-theme]\nStatus: current\nAuthority: governing\nLesson: Make Theme a Dramatic Argument\nSection: Startup health probe\n${context}`,
    "</curriculum_context>",
    "<student_question>",
    question,
    "</student_question>",
  ].join("\n\n");
  const started = Date.now();
  let attempt = await requestSageProbeAttempt(baseUrl, message, question, "fast", 60_000);
  if (sageAttemptPass(attempt)) return { ...attempt, latencyMs: Date.now() - started, route: "Fast", recovered: false };
  attempt = await requestSageProbeAttempt(baseUrl, `${SAGE_DIAGNOSTIC_REPAIR_INSTRUCTION}\n\n${message}`, question, "fast", 45_000);
  if (sageAttemptPass(attempt)) return { ...attempt, latencyMs: Date.now() - started, route: "Fast retry", recovered: true };
  try {
    await loadRole(baseUrl, "quality");
  } catch {
    return { ...attempt, latencyMs: Date.now() - started, route: "Fast retry; Quality unavailable", recovered: false };
  }
  attempt = await requestSageProbeAttempt(baseUrl, `${SAGE_DIAGNOSTIC_QUALITY_INSTRUCTION}\n\n${message}`, question, "quality", 75_000);
  return { ...attempt, latencyMs: Date.now() - started, route: "Quality fallback", recovered: sageAttemptPass(attempt) };
}

async function requestFoundationProbe(baseUrl: string, fieldIds: readonly string[], message: string) {
  return fetchJson<ChatResult>(`${baseUrl}/api/writing-assistant/chat`, {
    method: "POST",
    body: JSON.stringify({
      agentId: "foundations-planner",
      provider: "local",
      modelRole: "quality",
      tone: "direct",
      foundationFieldIds: fieldIds,
      message,
    }),
  }, 75_000);
}

async function runFoundationsProbe(baseUrl: string): Promise<FoundationProbeResult> {
  const started = Date.now();
  const fieldIds = ["output-1", "output-2"] as const;
  const message = "Use only these disposable startup-test facts. output-1: A cartographer discovers her coastal maps are changing overnight. output-2: She must decide whether to expose the impossible changes or protect the town that depends on her charts. Return JSON only as {\"values\":{\"output-1\":\"...\",\"output-2\":\"...\"}} with both fields answered substantively.";
  let attempts = 0;

  let result = await requestFoundationProbe(baseUrl, fieldIds, message);
  attempts += 1;
  if (parseFoundationValues(result.text?.trim() || "", fieldIds)) {
    return { latencyMs: result.latencyMs || Date.now() - started, structured: true, route: "Quality", attempts };
  }

  result = await requestFoundationProbe(baseUrl, fieldIds, `${FOUNDATION_REPAIR_INSTRUCTION}\n\n${message}`);
  attempts += 1;
  if (parseFoundationValues(result.text?.trim() || "", fieldIds)) {
    return { latencyMs: Date.now() - started, structured: true, route: "Quality retry", attempts };
  }

  const recovered: Record<string, string> = {};
  for (const fieldId of fieldIds) {
    const fact = fieldId === "output-1"
      ? "A cartographer discovers her coastal maps are changing overnight."
      : "She must decide whether to expose the impossible changes or protect the town that depends on her charts.";
    const oneFieldMessage = `${FOUNDATION_REPAIR_INSTRUCTION}\nField ID: ${fieldId}\nDisposable startup-test fact: ${fact}\nReturn only {\"values\":{\"${fieldId}\":\"a substantive answer\"}}.`;
    const one = await requestFoundationProbe(baseUrl, [fieldId], oneFieldMessage);
    attempts += 1;
    const parsed = parseFoundationValues(one.text?.trim() || "", [fieldId]);
    if (!parsed) return { latencyMs: Date.now() - started, structured: false, route: "failed", attempts };
    recovered[fieldId] = parsed[fieldId];
  }
  return {
    latencyMs: Date.now() - started,
    structured: fieldIds.every((fieldId) => Boolean(recovered[fieldId])),
    route: "per-field recovery",
    attempts,
  };
}

async function reportStartupFinding(input: { fingerprint: string; title: string; message: string; evidence: Record<string, unknown> }) {
  const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const artifactRoot = path.join(localRoot, "PlotPickle", "uat-focused");
  await mkdir(artifactRoot, { recursive: true });
  const reportPath = path.join(artifactRoot, "startup-agent-findings.json");
  const finding = {
    schemaVersion: 1,
    fingerprint: input.fingerprint,
    area: "startup",
    severity: "blocker",
    title: input.title,
    message: input.message,
    evidence: input.evidence,
  };
  await writeFile(reportPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), overall: "FAIL", findings: [finding] }, null, 2)}\n`, "utf8");
  try {
    const reporter = path.resolve(process.cwd(), "scripts/report-uat-findings.mjs");
    await exec(process.execPath, [reporter, "--report", reportPath], { cwd: process.cwd(), windowsHide: true, timeout: 45_000, maxBuffer: 2 * 1024 * 1024 });
    return { reportPath, github: true };
  } catch {
    return { reportPath, github: false };
  }
}

export async function runStartupAgentDiagnostics(baseUrl: string) {
  console.log(`\n${ANSI.cyan}============================================================${ANSI.reset}`);
  console.log(`${ANSI.cyan}  PlotPickle - Mastra and Agent Health Check${ANSI.reset}`);
  console.log(`${ANSI.cyan}============================================================${ANSI.reset}\n`);

  let failed = false;
  let warned = false;
  let status: WritingAssistantStatus;
  try {
    status = await fetchJson<WritingAssistantStatus>(`${baseUrl}/api/writing-assistant/status`, undefined, 15_000);
  } catch (error) {
    const message = error instanceof Error ? error.message : "status endpoint unavailable";
    printResult("Mastra runtime", "FAIL", message.slice(0, 90));
    console.log(`\n${ANSI.red}OVERALL: NEEDS ATTENTION${ANSI.reset}\n`);
    return { healthy: false, warnings: false };
  }

  const mastraReady = status.mastra?.ready === true;
  const embeddedReady = status.mastra?.mode === "embedded";
  const agents = status.mastra?.agents || [];
  const sageRegistered = agents.includes("curriculum-guide");
  const foundationsRegistered = agents.includes("foundations-planner");
  printResult("Mastra runtime", mastraReady ? "PASS" : "FAIL", status.mastra?.version ? `v${status.mastra.version}` : "");
  printResult("Embedded runtime", embeddedReady ? "PASS" : "FAIL", status.mastra?.mode || "unknown");
  failed ||= !mastraReady || !embeddedReady;

  let fastReady = status.localRuntime?.models?.fast?.available === true;
  if (fastReady) {
    try { await loadRole(baseUrl, "fast"); } catch { fastReady = false; }
  }
  printResult("Fast model", fastReady ? "PASS" : "FAIL");
  printResult("Sage Brinewick registered", sageRegistered ? "PASS" : "FAIL");
  failed ||= !fastReady || !sageRegistered;

  if (fastReady && sageRegistered) {
    try {
      const sage = await runSageProbe(baseUrl);
      const responsePass = Boolean(sage.text);
      const routeDetail = sage.route === "Fast" ? "" : ` via ${sage.route}`;
      const recoveryDetail = sage.recovered && sage.route !== "Fast" ? `recovered via ${sage.route}` : "";
      printResult("Sage response", responsePass ? "PASS" : "FAIL", `${(sage.latencyMs / 1000).toFixed(1)}s${routeDetail}`);
      printResult("Sage anti-echo check", sage.antiEcho ? "PASS" : "FAIL", recoveryDetail);
      printResult("Sage repetition guard", sage.repetitionSafe ? "PASS" : "FAIL", recoveryDetail);
      printResult("Curriculum grounding", sage.grounded ? "PASS" : "FAIL", recoveryDetail);
      failed ||= !responsePass || !sage.antiEcho || !sage.repetitionSafe || !sage.grounded;
    } catch (error) {
      printResult("Sage response", "FAIL", (error instanceof Error ? error.message : "Sage probe failed").slice(0, 90));
      printResult("Sage anti-echo check", "SKIP");
      printResult("Sage repetition guard", "SKIP");
      printResult("Curriculum grounding", "SKIP");
      failed = true;
    }
  } else {
    printResult("Sage response", "SKIP");
    printResult("Sage anti-echo check", "SKIP");
    printResult("Sage repetition guard", "SKIP");
    printResult("Curriculum grounding", "SKIP");
  }

  console.log("");
  let qualityReady = status.localRuntime?.models?.quality?.available === true;
  if (qualityReady) {
    try { await loadRole(baseUrl, "quality"); } catch { qualityReady = false; }
  }
  printResult("Quality model", qualityReady ? "PASS" : "WARN", qualityReady ? "" : "not configured or unavailable");
  printResult("Foundations Planner", foundationsRegistered ? "PASS" : "FAIL");
  warned ||= !qualityReady;
  failed ||= !foundationsRegistered;

  if (qualityReady && foundationsRegistered) {
    try {
      const plan = await runFoundationsProbe(baseUrl);
      const recovered = plan.structured && plan.route !== "Quality";
      printResult("Foundations Planner response", "PASS", `${(plan.latencyMs / 1000).toFixed(1)}s${recovered ? ` via ${plan.route}` : ""}`);
      printResult("Structured JSON", plan.structured ? "PASS" : "FAIL", plan.structured ? (recovered ? `recovered via ${plan.route}` : "") : `failed after ${plan.attempts} structured attempts`);
      if (!plan.structured) {
        failed = true;
        const finding = await reportStartupFinding({
          fingerprint: "plan.structured-output-failure",
          title: "Foundations Planner could not recover required structured output",
          message: "Startup PLAN health exhausted batch repair and per-field recovery without producing both requested structured fields.",
          evidence: { target: baseUrl, source: "startup-agent-diagnostics-runtime-v3", route: plan.route, attempts: plan.attempts, fieldIds: ["output-1", "output-2"] },
        });
        printResult("UAT finding", finding.github ? "PASS" : "WARN", finding.github ? "reported to GitHub; repair handoff will create/update a draft PR" : `saved locally: ${finding.reportPath}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Foundations probe failed";
      printResult("Foundations Planner response", "FAIL", message.slice(0, 90));
      printResult("Structured JSON", "SKIP");
      failed = true;
    }
  } else {
    printResult("Foundations Planner response", "SKIP");
    printResult("Structured JSON", "SKIP");
  }

  const overall = failed ? "NEEDS ATTENTION" : warned ? "HEALTHY WITH OPTIONAL WARNINGS" : "HEALTHY";
  const overallColor = failed ? ANSI.red : warned ? ANSI.yellow : ANSI.green;
  console.log(`\n${overallColor}OVERALL: ${overall}${ANSI.reset}\n`);
  return { healthy: !failed, warnings: warned };
}

export function startupAgentDiagnosticsPlugin(): Plugin {
  return {
    name: "plotpickle-startup-agent-diagnostics-v3",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const port = server.config.server.port || 5173;
        const baseUrl = `http://127.0.0.1:${port}`;
        setTimeout(() => {
          void runStartupAgentDiagnostics(baseUrl).catch((error) => {
            const message = error instanceof Error ? error.message : "unexpected diagnostic failure";
            console.error(`${ANSI.red}[${clock()}] Agent health check ................. FAIL  ${message}${ANSI.reset}`);
            console.error(`\n${ANSI.red}OVERALL: NEEDS ATTENTION${ANSI.reset}\n`);
          });
        }, 750);
      });
    },
  };
}
