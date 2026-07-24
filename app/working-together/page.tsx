"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type PlotPickleProject,
  type ReviewAnchorKind,
  type ReviewThread,
} from "@/lib/project";
import {
  authorityActions,
  collaborationModels,
  collaborationReviewQuestions,
  collaborationRoles,
  contributionBriefTemplates,
  decisionOutcomes,
  feedbackCategories,
  type CollaborationModelId,
} from "../learning-working-together";
import styles from "./working-together.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const MARKER = "PLOTPICKLE_COLLABORATION_RECORD\n";

type Brief = {
  title: string;
  template: string;
  contributor: string;
  role: string;
  decisionMaker: string;
  targetKind: ReviewAnchorKind;
  targetId: string;
  targetLabel: string;
  problem: string;
  purpose: string;
  continuityLocks: string;
  mustNotChange: string;
  outputType: string;
  creativeFreedom: string;
  dueDate: string;
  reviewWindow: string;
  confidentiality: string;
  expectedCredit: string;
  compensation: string;
  ownership: string;
  agreementReference: string;
  licenceReference: string;
  acceptanceCriteria: string;
  relatedRecords: string;
};

type CollaborationRecord =
  | { kind: "model"; modelId: CollaborationModelId; owner: string; authority: string; privacy: string; confidentiality: string; response: string; unsolicited: string; licence: string; updatedAt: string }
  | ({ kind: "brief"; id: string; createdAt: string; status: string } & Brief)
  | { kind: "feedback"; id: string; category: string; title: string; body: string; author: string; targetKind: ReviewAnchorKind; targetId: string; targetLabel: string; createdAt: string }
  | { kind: "decision"; id: string; outcome: string; proposal: string; decisionMaker: string; summary: string; rationale: string; rightsUpdates: string; followUp: string; decisionDate: string };

const blankBrief: Brief = {
  title: "",
  template: contributionBriefTemplates[0],
  contributor: "",
  role: "Contributor",
  decisionMaker: "",
  targetKind: "project",
  targetId: "",
  targetLabel: "Whole project",
  problem: "",
  purpose: "",
  continuityLocks: "",
  mustNotChange: "",
  outputType: "Review notes",
  creativeFreedom: "Bounded by the brief",
  dueDate: "",
  reviewWindow: "",
  confidentiality: "Do not discuss publicly without permission.",
  expectedCredit: "",
  compensation: "",
  ownership: "No ownership is implied unless separately documented.",
  agreementReference: "",
  licenceReference: "",
  acceptanceCriteria: "",
  relatedRecords: "",
};

