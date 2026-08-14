import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type {
  FoundationDraftProposal,
  FoundationPlanField,
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

function comparableText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function contentWords(value: string) {
  const ignored = new Set(["a", "an", "and", "are", "as", "at", "be", "for", "in", "is", "of", "on", "or", "the", "to", "what", "with", "you", "your"]);
  return comparableText(value).split(/\s+/).filter((word) => word && !ignored.has(word));
}

function looksLikePromptEcho(answer: string, prompt: string) {
  const normalizedAnswer = comparableText(answer);
  const normalizedPrompt = comparableText(prompt);
  if (!normalizedAnswer || normalizedAnswer === normalizedPrompt) return true;
  const promptWords = contentWords(prompt);
  const answerWords = contentWords(answer);
  if (!promptWords.length || answerWords.length > promptWords.length + 10) return false;
  const answerSet = new Set(answerWords);
  const overlap = promptWords.filter((word) => answerSet.has(word)).length / promptWords.length;
  return overlap >= 0.82;
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
  const copiedPrompts = lesson.fields.filter((field) => looksLikePromptEcho(values[field.id] || "", field.prompt));
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
    "Because this content is still an unaccepted proposal, when writer evidence is missing you may invent a plausible working candidate, but it MUST begin with 'Provisional —' and must be presented as a suggestion rather than existing canon.",
    "Do not claim that provisional character names, events, settings, outcomes, or other candidate details already exist in the writer's story.",
    "Return JSON only, in the exact requested values shape, with no commentary outside the JSON.",
  ].join(" ");
}

function proposalTask() {
  return [
    "Draft a separate, reviewable proposal for each requested PLAN field.",
    "Use accepted writer material as canon when it exists.",
    "Never copy or lightly paraphrase a requested planning question as its answer.",
    "If accepted story evidence is missing, create a useful plausible working candidate and begin that field with 'Provisional —'. Provisional candidate details are suggestions for review, not claims about existing canon.",
    "The writer must still explicitly accept a proposal before PlotPickle changes project decisions.",
    "Return JSON only in the exact shape {\"values\":{\"output-1\":\"...\"}} using only the supplied field IDs.",
  ].join(" ");
}

function buildBatchMessage(input: FoundationDraftRequest, fieldShape: Readonly<Record<string, string>>) {
  return [
    "<task>",
    proposalTask(),
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
    xmlText(input.priorStoryContext.slice(0, 3_000) || "No accepted story answers are available yet."),
    "</accepted_prior_foundation_work>",
  ].join("\n");
}

function safeProvisionalFallback(field: FoundationPlanField) {
  return [
    "Provisional — this story decision is still open because no accepted writer material produced a usable local-model answer.",
    `Field focus: ${field.prompt}`,
    "Treat this as a placeholder for a concrete working choice, then replace it with story-specific evidence before accepting it as canon.",
  ].join(" ").slice(0, 1_800);
}

async function recoverFieldsIndividually(
  input: FoundationDraftRequest,
  configuredModel: string,
) {
  const values: Record<string, string> = {};
  let usedSafetyFallback = false;
  let lastModel = configuredModel;

  for (const field of input.lesson.fields) {
    const singleLesson: FoundationPlanLesson = { ...input.lesson, fields: [field] };
    const compactMessage = [
      "RECOVER ONE PLAN FIELD.",
      proposalTask(),
      `Field ID: ${field.id}`,
      `Field question: ${field.prompt}`,
      `Current writer answer: ${input.currentAnswers[field.id]?.trim() || "none"}`,
      `Accepted story context: ${input.priorStoryContext.slice(0, 1_500) || "none"}`,
      `Lesson guidance: ${lessonContext(input.curriculumLesson).slice(0, 2_500)}`,
      `Return only {\"values\":{\"${field.id}\":\"...\"}}.`,
    ].join("\n");

    try {
      const result = await requestFoundationProposal(compactMessage, [field.id], 27_000);
      const parsed = parseProposal(result.text || "", singleLesson);
      values[field.id] = parsed[field.id];
      lastModel = result.model || lastModel;
    } catch {
      usedSafetyFallback = true;
      values[field.id] = safeProvisionalFallback(field);
    }
  }

  return {
    values,
    model: usedSafetyFallback ? `${lastModel} + provisional safety fallback` : lastModel,
  };
}

export async function draftFoundationLesson(
  input: FoundationDraftRequest,
): Promise<FoundationDraftProposal> {
  const configuredModel = await preflightLocalRuntime();
  const fieldShape = Object.fromEntries(input.lesson.fields.map((field) => [field.id, field.prompt]));
  const message = buildBatchMessage(input, fieldShape);
  const fieldIds = input.lesson.fields.map((field) => field.id);

  let result = await requestFoundationProposal(message, fieldIds, 27_000);
  try {
    const values = parseProposal(result.text || "", input.lesson);
    return {
      values,
      model: result.model || configuredModel,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (!(error instanceof FoundationProposalQualityError)) throw error;
  }

  result = await requestFoundationProposal(`${repairInstruction()}\n\n${message}`, fieldIds, 27_000);
  try {
    const values = parseProposal(result.text || "", input.lesson);
    return {
      values,
      model: result.model || configuredModel,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (!(error instanceof FoundationProposalQualityError)) throw error;
  }

  // After two attempts, recover each field as a smaller task instead of abandoning the whole proposal.
  const recovered = await recoverFieldsIndividually(input, result.model || configuredModel);
  return {
    values: recovered.values,
    model: recovered.model,
    generatedAt: new Date().toISOString(),
  };
}
