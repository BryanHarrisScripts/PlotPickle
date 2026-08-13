import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type {
  FoundationDraftProposal,
  FoundationPlanLesson,
} from "../../core/contracts/foundation-plan";

export interface FoundationDraftRequest {
  readonly projectTitle: string;
  readonly lesson: FoundationPlanLesson;
  readonly curriculumLesson: CurriculumLesson;
  readonly currentAnswers: Readonly<Record<string, string>>;
  readonly priorStoryContext: string;
}

function isTimeout(error: unknown) {
  return error instanceof DOMException
    && (error.name === "TimeoutError" || error.name === "AbortError");
}

function xmlText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function parseProposal(
  value: string,
  lesson: FoundationPlanLesson,
): Readonly<Record<string, string>> {
  const unfenced = value
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("The local model did not return a structured proposal. Your fields were not changed.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
  } catch {
    throw new Error("The local model returned an unreadable proposal. Your fields were not changed.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The local model returned an invalid proposal. Your fields were not changed.");
  }
  const root = parsed as Record<string, unknown>;
  const candidate = root.values && typeof root.values === "object" && !Array.isArray(root.values)
    ? root.values as Record<string, unknown>
    : root;
  const allowed = new Set(lesson.fields.map((field) => field.id));
  const values = Object.fromEntries(
    Object.entries(candidate)
      .filter((entry): entry is [string, string] => (
        allowed.has(entry[0]) && typeof entry[1] === "string" && Boolean(entry[1].trim())
      ))
      .map(([fieldId, text]) => [fieldId, text.trim().slice(0, 1_800)]),
  );
  const missingFields = lesson.fields.filter((field) => !values[field.id]);
  if (missingFields.length) {
    throw new Error("The local model did not propose an answer for every visible field. Your fields were not changed.");
  }
  const copiedPrompts = lesson.fields.filter((field) => (
    values[field.id]?.replace(/\s+/g, " ").trim().toLocaleLowerCase()
    === field.prompt.replace(/\s+/g, " ").trim().toLocaleLowerCase()
  ));
  if (copiedPrompts.length) {
    throw new Error("The local model repeated the planning questions instead of answering them. Add story detail or choose a stronger local model; your fields were not changed.");
  }
  return values;
}

async function preflightLocalRuntime() {
  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("PlotPickle could not verify the local Mastra/Ollama runtime within three seconds.");
    throw error;
  }
  const status = await response.json() as {
    readonly message?: string;
    readonly mastra?: { readonly ready?: boolean; readonly error?: string };
    readonly providers?: { readonly ollama?: { readonly model?: string } };
    readonly ollama?: { readonly reachable?: boolean; readonly models?: readonly string[]; readonly error?: string };
  };
  if (!response.ok) throw new Error(status.message || "PlotPickle could not verify the local writing runtime.");
  if (!status.mastra?.ready) throw new Error(status.mastra?.error || "The embedded Mastra runtime is not ready.");
  if (!status.ollama?.reachable) throw new Error(status.ollama?.error || "Ollama is not reachable. Start Ollama and try again.");
  if (!status.ollama.models?.length) throw new Error(status.ollama?.error || "Ollama is running, but no installed model is available.");
  return status.providers?.ollama?.model || status.ollama.models[0] || "local Ollama model";
}

function lessonContext(lesson: CurriculumLesson) {
  return [
    `Lesson: ${lesson.title}`,
    `Overview: ${lesson.overview}`,
    `Objectives: ${lesson.objectives.join("; ")}`,
    ...lesson.sections.map((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.points ?? []),
    ].join("\n")),
  ].join("\n").slice(0, 6_500);
}

export async function draftFoundationLesson(
  input: FoundationDraftRequest,
): Promise<FoundationDraftProposal> {
  const configuredModel = await preflightLocalRuntime();
  const fieldShape = Object.fromEntries(input.lesson.fields.map((field) => [field.id, field.prompt]));
  const message = [
    "<task>",
    "Draft a separate, reviewable proposal for each requested PLAN field. Use only the writer material and lesson context below. Do not invent story facts. When evidence is missing, write a useful provisional statement that clearly marks the unknown. Return JSON only in the exact shape {\"values\":{\"output-1\":\"...\"}} using only the supplied field IDs.",
    "</task>",
    "<project>",
    xmlText(input.projectTitle),
    "</project>",
    "<lesson_context>",
    xmlText(lessonContext(input.curriculumLesson)),
    "</lesson_context>",
    "<requested_fields>",
    xmlText(JSON.stringify(fieldShape)),
    "</requested_fields>",
    "<current_writer_answers>",
    xmlText(JSON.stringify(input.currentAnswers)),
    "</current_writer_answers>",
    "<accepted_prior_foundation_work>",
    xmlText(input.priorStoryContext.slice(0, 3_000) || "No earlier answers are available."),
    "</accepted_prior_foundation_work>",
  ].join("\n");

  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "foundations-planner",
        provider: "ollama",
        tone: "collaborative",
        foundationFieldIds: input.lesson.fields.map((field) => field.id),
        message,
      }),
      signal: AbortSignal.timeout(27_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("The local Foundations drafter did not answer within 30 seconds. Your fields were not changed.");
    throw error;
  }
  const result = await response.json() as {
    readonly message?: string;
    readonly model?: string;
    readonly text?: string;
  };
  if (!response.ok || !result.text) {
    throw new Error(result.message || "The local Foundations drafter could not reach Ollama.");
  }
  return {
    values: parseProposal(result.text, input.lesson),
    model: result.model || configuredModel,
    generatedAt: new Date().toISOString(),
  };
}
