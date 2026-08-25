"use client";

import { useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { applyStoryCommand } from "../../../core/project/apply-command";
import type { PPFProject } from "../../../core/project/project";
import {
  normalizeStoryResult,
  type StoryResult,
  type StoryWorkItem,
} from "../../../core/story-workflow/story-workflow-core.mjs";
import {
  loadFoundationProject,
  saveFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import {
  createFoundationsStoryResponsibilityRun,
  planFoundationsStoryWork,
  resolveFoundationsStoryWorkItem,
  storyWorkflowActivitySummary,
} from "../foundations-story-workflow";
import FoundationsBuzzStoryLiveTest from "./foundations-buzz-story-live-test";
import styles from "./foundations-story-workflow-panel.module.css";

type RunResponse = {
  readonly ok?: boolean;
  readonly message?: string;
  readonly run?: { readonly runId?: string; readonly state?: string };
};

type AgentResponse = {
  readonly ok?: boolean;
  readonly message?: string;
  readonly text?: string;
  readonly model?: string;
  readonly runtimeProvider?: string;
  readonly agentId?: string;
};

function overlapping(left: readonly string[], claimed: ReadonlySet<string>) {
  return left.some((ref) => claimed.has(ref));
}

function selectIndependent(items: readonly StoryWorkItem[], maximum = 2) {
  const claimed = new Set<string>();
  const selected: StoryWorkItem[] = [];
  for (const item of items) {
    if (item.status !== "queued" || overlapping(item.targetRefs, claimed)) continue;
    selected.push(item);
    item.targetRefs.forEach((ref) => claimed.add(ref));
    if (selected.length >= maximum) break;
  }
  return selected;
}

async function runRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/responsibility-runs", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const value = await response.json() as RunResponse;
  if (!response.ok || !value.ok) throw new Error(value.message || `Responsibility Run returned ${response.status}.`);
  return value;
}

function taskMessage(input: ReturnType<typeof createFoundationsStoryResponsibilityRun>) {
  const safeItems = input.contextPacket.items.map((item) => ({
    sourceType: item.sourceType,
    allowedUse: item.allowedUse,
    authority: item.authority,
    content: item.content,
  }));
  return [
    "This is one bounded PlotPickle Story Workflow task. Use only the supplied task-scoped context. Return the requested Foundations field as a reviewable proposal. Do not claim to change canon and do not add hidden reasoning.",
    JSON.stringify({ goal: input.contextPacket.goal, context: safeItems }),
  ].join("\n\n").slice(0, 11_500);
}

async function askLocalFoundationsPlanner(fieldId: string, task: ReturnType<typeof createFoundationsStoryResponsibilityRun>) {
  const response = await fetch("/api/writing-assistant/chat", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      provider: "local",
      modelRole: "quality",
      agentId: "foundations-planner",
      tone: "direct",
      foundationFieldIds: [fieldId],
      message: taskMessage(task),
      history: [],
    }),
  });
  const value = await response.json() as AgentResponse;
  if (!response.ok || !value.ok || !value.text) throw new Error(value.message || "The local Story Workflow specialist returned no proposal.");
  const parsed = JSON.parse(value.text) as unknown;
  const values = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as { readonly values?: unknown }).values
    : null;
  const answer = values && typeof values === "object" && !Array.isArray(values)
    ? (values as Record<string, unknown>)[fieldId]
    : null;
  if (typeof answer !== "string" || !answer.trim()) throw new Error("The local Story Workflow specialist did not answer the requested field.");
  return { answer: answer.trim(), runtime: value };
}

function saveReviewableProposal(input: {
  lessonId: string;
  fieldId: string;
  answer: string;
  model: string;
  occurredAt: string;
}) {
  const current = loadFoundationProject();
  const existing = current.foundations.lessons[input.lessonId]?.proposal;
  const next = applyStoryCommand(current, {
    type: "foundations.proposal.store",
    lessonId: input.lessonId,
    proposal: {
      values: { ...(existing?.values ?? {}), [input.fieldId]: input.answer },
      model: input.model,
      generatedAt: input.occurredAt,
    },
    occurredAt: input.occurredAt,
  });
  saveFoundationProject(next);
}

