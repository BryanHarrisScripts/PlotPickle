"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./review-workflows-panel.module.css";
import {
  AI_REVIEW_LENSES,
  AI_REVIEW_SCOPES,
  approveRevisionProposal,
  createAiReviewRequest,
  createHumanReviewRequest,
  createRevisionProposalFromFeedback,
  exportReviewSummary,
  parseAiReviewResult,
  rejectRevisionProposal,
  reviewDecisionStatus,
  saveAiReviewResult,
  type AiProviderSnapshot,
  type AiReviewLens,
  type AiReviewRequest,
  type AiReviewResult,
  type AiReviewScope,
  type ReviewRevisionProposal,
} from "@/lib/review-workflows";
import {
  createFeedback,
  createStoredFeedbackModel,
  feedbackTargetOptions,
} from "@/lib/unified-feedback-store";
import type { FeedbackAuthorRole, FeedbackStatus } from "@/lib/unified-feedback";
import type { PlotPickleProject } from "@/lib/project";

type ReviewWorkflowPanelProps = {
  project: PlotPickleProject;
  mode: "ai" | "human";
  onProjectChange: (project: PlotPickleProject) => void;
};

type ConnectionResponse = {
  saved?: boolean;
  provider?: string;
  textModel?: string;
  checkedAt?: string;
  message?: string;
};

type GenerationResponse = { text?: string; message?: string };

const HUMAN_ROLES: Array<{ id: FeedbackAuthorRole; label: string }> = [
  { id: "reviewer", label: "Reviewer" },
  { id: "editor", label: "Editor" },
  { id: "director", label: "Director" },
  { id: "producer", label: "Producer" },
  { id: "actor", label: "Actor" },
  { id: "co-writer", label: "Co-writer" },
  { id: "designer", label: "Designer" },
  { id: "other", label: "Other" },
];

