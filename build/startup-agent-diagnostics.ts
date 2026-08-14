import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

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
  readonly ok?: boolean;
  readonly text?: string;
  readonly model?: string;
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

const DISPLAY_WIDTH = 34;
const GROUNDING_PROBE_PHRASE = "copper lighthouse";
const SAGE_DIAGNOSTIC_REPAIR_INSTRUCTION = [
  "STARTUP HEALTH RETRY.",
  "The previous Fast response repeated, echoed, or failed a grounding check.",
  "Answer the student directly and freshly using the supplied curriculum_context.",
  "Include the named example motif from the curriculum context exactly once.",
  "Do not repeat the question or loop phrases, and do not mention this retry.",
].join(" ");
const SAGE_DIAGNOSTIC_QUALITY_INSTRUCTION = [
  "STARTUP HEALTH QUALITY FALLBACK.",
  "The Fast model failed the same response-quality checks twice.",
  "Produce one clean final answer grounded in curriculum_context.",
  "Include the named example motif from the curriculum context exactly once.",
  "Do not repeat the question or loop phrases, and do not mention this fallback.",
].join(" ");
const ANSI = {
  green: "\u001b[92m",
  yellow: "\u001b[93m",
  red: "\u001b[91m",
  cyan: "\u001b[96m",
  reset: "\u001b[0m",
} as const;

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

function comparableText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function antiEchoPass(answer: string, question: string) {
  const normalizedAnswer = comparableText(answer);
  const normalizedQuestion = comparableText(question);
  if (!normalizedAnswer || normalizedAnswer === normalizedQuestion) return false;
  const answerWords = normalizedAnswer.split(/\s+/).filter(Boolean);
  const questionWords = normalizedQuestion.split(/\s+/).filter(Boolean);
  return !(normalizedAnswer.includes(normalizedQuestion) && answerWords.length <= questionWords.length + 5);
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
  return comparableText(answer).includes(GROUNDING_PROBE_PHRASE);
}

function sageAttemptPass(attempt: SageProbeAttempt) {
  return Boolean(attempt.text) && attempt.antiEcho && attempt.repetitionSafe && attempt.grounded;
}

function structuredFoundationPass(value: string) {
  const unfenced = value
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const root = parsed as Record<string, unknown>;
  const candidate = root.values && typeof root.values === "object" && !Array.isArray(root.values)
    ? root.values as Record<string, unknown>
    : root;
  return ["output-1", "output-2"].every((fieldId) => (
    typeof candidate[fieldId] === "string" && Boolean((candidate[fieldId] as string).trim())
  ));
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
  const raw = await readFile(resolve(process.cwd(), "learn/theme.json"), "utf8");
  const document = JSON.parse(raw) as {
    readonly lessons?: Array<{
      readonly title?: string;
      readonly overview?: string;
      readonly sections?: Array<{ readonly heading?: string; readonly paragraphs?: string[]; readonly points?: string[] }>;
      readonly definitions?: Array<{ readonly term?: string; readonly meaning?: string }>;
    }>;
  };
  const lessons = document.lessons || [];
  const themeDefinition = lessons
    .flatMap((lesson) => lesson.definitions || [])
    .find((definition) => definition.term?.trim().toLowerCase() === "theme");
  const lesson = lessons.find((item) => /theme/i.test(item.title || "")) || lessons[0];
  const curriculumText = themeDefinition?.meaning
    ? `Theme: ${themeDefinition.meaning}`
    : [
      lesson?.title,
      lesson?.overview,
      ...(lesson?.sections || []).flatMap((section) => [
        section.heading,
        ...(section.paragraphs || []),
        ...(section.points || []),
      ]),
      ...(lesson?.definitions || []).map((definition) => `${definition.term}: ${definition.meaning}`),
    ].filter(Boolean).join("\n").slice(0, 5_000);

  return {
    question: "What is theme, and what example motif does this curriculum context name?",
    context: `${curriculumText}\nStartup health example motif: ${GROUNDING_PROBE_PHRASE}.`,
  };
}

async function loadRole(baseUrl: string, role: "fast" | "quality") {
  return fetchJson<JsonRecord>(`${baseUrl}/api/local-ai/runtime/model/${role}/load`, {
    method: "POST",
  }, 40_000);
}

async function requestSageProbeAttempt(
  baseUrl: string,
  message: string,
  question: string,
  modelRole: "fast" | "quality",
  timeoutMs: number,
): Promise<SageProbeAttempt> {
  const result = await fetchJson<ChatResult>(`${baseUrl}/api/writing-assistant/chat`, {
    method: "POST",
    body: JSON.stringify({
      agentId: "curriculum-guide",
      provider: "local",
      modelRole,
      tone: "gentle",
      message,
    }),
  }, timeoutMs);
  const text = result.text?.trim() || "";
  return {
    text,
    antiEcho: antiEchoPass(text, question),
    repetitionSafe: repetitionPass(text),
    grounded: groundingPass(text),
  };
}

