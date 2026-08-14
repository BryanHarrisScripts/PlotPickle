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

class FoundationProposalQualityError extends Error {}

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
    throw new FoundationProposalQualityError("The local model did not return a structured proposal.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
  } catch {
    throw new FoundationProposalQualityError("The local model returned an unreadable proposal.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FoundationProposalQualityError("The local model returned an invalid proposal.");
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
    throw new FoundationProposalQualityError("The local model did not propose an answer for every visible field.");
  }
  const copiedPrompts = lesson.fields.filter((field) => (
    values[field.id]?.replace(/\s+/g, " ").trim().toLocaleLowerCase()
    === field.prompt.replace(/\s+/g, " ").trim().toLocaleLowerCase()
  ));
  if (copiedPrompts.length) {
    throw new FoundationProposalQualityError("The local model repeated one or more planning questions instead of answering them.");
  }
  return values;
}

async function preparePlanQualityModel() {
  let response: Response;
  try {
    response = await fetch("/api/local-ai/runtime/model/quality/load", {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(35_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("PlotPickle could not prepare PLAN's Quality local model within 35 seconds. Open Settings and run Load/test PLAN Quality.");
    throw error;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { readonly message?: string };
    throw new Error(body.message || "PlotPickle could not prepare PLAN's Quality local model. Open Settings and review the Quality role.");
  }
}

async function preflightLocalRuntime() {
  await preparePlanQualityModel();
  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("PlotPickle could not verify the local Mastra runtime within three seconds.");
    throw error;
  }
  const status = await response.json() as {
    readonly message?: string;
    readonly mastra?: { readonly ready?: boolean; readonly error?: string };
    readonly localRuntime?: {
      readonly ready?: boolean;
      readonly runtime?: string;
      readonly error?: string;
      readonly models?: {
        readonly quality?: {
          readonly recommended?: string;
          readonly selected?: string;
          readonly available?: boolean;
        };
      };
    };
  };
  if (!response.ok) throw new Error(status.message || "PlotPickle could not verify the local writing runtime.");
  if (!status.mastra?.ready) throw new Error(status.mastra?.error || "The embedded Mastra runtime is not ready.");
  if (!status.localRuntime?.ready) {
    throw new Error(status.localRuntime?.error || "No production-ready local OpenAI-compatible runtime is available. Open Settings and configure the Quality role.");
  }
  const quality = status.localRuntime.models?.quality;
  if (!quality?.available || !quality.selected) {
    throw new Error(`${quality?.recommended || "The Quality local model"} is not available. Open Settings, configure the Quality role, and run Load/test PLAN Quality; your fields were not changed.`);
  }
  return quality.selected;
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

type DraftModelResult = {
  readonly message?: string;
  readonly model?: string;
  readonly text?: string;
};

async function requestFoundationProposal(
  message: string,
  fieldIds: readonly string[],
  timeoutMs: number,
) {
  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PlotPickle-Model-Role": "quality",
      },
      body: JSON.stringify({
        agentId: "foundations-planner",
        provider: "local",
        modelRole: "quality",
        tone: "collaborative",
        foundationFieldIds: fieldIds,
        message,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("The local Foundations drafter did not answer within PlotPickle's local response limit. Your fields were not changed.");
    throw error;
  }
  const result = await response.json() as DraftModelResult;
  if (!response.ok || !result.text) {
    throw new Error(result.message || "The local Foundations drafter could not reach the active OpenAI-compatible runtime.");
  }
  return result;
}

function repairInstruction() {
  return [
    "REPAIR THE PLAN PROPOSAL.",
    "The previous proposal was unusable because it copied a planning question, omitted a field, or returned invalid structured output.",
    "For every requested field ID, write an actual proposed answer. Never copy or lightly paraphrase the field question as the answer.",
    "Use accepted writer material wherever it exists.",
    "If the story does not yet contain enough evidence, write a short statement beginning with 'Provisional —' that names what is still unknown and the next useful story decision, using only the supplied lesson context.",
    "Do not invent character names, events, settings, outcomes, or other story facts.",
    "Return JSON only, in the exact requested values shape, with no commentary outside the JSON.",
  ].join(" ");
}

export async function draftFoundationLesson(
  input: FoundationDraftRequest,
): Promise<FoundationDraftProposal> {
  const configuredModel = await preflightLocalRuntime();
  const fieldShape = Object.fromEntries(input.lesson.fields.map((field) => [field.id, field.prompt]));
  const message = [
    "<task>",
    "Draft a separate, reviewable proposal for each requested PLAN field. Use only the writer material and lesson context below. Do not invent story facts. Never copy or lightly paraphrase a requested planning question as its answer. When evidence is missing, write a useful statement beginning with 'Provisional —' that clearly names the unresolved story decision and the next useful decision the writer can make. Return JSON only in the exact shape {\"values\":{\"output-1\":\"...\"}} using only the supplied field IDs.",
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

  const fieldIds = input.lesson.fields.map((field) => field.id);
  let result = await requestFoundationProposal(message, fieldIds, 27_000);
  let values: Readonly<Record<string, string>>;
  try {
    values = parseProposal(result.text || "", input.lesson);
  } catch (error) {
    if (!(error instanceof FoundationProposalQualityError)) throw error;
    result = await requestFoundationProposal(`${repairInstruction()}\n\n${message}`, fieldIds, 27_000);
    try {
      values = parseProposal(result.text || "", input.lesson);
    } catch (retryError) {
      if (retryError instanceof FoundationProposalQualityError) {
        throw new Error("PLAN's local AI could not produce usable field answers after two attempts. Add one sentence of story detail or choose a stronger Quality model; your fields were not changed.");
      }
      throw retryError;
    }
  }

  return {
    values,
    model: result.model || configuredModel,
    generatedAt: new Date().toISOString(),
  };
}