function splitLines(value: string) {
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

function titleCase(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function downloadText(name: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function scopeTargetChoices(project: PlotPickleProject, scope: AiReviewScope) {
  if (scope === "act") return [1, 2, 3, 4].map((act) => ({ id: String(act), label: `Act ${act}` }));
  if (scope === "sequence") return project.structure.sequences.map((sequence) => ({ id: String(sequence.number), label: `Sequence ${sequence.number} · ${sequence.title}` }));
  if (scope === "selected-blocks") return project.blocks.map((block) => ({ id: block.id, label: `Block ${block.number} · ${block.title}` }));
  if (scope === "selected-mini-blocks") return project.blocks.flatMap((block) => block.scenes.flatMap((scene) => scene.miniBlocks.map((mini) => ({ id: mini.id, label: `Block ${block.number} · ${mini.label || `Mini-block ${mini.number}`}` }))));
  if (scope === "scenes") return project.blocks.flatMap((block) => block.scenes.map((scene) => ({ id: scene.id, label: `Block ${block.number} · ${scene.title}` })));
  if (scope === "character-arc") return project.characters.map((character) => ({ id: character.id, label: character.name || "Unnamed character" }));
  return [];
}

function ReviewNotice({ request }: { request: AiReviewRequest }) {
  return (
    <section className={styles.noticeGrid} aria-label="AI review submission notice">
      <article><strong>Privacy</strong><p>{request.notice.privacy}</p></article>
      <article><strong>Context</strong><p>{request.notice.context}</p></article>
      <article><strong>Cost</strong><p>{request.notice.cost}</p></article>
      <article><strong>Writer control</strong><p>{request.notice.writerControl}</p></article>
    </section>
  );
}

function AiReviewPanel({ project, onProjectChange }: Omit<ReviewWorkflowPanelProps, "mode">) {
  const [provider, setProvider] = useState<AiProviderSnapshot>({ connected: false, provider: "", model: "", checkedAt: "" });
  const [connectionMessage, setConnectionMessage] = useState("Checking the local AI connection…");
  const [scope, setScope] = useState<AiReviewScope>("project");
  const [lens, setLens] = useState<AiReviewLens>("story-editor");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState("");
  const [request, setRequest] = useState<AiReviewRequest | null>(null);
  const [result, setResult] = useState<AiReviewResult | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState("Choose a scope and lens, then prepare the review locally.");
  const [proposal, setProposal] = useState<ReviewRevisionProposal | null>(null);

  const targetChoices = useMemo(() => scopeTargetChoices(project, scope), [project, scope]);
  const feedbackModel = useMemo(() => createStoredFeedbackModel(project), [project]);
  const acceptedRecords = feedbackModel.records.filter((record) => record.source === "ai" && record.status === "accepted" && record.proposedChange.trim());

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/local-ai/connection", { signal: controller.signal });
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) throw new Error("Local provider gateway is unavailable in this build.");
        const value = await response.json() as ConnectionResponse;
        if (!response.ok) throw new Error(value.message || "The AI connection could not be read.");
        const connected = Boolean(value.saved && value.provider && value.textModel);
        setProvider({ connected, provider: value.provider ?? "", model: value.textModel ?? "", checkedAt: value.checkedAt ?? "" });
        setConnectionMessage(connected ? `${value.provider} · ${value.textModel}` : "No provider is connected. Requests can still be prepared locally.");
      } catch (error) {
        if (controller.signal.aborted) return;
        setProvider({ connected: false, provider: "", model: "", checkedAt: "" });
        setConnectionMessage(error instanceof Error ? error.message : "No provider is connected.");
      }
    })();
    return () => controller.abort();
  }, []);

  function chooseScope(next: AiReviewScope) {
    setScope(next);
    setTargetIds([]);
    setRequest(null);
    setResult(null);
    setAcknowledged(false);
  }

  function toggleTarget(id: string) {
    const single = scope === "act" || scope === "sequence" || scope === "character-arc";
    setTargetIds((current) => single ? [id] : current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setRequest(null);
    setResult(null);
    setAcknowledged(false);
  }

  function prepareReview() {
    const needsTarget = targetChoices.length > 0;
    if (needsTarget && !targetIds.length) {
      setMessage("Select at least one stable review target for this scope.");
      return;
    }
    const next = createAiReviewRequest(project, {
      scope,
      lens,
      targetIds,
      customQuestions: splitLines(questions),
      provider,
    });
    setRequest(next);
    setResult(null);
    setAcknowledged(false);
    setState("idle");
    setMessage(`Prepared ${next.contextItems.length} anchored context item${next.contextItems.length === 1 ? "" : "s"}. No provider call has been made.`);
  }

  async function submitReview() {
    if (!request || !provider.connected || !acknowledged) return;
    setState("working");
    setMessage("Submitting the selected context to the connected provider…");
    try {
      const response = await fetch("/api/local-ai/generate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: request.instructions, prompt: request.prompt }),
      });
      const value = await response.json() as GenerationResponse;
      if (!response.ok || !value.text) throw new Error(value.message || "The provider returned no review output.");
      const parsed = parseAiReviewResult(request, value.text);
      setResult(parsed);
      setState("idle");
      setMessage(`Review completed with ${parsed.findings.length} structured finding${parsed.findings.length === 1 ? "" : "s"}. Canon is unchanged.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The AI review could not be completed.");
    }
  }

  function saveAllFindings() {
    if (!result) return;
    onProjectChange(saveAiReviewResult(project, result));
    setMessage("AI findings were saved as under-review Feedback records. Canon remains unchanged.");
  }

  function saveFinding(index: number, decision: "accept" | "reject" | "defer") {
    if (!result) return;
    const finding = result.findings[index];
    if (!finding) return;
    const status: FeedbackStatus = reviewDecisionStatus(decision);
    const provenance = [
      finding.body,
      finding.evidence ? `Evidence: ${finding.evidence}` : "",
      `AI review provenance: ${result.provider || "configured provider"} · ${result.model || "configured model"}`,
      `Completed: ${result.completedAt}`,
      `Prompt hash: ${result.promptHash}`,
    ].filter(Boolean).join("\n\n");
    const next = createFeedback(project, {
      title: finding.title,
      body: provenance,
      author: `${result.provider || "AI"} review`,
      role: "ai-assistant",
      source: "ai",
      status,
      priority: finding.priority,
      category: finding.category,
      proposedChange: finding.proposedChange,
      target: finding.target,
    });
    onProjectChange(next);
    setMessage(`${titleCase(status)} finding saved as Feedback. No canonical story content changed.`);
  }

  function prepareProposal(recordId: string) {
    const next = createRevisionProposalFromFeedback(project, recordId);
    setProposal(next);
    setMessage(next ? "Revision proposal prepared. It remains inert until explicitly approved." : "This feedback has no proposed change to convert.");
  }

  return (
    <section className={`${styles.workflowPanel} ${styles.aiPanel}`} aria-label="AI Review workflow">
      <header className={styles.workflowHeader}>
        <div><p>Optional AI review</p><h2>Prepare the review locally. Submit only after checking scope, privacy and cost.</h2></div>
        <span className={provider.connected ? styles.connected : styles.disconnected}>{connectionMessage}</span>
      </header>

      <div className={styles.workflowGrid}>
        <label><span>Scope</span><select value={scope} onChange={(event) => chooseScope(event.target.value as AiReviewScope)}>{AI_REVIEW_SCOPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Review lens</span><select value={lens} onChange={(event) => { setLens(event.target.value as AiReviewLens); setRequest(null); setResult(null); }}><option value="story-editor">Story editor</option>{AI_REVIEW_LENSES.filter((item) => item.id !== "story-editor").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className={styles.wideField}><span>Custom questions · one per line</span><textarea rows={3} value={questions} onChange={(event) => { setQuestions(event.target.value); setRequest(null); setResult(null); }} placeholder="What remains unclear to an audience reader?" /></label>
      </div>

      {targetChoices.length ? <fieldset className={styles.targetPicker}><legend>Stable review targets</legend>{targetChoices.map((target) => <label key={target.id}><input type={scope === "act" || scope === "sequence" || scope === "character-arc" ? "radio" : "checkbox"} checked={targetIds.includes(target.id)} onChange={() => toggleTarget(target.id)} /><span>{target.label}</span></label>)}</fieldset> : null}

      <div className={styles.actionRow}><button type="button" className={styles.primary} onClick={prepareReview}>Prepare review</button>{request ? <button type="button" onClick={() => navigator.clipboard?.writeText(`${request.instructions}\n\n${request.prompt}`)}>Copy prepared prompt</button> : null}</div>
      <p className={styles.statusMessage} data-state={state}>{message}</p>

      {request ? <>
        <ReviewNotice request={request} />
        <section className={styles.requestSummary}><strong>Prepared request</strong><span>{request.provider || "No provider"} · {request.model || "No model"}</span><span>{request.contextItems.length} targets · approximately {request.estimatedInputTokens.toLocaleString("en-CA")} input tokens</span><span>Prompt provenance: {request.promptHash}</span></section>
        <label className={styles.acknowledge}><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I reviewed the selected context, privacy notice and possible provider cost.</span></label>
        <button type="button" className={styles.primary} disabled={!provider.connected || !acknowledged || state === "working"} onClick={submitReview}>{state === "working" ? "Reviewing…" : provider.connected ? "Submit AI review" : "Connect a provider in Settings to submit"}</button>
      </> : null}

      {result ? <section className={styles.resultPanel}>
        <header><div><p>Structured result</p><h3>{result.projectSummary || "Review completed"}</h3></div><button type="button" onClick={saveAllFindings}>Save all under review</button></header>
        {result.recurringPatterns.length ? <div className={styles.patterns}><strong>Recurring patterns</strong>{result.recurringPatterns.map((pattern) => <span key={pattern}>{pattern}</span>)}</div> : null}
        {result.priorities.length ? <div className={styles.patterns}><strong>Priorities</strong>{result.priorities.map((priority) => <span key={priority}>{priority}</span>)}</div> : null}
        <div className={styles.findingList}>{result.findings.map((finding, index) => <article key={finding.id}>
          <header><div><span>{finding.target.label}</span><strong>{finding.title}</strong></div><i>{finding.priority}</i></header>
          <p>{finding.body}</p>
          {finding.evidence ? <blockquote>{finding.evidence}</blockquote> : null}
          {finding.proposedChange ? <div className={styles.proposed}><strong>Proposed change</strong><p>{finding.proposedChange}</p></div> : null}
          <div className={styles.decisionRow}><button type="button" onClick={() => saveFinding(index, "accept")}>Accept as feedback</button><button type="button" onClick={() => saveFinding(index, "defer")}>Defer</button><button type="button" onClick={() => saveFinding(index, "reject")}>Reject</button></div>
        </article>)}</div>
      </section> : null}

      {acceptedRecords.length ? <section className={styles.proposalPanel}><header><div><p>Accepted AI feedback</p><h3>Create an approval-gated revision proposal</h3></div></header>{acceptedRecords.map((record) => <button type="button" key={record.id} onClick={() => prepareProposal(record.id)}><strong>{record.title}</strong><span>{record.target.label}</span></button>)}</section> : null}

      {proposal ? <section className={styles.proposalDetail}><header><div><p>Revision proposal</p><h3>{proposal.title}</h3></div><b>{proposal.status}</b></header><p>{proposal.rationale}</p><div className={styles.proposed}><strong>Proposed change</strong><p>{proposal.proposedChange}</p></div><p>No story record changes until a later explicit revision operation applies an approved proposal.</p>{proposal.status === "proposed" ? <div className={styles.decisionRow}><button type="button" onClick={() => setProposal(approveRevisionProposal(proposal, "Project writer"))}>Approve proposal</button><button type="button" onClick={() => setProposal(rejectRevisionProposal(proposal))}>Reject proposal</button></div> : null}</section> : null}
    </section>
  );
}

function HumanReviewPanel({ project, onProjectChange }: Omit<ReviewWorkflowPanelProps, "mode">) {
  const targets = useMemo(() => feedbackTargetOptions(project), [project]);
  const model = useMemo(() => createStoredFeedbackModel(project), [project]);
  const [targetKey, setTargetKey] = useState("");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<FeedbackAuthorRole>("reviewer");
  const [organisation, setOrganisation] = useState("");
  const [contact, setContact] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [questions, setQuestions] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubNumber, setGithubNumber] = useState("");
  const [message, setMessage] = useState("Create a local review request. AI and GitHub connections are optional.");

  function submitRequest() {
    const target = targets.find((option) => `${option.kind}:${option.target.targetId}` === targetKey)?.target ?? targets[0]?.target;
    if (!target || !name.trim()) {
      setMessage("Choose a target and enter the reviewer’s name.");
      return;
    }
    const result = createHumanReviewRequest(project, {
      title,
      reviewer: { name, role, organisation, contact },
      target,
      questions: splitLines(questions),
      dueAt,
      githubProposalUrl: githubUrl,
      githubProposalNumber: githubNumber ? Number(githubNumber) : null,
    });
    onProjectChange(result.project);
    setTitle("");
    setQuestions("");
    setGithubUrl("");
    setGithubNumber("");
    setMessage(`Review request created for ${result.request.reviewer.name}. It is anchored to ${result.request.target.label}.`);
  }

  function exportSummary() {
    downloadText(`${project.metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plotpickle"}-review-summary.md`, exportReviewSummary(model.records, `${project.metadata.title} review summary`));
  }

  return (
    <section className={`${styles.workflowPanel} ${styles.humanPanel}`} aria-label="Human Review workflow">
      <header className={styles.workflowHeader}><div><p>Structured human review</p><h2>Request review from a named person and keep every response anchored to canon.</h2></div><button type="button" onClick={exportSummary}>Export review summary</button></header>
      <div className={styles.workflowGrid}>
        <label><span>Target</span><select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}><option value="">Project</option>{targets.map((option) => <option key={`${option.kind}:${option.target.targetId}`} value={`${option.kind}:${option.target.targetId}`}>{titleCase(option.kind)} · {option.target.label}</option>)}</select></label>
        <label><span>Request title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Director’s continuity review" /></label>
        <label><span>Reviewer name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label><span>Reviewer role</span><select value={role} onChange={(event) => setRole(event.target.value as FeedbackAuthorRole)}>{HUMAN_ROLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Organisation</span><input value={organisation} onChange={(event) => setOrganisation(event.target.value)} /></label>
        <label><span>Contact · optional</span><input value={contact} onChange={(event) => setContact(event.target.value)} /></label>
        <label><span>Requested due date</span><input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
        <label><span>GitHub proposal URL · optional</span><input type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/…/pull/…" /></label>
        <label><span>GitHub proposal number · optional</span><input inputMode="numeric" value={githubNumber} onChange={(event) => setGithubNumber(event.target.value.replace(/\D/g, ""))} /></label>
        <label className={styles.wideField}><span>Review questions · one per line</span><textarea rows={4} value={questions} onChange={(event) => setQuestions(event.target.value)} placeholder="Where does the scene intention become unclear?" /></label>
      </div>
      <div className={styles.actionRow}><button type="button" className={styles.primary} onClick={submitRequest}>Create human review request</button></div>
      <p className={styles.statusMessage}>{message}</p>
      <section className={styles.localBoundary}><strong>Local-first review</strong><p>Requests, responses, proposed changes, approvals and resolutions remain usable without an AI provider or GitHub connection. Optional GitHub links are references only.</p></section>
    </section>
  );
}

export default function ReviewWorkflowsPanel({ project, mode, onProjectChange }: ReviewWorkflowPanelProps) {
  return mode === "ai"
    ? <AiReviewPanel project={project} onProjectChange={onProjectChange} />
    : <HumanReviewPanel project={project} onProjectChange={onProjectChange} />;
}