async function runSageProbe(baseUrl: string): Promise<SageProbeResult> {
  const { question, context } = await loadThemeProbe();
  const message = [
    "<curriculum_context>",
    `[LOCAL CURRICULUM BLOCK startup-health-theme]\nStatus: current\nAuthority: governing\nLesson: Theme, Tone and Motif\nSection: Startup health probe\n${context}`,
    "</curriculum_context>",
    "<student_question>",
    question,
    "</student_question>",
  ].join("\n\n");
  const started = Date.now();

  let attempt = await requestSageProbeAttempt(baseUrl, message, question, "fast", 60_000);
  if (sageAttemptPass(attempt)) {
    return { ...attempt, latencyMs: Date.now() - started, route: "Fast", recovered: false };
  }

  attempt = await requestSageProbeAttempt(
    baseUrl,
    `${SAGE_DIAGNOSTIC_REPAIR_INSTRUCTION}\n\n${message}`,
    question,
    "fast",
    45_000,
  );
  if (sageAttemptPass(attempt)) {
    return { ...attempt, latencyMs: Date.now() - started, route: "Fast retry", recovered: true };
  }

  try {
    await loadRole(baseUrl, "quality");
  } catch {
    return {
      ...attempt,
      latencyMs: Date.now() - started,
      route: "Fast retry; Quality unavailable",
      recovered: false,
    };
  }

  attempt = await requestSageProbeAttempt(
    baseUrl,
    `${SAGE_DIAGNOSTIC_QUALITY_INSTRUCTION}\n\n${message}`,
    question,
    "quality",
    75_000,
  );
  return {
    ...attempt,
    latencyMs: Date.now() - started,
    route: "Quality fallback",
    recovered: sageAttemptPass(attempt),
  };
}

async function runFoundationsProbe(baseUrl: string) {
  const started = Date.now();
  const result = await fetchJson<ChatResult>(`${baseUrl}/api/writing-assistant/chat`, {
    method: "POST",
    body: JSON.stringify({
      agentId: "foundations-planner",
      provider: "local",
      modelRole: "quality",
      tone: "direct",
      foundationFieldIds: ["output-1", "output-2"],
      message: "Use only these disposable startup-test facts. output-1: A cartographer discovers her coastal maps are changing overnight. output-2: She must decide whether to expose the impossible changes or protect the town that depends on her charts. Return only the requested structured proposal.",
    }),
  }, 75_000);
  const text = result.text?.trim() || "";
  return {
    latencyMs: result.latencyMs || Date.now() - started,
    structured: structuredFoundationPass(text),
  };
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
    printResult("Embedded runtime", "FAIL");
    printResult("Fast model", "FAIL");
    printResult("Sage Brinewick registered", "FAIL");
    printResult("Sage response", "SKIP");
    printResult("Sage anti-echo check", "SKIP");
    printResult("Sage repetition guard", "SKIP");
    printResult("Curriculum grounding", "SKIP");
    console.log("");
    printResult("Quality model", "FAIL");
    printResult("Foundations Planner", "SKIP");
    printResult("Structured JSON", "SKIP");
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
    try {
      await loadRole(baseUrl, "fast");
    } catch {
      fastReady = false;
    }
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
      printResult("Sage anti-echo check", sage.antiEcho ? "PASS" : "FAIL", sage.antiEcho ? recoveryDetail : "");
      printResult("Sage repetition guard", sage.repetitionSafe ? "PASS" : "FAIL", sage.repetitionSafe ? recoveryDetail : "");
      printResult("Curriculum grounding", sage.grounded ? "PASS" : "FAIL", sage.grounded ? recoveryDetail : `missing '${GROUNDING_PROBE_PHRASE}' probe`);
      failed ||= !responsePass || !sage.antiEcho || !sage.repetitionSafe || !sage.grounded;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sage probe failed";
      printResult("Sage response", "FAIL", message.slice(0, 90));
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
    try {
      await loadRole(baseUrl, "quality");
    } catch {
      qualityReady = false;
    }
  }
  printResult("Quality model", qualityReady ? "PASS" : "WARN", qualityReady ? "" : "not configured or unavailable");
  printResult("Foundations Planner", foundationsRegistered ? "PASS" : "FAIL");
  warned ||= !qualityReady;
  failed ||= !foundationsRegistered;

  if (qualityReady && foundationsRegistered) {
    try {
      const plan = await runFoundationsProbe(baseUrl);
      printResult("Foundations Planner response", "PASS", `${(plan.latencyMs / 1000).toFixed(1)}s`);
      printResult("Structured JSON", plan.structured ? "PASS" : "FAIL", plan.structured ? "" : "response did not contain both requested fields");
      failed ||= !plan.structured;
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
    name: "plotpickle-startup-agent-diagnostics",
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