function id(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${globalThis.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function encode(record: CollaborationRecord) {
  return `${MARKER}${JSON.stringify(record)}`;
}

function decode(thread: ReviewThread): CollaborationRecord | null {
  const body = thread.comments[0]?.body ?? "";
  if (!body.startsWith(MARKER)) return null;
  try { return JSON.parse(body.slice(MARKER.length)) as CollaborationRecord; } catch { return null; }
}

function recordTitle(record: CollaborationRecord) {
  if (record.kind === "model") return "[Collaboration Model] Project operating agreement";
  if (record.kind === "brief") return `[Contribution Brief] ${record.title || "Untitled contribution"}`;
  if (record.kind === "feedback") return `[${record.category.toUpperCase()}] ${record.title || "Review note"}`;
  return `[Decision: ${record.outcome}] ${record.proposal || record.summary || "Proposal decision"}`;
}

function toThread(record: CollaborationRecord, anchor: ReviewThread["anchor"], author: string): ReviewThread {
  const now = new Date().toISOString();
  const resolved = record.kind === "model" || record.kind === "decision";
  return {
    id: record.kind === "model" ? "collaboration-model" : record.id,
    title: recordTitle(record),
    anchor,
    status: resolved ? "resolved" : "open",
    priority: record.kind === "feedback" && ["required", "continuity", "rights"].includes(record.category) ? "high" : "normal",
    comments: [{ id: id("comment"), author: author || "Project collaborator", body: encode(record), createdAt: now }],
    createdAt: now,
    updatedAt: now,
    resolvedAt: resolved ? now : "",
  };
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function WorkingTogetherPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [notice, setNotice] = useState("Loading the active PlotPickle project…");
  const [modelId, setModelId] = useState<CollaborationModelId>("solo-feedback");
  const [owner, setOwner] = useState("");
  const [authority, setAuthority] = useState("");
  const [privacy, setPrivacy] = useState("Private / local");
  const [confidentiality, setConfidentiality] = useState("Do not discuss publicly without permission.");
  const [response, setResponse] = useState("Response timing depends on project review capacity.");
  const [unsolicited, setUnsolicited] = useState("Unsolicited proposals are not accepted.");
  const [licence, setLicence] = useState("");
  const [brief, setBrief] = useState<Brief>(blankBrief);
  const [feedbackCategory, setFeedbackCategory] = useState<(typeof feedbackCategories)[number]>("craft");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackAuthor, setFeedbackAuthor] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<ReviewAnchorKind>("project");
  const [feedbackTargetId, setFeedbackTargetId] = useState("");
  const [feedbackTargetLabel, setFeedbackTargetLabel] = useState("Whole project");
  const [decisionOutcome, setDecisionOutcome] = useState<(typeof decisionOutcomes)[number]>("accepted");
  const [proposal, setProposal] = useState("");
  const [decisionMaker, setDecisionMaker] = useState("");
  const [decisionSummary, setDecisionSummary] = useState("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [rightsUpdates, setRightsUpdates] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [blockNumber, setBlockNumber] = useState(1);
  const [miniBlockNumber, setMiniBlockNumber] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) { setNotice("No saved project was found. A blank project is ready for collaboration planning."); return; }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) { setNotice("The saved project could not be upgraded. A blank project is shown instead."); return; }
        setProject(normalized);
        setOwner(normalized.rights.projectOwner);
        const model = normalized.review.threads.map(decode).find((item): item is Extract<CollaborationRecord, { kind: "model" }> => item?.kind === "model");
        if (model) {
          setModelId(model.modelId); setOwner(model.owner); setAuthority(model.authority); setPrivacy(model.privacy);
          setConfidentiality(model.confidentiality); setResponse(model.response); setUnsolicited(model.unsolicited); setLicence(model.licence);
        }
        setNotice("Connected to the active local PlotPickle project. Nothing is shared automatically.");
      } catch { setNotice("The saved project could not be opened. A blank project is shown instead."); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const records = useMemo(() => project.review.threads.map((thread) => ({ thread, record: decode(thread) })).filter((item): item is { thread: ReviewThread; record: CollaborationRecord } => Boolean(item.record)), [project.review.threads]);
  const selectedModel = collaborationModels.find((item) => item.id === modelId) ?? collaborationModels[0];
  const questions = collaborationReviewQuestions(blockNumber, miniBlockNumber);
  const welcomeCard = [
    project.metadata.title,
    `Project owner: ${owner || "Not recorded"}`,
    `Collaboration model: ${selectedModel.label}`,
    `Canon authority: ${authority || owner || "Not recorded"}`,
    `Privacy: ${privacy}`,
    `View/comment/proposal: ${selectedModel.view}; ${selectedModel.comment}; ${selectedModel.propose}`,
    `Decision process: ${selectedModel.approve}`,
    `Confidentiality: ${confidentiality}`,
    `Response expectation: ${response}`,
    `Unsolicited proposals: ${unsolicited}`,
    `Credit/ownership expectation: ${selectedModel.expectation}`,
    `Licence or agreement reference: ${licence || "No open licence or reuse permission is implied"}`,
    "Process: approved story → local work → bounded proposal → review → owner/maintainer decision → canon.",
  ].join("\n");

  function saveThreads(threads: ReviewThread[], message: string, revisions = project.revisions) {
    const now = new Date().toISOString();
    const next = { ...project, metadata: { ...project.metadata, updatedAt: now }, review: { ...project.review, threads }, revisions };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProject(next);
    setNotice(message);
  }

  function saveRecord(record: CollaborationRecord, anchor: ReviewThread["anchor"], author: string) {
    const thread = toThread(record, anchor, author);
    saveThreads([...project.review.threads.filter((item) => item.id !== thread.id), thread], "Collaboration record saved to the active project.");
  }

  function saveModel() {
    saveRecord({ kind: "model", modelId, owner, authority, privacy, confidentiality, response, unsolicited, licence, updatedAt: new Date().toISOString() }, { kind: "project", targetId: project.id, label: "Whole project" }, owner || "Project owner");
  }

  function createBrief() {
    const record: Extract<CollaborationRecord, { kind: "brief" }> = { kind: "brief", id: id("brief"), createdAt: new Date().toISOString(), status: "draft", ...brief };
    saveRecord(record, { kind: brief.targetKind, targetId: brief.targetId, label: brief.targetLabel }, brief.decisionMaker || owner || "Project owner");
    setBrief(blankBrief);
  }

  function createFeedback() {
    saveRecord({ kind: "feedback", id: id("feedback"), category: feedbackCategory, title: feedbackTitle, body: feedbackBody, author: feedbackAuthor, targetKind: feedbackKind, targetId: feedbackTargetId, targetLabel: feedbackTargetLabel, createdAt: new Date().toISOString() }, { kind: feedbackKind, targetId: feedbackTargetId, label: feedbackTargetLabel }, feedbackAuthor || "Reviewer");
    setFeedbackTitle(""); setFeedbackBody("");
  }

  function createDecision() {
    const now = new Date().toISOString();
    const record: Extract<CollaborationRecord, { kind: "decision" }> = { kind: "decision", id: id("decision"), outcome: decisionOutcome, proposal, decisionMaker, summary: decisionSummary, rationale: decisionRationale, rightsUpdates, followUp, decisionDate: now };
    const thread = toThread(record, { kind: "project", targetId: project.id, label: proposal || "Proposal decision" }, decisionMaker || owner || "Decision-maker");
    const revision = { id: id("revision"), label: `Collaboration decision: ${decisionOutcome}`, notes: `${proposal}\n${decisionSummary}\nRationale: ${decisionRationale}\nRights updates: ${rightsUpdates}\nFollow-up: ${followUp}`, createdAt: now, schemaVersion: "1.7.0" as const, contentHash: "", payload: { collaborationDecision: record } };
    saveThreads([...project.review.threads, thread], "Decision recorded in review threads and revision history.", [...project.revisions, revision]);
    setProposal(""); setDecisionSummary(""); setDecisionRationale(""); setRightsUpdates(""); setFollowUp("");
  }

  function addContributor(record: Extract<CollaborationRecord, { kind: "brief" }>) {
    if (!record.contributor.trim()) { setNotice("Add a contributor name before creating a Rights & Provenance record."); return; }
    const now = new Date().toISOString();
    const collaborator = { id: id("rights-collaborator"), name: record.contributor, role: record.role, contribution: `${record.title}. ${record.targetLabel}. Brief ${record.id}.`, ownershipShare: record.ownership, agreementReference: [record.agreementReference, record.licenceReference, record.compensation].filter(Boolean).join(" · "), creditedAs: record.expectedCredit || record.contributor, createdAt: now, updatedAt: now };
    const next = { ...project, metadata: { ...project.metadata, updatedAt: now }, rights: { ...project.rights, collaborators: [...project.rights.collaborators, collaborator] } };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setProject(next); setNotice("Contributor added to Rights & Provenance. Review the agreement before accepting work into canon.");
  }

  const briefRecords = records.filter((item): item is { thread: ReviewThread; record: Extract<CollaborationRecord, { kind: "brief" }> } => item.record.kind === "brief");
  const feedbackRecords = records.filter((item) => item.record.kind === "feedback");
  const decisionRecords = records.filter((item) => item.record.kind === "decision");

  return <main className={styles.page}>
    <header className={styles.hero}><div><span>Contributor onboarding and review handbook</span><h1>Working Together in PlotPickle</h1><p>Define the human agreement, create a welcome card and bounded brief, review changes in story language and record canon decisions without requiring GitHub, public access, AI or an open licence.</p></div><nav><Link href="/">Back to PlotPickle</Link><Link href="/read-learn">Read & Learn</Link><Link href="/pitch-review">Pitch & Review</Link></nav></header>
    <p className={styles.notice} aria-live="polite">{notice}</p>

    <section className={styles.panel}><header><span>1 · Collaboration model</span><h2>Define the operating agreement</h2><p>Access, repository permissions, collaboration status, ownership and creative licensing are separate decisions.</p></header>
      <div className={styles.formGrid}>
        <label>Model<select value={modelId} onChange={(event) => setModelId(event.target.value as CollaborationModelId)}>{collaborationModels.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label>Project owner<input value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
        <label>Delegated/shared canon authority<input value={authority} onChange={(event) => setAuthority(event.target.value)} /></label>
        <label>Privacy level<input value={privacy} onChange={(event) => setPrivacy(event.target.value)} /></label>
        <label>Response expectation<input value={response} onChange={(event) => setResponse(event.target.value)} /></label>
        <label>Unsolicited proposal policy<input value={unsolicited} onChange={(event) => setUnsolicited(event.target.value)} /></label>
        <label className={styles.wide}>Confidentiality<textarea value={confidentiality} onChange={(event) => setConfidentiality(event.target.value)} /></label>
        <label className={styles.wide}>Licence/agreement reference<input value={licence} onChange={(event) => setLicence(event.target.value)} placeholder="No open licence is implied when blank" /></label>
      </div><div className={styles.actions}><button type="button" onClick={saveModel}>Save operating agreement</button><button type="button" onClick={() => download(`${project.metadata.title}-collaborator-welcome.txt`, welcomeCard)}>Download welcome card</button></div><pre>{welcomeCard}</pre>
    </section>

    <section className={styles.panel}><header><span>2 · Roles and authority</span><h2>Creative authority is not repository permission</h2></header><div className={styles.roleGrid}>{collaborationRoles.map((item) => <article key={item.role}><strong>{item.role}</strong><p>{item.authority}</p></article>)}</div><div className={styles.chips}>{authorityActions.map((item) => <span key={item}>{item}</span>)}</div></section>

    <section className={styles.panel}><header><span>3 · Contribution brief</span><h2>Request bounded, reviewable work</h2></header>
      <div className={styles.formGrid}>
        <label>Template<select value={brief.template} onChange={(event) => setBrief({ ...brief, template: event.target.value })}>{contributionBriefTemplates.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Contribution title<input value={brief.title} onChange={(event) => setBrief({ ...brief, title: event.target.value })} /></label>
        <label>Contributor<input value={brief.contributor} onChange={(event) => setBrief({ ...brief, contributor: event.target.value })} /></label>
        <label>Role<input value={brief.role} onChange={(event) => setBrief({ ...brief, role: event.target.value })} /></label>
        <label>Decision-maker<input value={brief.decisionMaker} onChange={(event) => setBrief({ ...brief, decisionMaker: event.target.value })} /></label>
        <label>Target kind<select value={brief.targetKind} onChange={(event) => setBrief({ ...brief, targetKind: event.target.value as ReviewAnchorKind })}>{["project", "story-field", "block", "scene", "screenplay-element", "character"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Target ID<input value={brief.targetId} onChange={(event) => setBrief({ ...brief, targetId: event.target.value })} /></label>
        <label>Target label<input value={brief.targetLabel} onChange={(event) => setBrief({ ...brief, targetLabel: event.target.value })} /></label>
        {([ ["Problem to solve", "problem"], ["Story purpose and audience effect", "purpose"], ["Canon facts and continuity locks", "continuityLocks"], ["Elements that must not change", "mustNotChange"], ["Acceptance criteria", "acceptanceCriteria"], ["Related review threads, source records or proposals", "relatedRecords"] ] as const).map(([label, key]) => <label className={styles.wide} key={key}>{label}<textarea value={brief[key]} onChange={(event) => setBrief({ ...brief, [key]: event.target.value })} /></label>)}
        {([ ["Preferred output type", "outputType"], ["Creative freedom", "creativeFreedom"], ["Due date", "dueDate"], ["Review window", "reviewWindow"], ["Expected credit", "expectedCredit"], ["Compensation reference", "compensation"], ["Ownership expectation", "ownership"], ["Agreement reference", "agreementReference"], ["Licence reference", "licenceReference"] ] as const).map(([label, key]) => <label key={key}>{label}<input value={brief[key]} onChange={(event) => setBrief({ ...brief, [key]: event.target.value })} /></label>)}
        <label className={styles.wide}>Confidentiality<textarea value={brief.confidentiality} onChange={(event) => setBrief({ ...brief, confidentiality: event.target.value })} /></label>
      </div><div className={styles.actions}><button type="button" disabled={!brief.title.trim()} onClick={createBrief}>Create contribution brief</button></div>
    </section>

    <section className={styles.panel}><header><span>4 · Contributor dashboard</span><h2>Assigned briefs and recorded rights</h2></header><div className={styles.recordGrid}>{briefRecords.length ? briefRecords.map(({ record }) => <article key={record.id}><small>{record.status} · {record.template}</small><h3>{record.title}</h3><p>{record.contributor || "Unassigned"} · {record.targetLabel}</p><p>{record.problem}</p><button type="button" onClick={() => addContributor(record)}>Add to Rights & Provenance</button></article>) : <p>No briefs recorded yet.</p>}</div></section>

    <section className={styles.panel}><header><span>5 · Proposal review packet</span><h2>Understand the change before GitHub</h2></header><div className={styles.packet}><ul><li>What changed and why.</li><li>Audience/story effect.</li><li>Exact areas affected.</li><li>Before-and-after evidence.</li><li>Character, continuity, Story Thread, runtime, production and rights consequences.</li><li>New canon assumptions.</li><li>Unresolved questions and alternatives.</li><li>Source, permission and AI provenance.</li><li>Requested credit/agreement reference.</li><li>Areas to inspect closely.</li></ul><p>Start from the approved story, work locally and submit a bounded proposal. A stale base requires a new canonical pull and human story review.</p><Link href="/#settings">Open Settings → GitHub & Backups</Link></div></section>

    <section className={styles.panel}><header><span>6 · Anchored review</span><h2>Review the change, not the person</h2></header><div className={styles.formGrid}>
      <label>Category<select value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value as (typeof feedbackCategories)[number])}>{feedbackCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Reviewer<input value={feedbackAuthor} onChange={(event) => setFeedbackAuthor(event.target.value)} /></label>
      <label>Anchor kind<select value={feedbackKind} onChange={(event) => setFeedbackKind(event.target.value as ReviewAnchorKind)}>{["project", "story-field", "block", "scene", "screenplay-element", "character"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Target ID<input value={feedbackTargetId} onChange={(event) => setFeedbackTargetId(event.target.value)} /></label>
      <label>Target label<input value={feedbackTargetLabel} onChange={(event) => setFeedbackTargetLabel(event.target.value)} /></label>
      <label>Review title<input value={feedbackTitle} onChange={(event) => setFeedbackTitle(event.target.value)} /></label>
      <label className={styles.wide}>Evidence, reason and intended outcome<textarea value={feedbackBody} onChange={(event) => setFeedbackBody(event.target.value)} /></label>
    </div><div className={styles.actions}><button type="button" disabled={!feedbackBody.trim()} onClick={createFeedback}>Create anchored review thread</button></div><div className={styles.recordGrid}>{feedbackRecords.map(({ record, thread }) => <article key={thread.id}><small>{record.kind === "feedback" ? record.category : "feedback"} · {thread.status}</small><h3>{thread.title}</h3><p>{record.kind === "feedback" ? record.body : ""}</p></article>)}</div></section>

    <section className={styles.panel}><header><span>7 · Contextual review questions</span><h2>Optional lenses for Block {blockNumber}.{miniBlockNumber}</h2><p>These adapt to the active structure without imposing one fixed legacy Act model.</p></header><div className={styles.actions}><label>Block<select value={blockNumber} onChange={(event) => setBlockNumber(Number(event.target.value))}>{project.blocks.map((item) => <option value={item.number} key={item.id}>{item.number} · {item.title}</option>)}</select></label><label>Mini-block<select value={miniBlockNumber} onChange={(event) => setMiniBlockNumber(Number(event.target.value))}>{[1,2,3,4].map((item) => <option value={item} key={item}>{blockNumber}.{item}</option>)}</select></label></div><ol>{questions.map((item) => <li key={item}>{item}</li>)}</ol></section>

    <section className={styles.panel}><header><span>8 · Decision log</span><h2>Make the canon decision explicit</h2><p>Discussion, approval and canon are different states. Each decision also creates a revision-history snapshot.</p></header><div className={styles.formGrid}>
      <label>Outcome<select value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value as (typeof decisionOutcomes)[number])}>{decisionOutcomes.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Proposal/brief reference<input value={proposal} onChange={(event) => setProposal(event.target.value)} /></label>
      <label>Decision-maker<input value={decisionMaker} onChange={(event) => setDecisionMaker(event.target.value)} /></label>
      <label className={styles.wide}>Decision summary<textarea value={decisionSummary} onChange={(event) => setDecisionSummary(event.target.value)} /></label>
      <label className={styles.wide}>Rationale<textarea value={decisionRationale} onChange={(event) => setDecisionRationale(event.target.value)} /></label>
      <label className={styles.wide}>Credit, ownership, agreement or permission updates<textarea value={rightsUpdates} onChange={(event) => setRightsUpdates(event.target.value)} /></label>
      <label className={styles.wide}>Follow-up work<textarea value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label>
    </div><div className={styles.actions}><button type="button" disabled={!decisionSummary.trim()} onClick={createDecision}>Record canon decision</button></div><div className={styles.recordGrid}>{decisionRecords.map(({ record, thread }) => <article key={thread.id}><small>{record.kind === "decision" ? record.outcome : "decision"}</small><h3>{thread.title}</h3><p>{record.kind === "decision" ? record.rationale : ""}</p></article>)}</div></section>

    <footer className={styles.footer}><strong>Privacy boundary</strong><p>Local drafts, autosaves, AI prompts, credentials and private assets do not leave this computer merely because GitHub is connected. Only intentionally submitted proposal material is shared. A pull request is not a copyright transfer, employment agreement or open licence.</p></footer>
  </main>;
}