export default function FoundationsStoryWorkflowPanel({
  project,
  curriculum,
  onOpenPlan,
}: {
  readonly project: PPFProject;
  readonly curriculum: readonly CurriculumLesson[];
  readonly onOpenPlan?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [recentResults, setRecentResults] = useState<StoryResult[]>([]);
  const workItems = useMemo(
    () => planFoundationsStoryWork(project, { curriculum, maxItems: 12 }),
    [curriculum, project],
  );
  const queued = workItems.filter((item) => item.status === "queued");
  const waiting = workItems.filter((item) => item.status === "waiting-human");
  const selected = selectIndependent(queued, 2);

  async function execute(item: StoryWorkItem) {
    const resolved = resolveFoundationsStoryWorkItem(item, curriculum);
    if (!resolved) throw new Error(`Story Workflow could not resolve ${item.curriculumRequirementId} against the current curriculum.`);
    const task = createFoundationsStoryResponsibilityRun({ project, workItem: item, curriculum });
    let created = false;
    const execution = async () => {
      await runRequest({
        action: "create",
        runId: task.run.runId,
        kind: task.run.kind,
        goal: task.run.goal,
        profileId: task.run.profileId,
        skillUris: task.run.skillUris,
        allowedScopes: task.run.allowedScopes,
        allowedConnectorIds: task.run.allowedConnectorIds,
        context: task.run.context,
        limits: task.run.limits,
        parentRunId: task.run.parentRunId,
      });
      created = true;
      await runRequest({
        action: "start",
        runId: task.run.runId,
        contextCharacters: task.contextPacket.receipt.usedCharacters,
      });
      const generated = await askLocalFoundationsPlanner(resolved.field.id, task);
      const now = new Date().toISOString();
      const result = normalizeStoryResult({
        resultId: `${task.run.runId}:proposal`,
        workItemId: item.workItemId,
        kind: "proposal",
        targetRefs: item.targetRefs,
        evidenceRefs: task.contextPacket.receipt.sources.map((source) => source.id),
        curriculumRequirementId: item.curriculumRequirementId,
        principleRef: `curriculum:${resolved.lesson.id}:${resolved.field.id}`,
        severity: item.severity,
        confidence: 0,
        changesCanon: true,
        explanation: `Tamsin produced one reviewable candidate for ${resolved.lesson.title}. The candidate is not accepted story canon until you approve it in PLAN.`,
        proposal: generated.answer,
        alternatives: [],
        affectedDownstreamRefs: item.dependencyRefs,
      });
      saveReviewableProposal({
        lessonId: resolved.lesson.id,
        fieldId: resolved.field.id,
        answer: generated.answer,
        model: `Story Workflow · Tamsin · ${generated.runtime.runtimeProvider || "local"}/${generated.runtime.model || "quality"}`,
        occurredAt: now,
      });
      await runRequest({
        action: "proposal-ready",
        runId: task.run.runId,
        resultId: result.resultId,
        ref: `ppf-proposal:${resolved.lesson.id}:${resolved.field.id}`,
        producedAt: now,
      });
      return result;
    };

    return execution().then(undefined, async (error: unknown) => {
      const reason = error instanceof Error ? error.message : "Story Workflow specialist failed.";
      if (created) {
        await Promise.allSettled([runRequest({
          action: "cancel",
          runId: task.run.runId,
          reason,
        })]);
      }
      throw new Error(`Story Workflow check failed for ${item.curriculumRequirementId}: ${reason}`, { cause: error });
    });
  }

  async function runChecks() {
    if (running || !selected.length) return;
    setRunning(true);
    setNotice(`Running ${selected.length} independent local story ${selected.length === 1 ? "check" : "checks"}…`);
    try {
      const results = await Promise.all(selected.map(execute));
      setRecentResults((current) => [...results, ...current].slice(0, 6));
      setNotice(`${results.length} reviewable ${results.length === 1 ? "proposal is" : "proposals are"} ready in PLAN. Nothing was accepted automatically.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Workflow could not finish the local checks.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="foundations-story-workflow-title" data-story-workflow="foundations">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Story Workflow · Foundations</p>
          <h2 id="foundations-story-workflow-title">Bounded story checks, not an agent swarm.</h2>
          <p>{storyWorkflowActivitySummary(workItems)} PlotPickle derives these tasks from the same live curriculum and current PPF used by PLAN and BUILD.</p>
        </div>
        <div className={styles.counts} aria-label="Story Workflow counts">
          <span><strong>{queued.length}</strong> ready</span>
          <span><strong>{waiting.length}</strong> waiting for you</span>
        </div>
      </header>

      <div className={styles.explainer}>
        <p>One click can start up to two independent local checks. Each specialist receives only the exact story field, current curriculum requirement and bounded evidence needed for that task.</p>
        <p>Results become reviewable PLAN proposals. Agents cannot accept them, write canon, use BUZZ authority, or silently fall back to paid cloud models.</p>
      </div>

      <div className={styles.actions}>
        <button type="button" disabled={running || !selected.length} onClick={() => void runChecks()}>
          {running ? "Running local story checks…" : selected.length ? `Run ${selected.length} story ${selected.length === 1 ? "check" : "checks"}` : "No new checks to run"}
        </button>
        <FoundationsBuzzStoryLiveTest
          curriculum={curriculum}
          disabled={running}
          onStatus={setNotice}
          project={project}
          workItem={selected[0] ?? null}
        />
        {onOpenPlan ? <button className={styles.secondary} type="button" onClick={onOpenPlan}>Review in PLAN{waiting.length ? ` (${waiting.length})` : ""}</button> : null}
      </div>

      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      {recentResults.length ? (
        <div className={styles.results} aria-label="Recent Story Workflow proposals">
          {recentResults.map((result) => (
            <article key={result.resultId}>
              <span>{result.humanGate.replaceAll("-", " ")}</span>
              <p>{result.explanation}</p>
              <blockquote>{result.proposal}</blockquote>
            </article>
          ))}
        </div>
      ) : null}

      <p className={styles.footnote}>Story Workflow work is visible in Responsibility Runs. Private model deliberation is never stored as project evidence; only bounded inputs, structured results and Human decisions are retained.</p>
    </section>
  );
}
