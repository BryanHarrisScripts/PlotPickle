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

const DISPLAY_WIDTH = 34;
const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "before", "being", "between", "could", "from", "have", "into", "more", "only", "other", "should", "story", "than", "that", "their", "theme", "there", "these", "they", "this", "through", "what", "when", "where", "which", "with", "would", "your",
]);

function clock() {
  return new Date().toTimeString().slice(0, 8);
}

function printResult(label: string, state: "PASS" | "FAIL" | "WARN" | "SKIP", detail = "") {
  const dots = ".".repeat(Math.max(3, DISPLAY_WIDTH - label.length));
  console.log(`[${clock()}] ${label} ${dots} ${state}${detail ? `  ${detail}` : ""}`);
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

function meaningfulTokens(value: string) {
  return new Set(comparableText(value)
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !STOP_WORDS.has(word)));
}

function groundingPass(answer: string, curriculumContext: string) {
  const answerTokens = meaningfulTokens(answer);
  const contextTokens = meaningfulTokens(curriculumContext);
  let overlap = 0;
  for (const token of answerTokens) {
    if (contextTokens.has(token)) overlap += 1;
  }
  return overlap >= 2;
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
  if (themeDefinition?.meaning) {
    return {
      question: "What is theme?",
      context: `Theme: ${themeDefinition.meaning}`,
    };
  }
  const lesson = lessons.find((item) => /theme/i.test(item.title || "")) || lessons[0];
  const context = [
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
    question: "What is theme?",
    context,
  };
}

async function loadRole(baseUrl: string, role: "fast" | "quality") {
  return fetchJson<JsonRecord>(`${baseUrl}/api/local-ai/runtime/model/${role}/load`, {
    method: "POST",
  }, 40_000);
}

async function runSageProbe(baseUrl: string) {
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
  const result = await fetchJson<ChatResult>(`${baseUrl}/api/writing-assistant/chat`, {
    method: "POST",
    body: JSON.stringify({
      agentId: "curriculum-guide",
      provider: "local",
      modelRole: "fast",
      tone: "gentle",
      message,
    }),
  }, 60_000);
  const text = result.text?.trim() || "";
  return {
    text,
    latencyMs: result.latencyMs || Date.now() - started,
    antiEcho: antiEchoPass(text, question),
    grounded: groundingPass(text, context),
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
  let structured = false;
  try {
    const parsed = JSON.parse(text) as { readonly values?: Record<string, string> };
    structured = Boolean(parsed.values?.["output-1"]?.trim() && parsed.values?.["output-2"]?.trim());
  } catch {
    structured = false;
  }
  return {
    latencyMs: result.latencyMs || Date.now() - started,
    structured,
  };
}

export async function runStartupAgentDiagnostics(baseUrl: string) {
  console.log("\n============================================================");
  console.log("  PlotPickle - Mastra and Agent Health Check");
  console.log("============================================================\n");

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
    printResult("Curriculum grounding", "SKIP");
    console.log("");
    printResult("Quality model", "FAIL");
    printResult("Foundations Planner", "SKIP");
    printResult("Structured JSON", "SKIP");
    console.log("\nOVERALL: NEEDS ATTENTION\n");
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
      printResult("Sage response", responsePass ? "PASS" : "FAIL", `${(sage.latencyMs / 1000).toFixed(1)}s`);
      printResult("Sage anti-echo check", sage.antiEcho ? "PASS" : "FAIL");
      printResult("Curriculum grounding", sage.grounded ? "PASS" : "FAIL");
      failed ||= !responsePass || !sage.antiEcho || !sage.grounded;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sage probe failed";
      printResult("Sage response", "FAIL", message.slice(0, 90));
      printResult("Sage anti-echo check", "SKIP");
      printResult("Curriculum grounding", "SKIP");
      failed = true;
    }
  } else {
    printResult("Sage response", "SKIP");
    printResult("Sage anti-echo check", "SKIP");
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
      printResult("Structured JSON", plan.structured ? "PASS" : "FAIL");
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
  console.log(`\nOVERALL: ${overall}\n`);
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
            console.error(`[${clock()}] Agent health check ................. FAIL  ${message}`);
            console.error("\nOVERALL: NEEDS ATTENTION\n");
          });
        }, 750);
      });
    },
  };
}
