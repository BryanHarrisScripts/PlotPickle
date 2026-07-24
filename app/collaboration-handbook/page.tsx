"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addRightsCollaborator,
  authorityActions,
  briefTemplates,
  buildProposalSummary,
  buildTargetOptions,
  buildWelcomeCardHtml,
  buildWelcomeCardMarkdown,
  collaborationModels,
  collaborationRoles,
  contextualCollaborationQuestions,
  createDefaultAuthorityRecord,
  createDefaultContributionBrief,
  createDefaultDecision,
  createDefaultProposalPacket,
  readCollaborationHandbook,
  recordCollaborationDecision,
  reviewCategories,
  reviewOutcomes,
  saveAuthorityRecord,
  saveCategorizedReviewNote,
  saveCollaborationAgreement,
  saveContributionBrief,
  saveProposalPacket,
  type AuthorityRecord,
  type CategorizedReviewNote,
  type CollaborationAgreement,
  type CollaborationAuthority,
  type CollaborationDecision,
  type CollaborationPrivacy,
  type CollaborationRoleId,
  type ContributionBrief,
  type DecisionOutcome,
  type ProposalReviewPacket,
  type ReviewCategory,
  type ReviewOutcome,
} from "@/lib/collaboration-handbook";
import { normalizePlotPickleProject, type PlotPickleProject, type ReviewAnchor, type RightsCollaborator } from "@/lib/project";
import { workingTogetherLessons } from "../learning-working-together";
import styles from "./collaboration-handbook.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const privacyOptions: Array<{ id: CollaborationPrivacy; label: string }> = [
  { id: "local-only", label: "Local only" },
  { id: "private-file-exchange", label: "Private file exchange" },
  { id: "private-repository", label: "Private repository" },
  { id: "public-repository", label: "Public repository" },
];
const decisionOutcomes: DecisionOutcome[] = ["merged", "declined", "deferred", "withdrawn", "superseded"];

function downloadText(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${globalThis.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function csv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function numbers(value: string) {
  return csv(value).map(Number).filter((item) => Number.isFinite(item) && item > 0);
}

export default function CollaborationHandbookPage() {
  const [project, setProject] = useState<PlotPickleProject | null>(null);
  const [notice, setNotice] = useState("Loading the active PlotPickle project…");
  const [agreement, setAgreement] = useState<CollaborationAgreement | null>(null);
  const [authority, setAuthority] = useState<AuthorityRecord | null>(null);
  const [brief, setBrief] = useState<ContributionBrief | null>(null);
  const [packet, setPacket] = useState<ProposalReviewPacket | null>(null);
  const [decision, setDecision] = useState<CollaborationDecision | null>(null);
  const [reviewNote, setReviewNote] = useState<CategorizedReviewNote | null>(null);
  const [selectedBriefId, setSelectedBriefId] = useState("");
  const [selectedPacketId, setSelectedPacketId] = useState("");
  const [selectedAuthorityId, setSelectedAuthorityId] = useState("");
  const [blockNumber, setBlockNumber] = useState(1);
  const [sceneId, setSceneId] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [lessonQuery, setLessonQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setNotice("No saved PlotPickle project was found. Open the main workspace and save or import a project first.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) throw new Error("invalid-project");
        const records = readCollaborationHandbook(normalized);
        setProject(normalized);
        setAgreement(records.agreement);
        setAuthority(records.authorities[0] ?? createDefaultAuthorityRecord(normalized.rights.collaborators[0]));
        setBrief(records.briefs[0] ?? createDefaultContributionBrief(normalized));
        setPacket(records.proposalPackets[0] ?? createDefaultProposalPacket(normalized, records.briefs[0]));
        setDecision(createDefaultDecision(normalized, records.proposalPackets[0]));
        setSelectedBriefId(records.briefs[0]?.id ?? "");
        setSelectedPacketId(records.proposalPackets[0]?.id ?? "");
        setSelectedAuthorityId(records.authorities[0]?.id ?? "");
        setCharacterId(normalized.characters[0]?.id ?? "");
        setSceneId(normalized.blocks[0]?.scenes[0]?.id ?? "");
        setNotice("The contributor handbook reads and writes canonical review, rights and revision records inside this project.");
      } catch {
        setNotice("The saved project could not be read. Return to PlotPickle and open a valid project.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const records = useMemo(() => project ? readCollaborationHandbook(project) : null, [project]);
  const targets = useMemo(() => project ? buildTargetOptions(project) : [], [project]);
  const block = project?.blocks.find((item) => item.number === blockNumber) ?? project?.blocks[0];
  const contextualQuestions = useMemo(() => project ? contextualCollaborationQuestions(project, blockNumber, sceneId, characterId) : [], [project, blockNumber, sceneId, characterId]);
  const filteredLessons = workingTogetherLessons.filter((lesson) => {
    const needle = lessonQuery.trim().toLowerCase();
    if (!needle) return true;
    return [lesson.title, lesson.overview, ...lesson.aliases, ...lesson.objectives].join(" ").toLowerCase().includes(needle);
  });

  function commit(next: PlotPickleProject, message: string) {
    const prepared = { ...next, metadata: { ...next.metadata, updatedAt: now() } };
    setProject(prepared);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prepared));
    setNotice(message);
  }

  function saveAgreement() {
    if (!project || !agreement) return;
    commit(saveCollaborationAgreement(project, agreement), "Collaboration operating agreement saved as an anchored canonical review record.");
  }

  function selectCollaborator(collaboratorId: string) {
    if (!project) return;
    const collaborator = project.rights.collaborators.find((item) => item.id === collaboratorId);
    if (!collaborator) return;
    const existing = records?.authorities.find((item) => item.collaboratorId === collaboratorId);
    setAuthority(existing ?? createDefaultAuthorityRecord(collaborator));
    setSelectedAuthorityId(existing?.id ?? `authority-${collaborator.id}`);
  }

  function saveCollaboratorAndAuthority() {
    if (!project || !authority) return;
    const existing = project.rights.collaborators.find((item) => item.id === authority.collaboratorId);
    const collaborator: Partial<RightsCollaborator> = {
      id: authority.collaboratorId || undefined,
      name: authority.collaboratorName,
      creditedAs: existing?.creditedAs || authority.collaboratorName,
      role: collaborationRoles.find((item) => item.id === authority.role)?.label || authority.role,
      contribution: authority.scope,
      ownershipShare: existing?.ownershipShare || "No ownership recorded",
      agreementReference: authority.agreementReference,
      createdAt: existing?.createdAt,
    };
    const withCollaborator = addRightsCollaborator(project, collaborator);
    const savedCollaborator = withCollaborator.rights.collaborators.find((item) => item.id === collaborator.id)
      ?? withCollaborator.rights.collaborators.at(-1);
    if (!savedCollaborator) return;
    const nextAuthority = { ...authority, id: authority.id || `authority-${savedCollaborator.id}`, collaboratorId: savedCollaborator.id, collaboratorName: savedCollaborator.name };
    commit(saveAuthorityRecord(withCollaborator, nextAuthority), "Contributor rights and creative authority records saved separately inside the project.");
    setAuthority(nextAuthority);
    setSelectedAuthorityId(nextAuthority.id);
  }

  function addCollaborator() {
    if (!project) return;
    const next = createDefaultAuthorityRecord();
    setAuthority(next);
    setSelectedAuthorityId(next.id);
  }

  function toggleAuthority(action: CollaborationAuthority) {
    if (!authority) return;
    setAuthority({ ...authority, authority: authority.authority.includes(action) ? authority.authority.filter((item) => item !== action) : [...authority.authority, action] });
  }

  function chooseBrief(value: string) {
    if (!project) return;
    const existing = records?.briefs.find((item) => item.id === value);
    setSelectedBriefId(value);
    setBrief(existing ?? createDefaultContributionBrief(project));
  }

  function chooseTarget(value: string) {
    if (!brief) return;
    const target = targets.find((item) => item.value === value);
    if (!target) return;
    setBrief({ ...brief, targetKind: target.kind, targetId: target.targetId, targetLabel: target.label });
  }

  function saveBrief() {
    if (!project || !brief) return;
    commit(saveContributionBrief(project, brief), "Contribution brief saved as a canonical anchored record.");
    setSelectedBriefId(brief.id);
  }

  function newBrief() {
    if (!project) return;
    const next = createDefaultContributionBrief(project);
    setBrief(next);
    setSelectedBriefId(next.id);
  }

  function choosePacket(value: string) {
    if (!project) return;
    const existing = records?.proposalPackets.find((item) => item.id === value);
    const linkedBrief = records?.briefs.find((item) => item.id === selectedBriefId);
    setSelectedPacketId(value);
    setPacket(existing ?? createDefaultProposalPacket(project, linkedBrief));
  }

  function savePacket() {
    if (!project || !packet) return;
    commit(saveProposalPacket(project, packet), "Proposal review packet saved. Its structured summary can now accompany the GitHub proposal.");
    setSelectedPacketId(packet.id);
  }

  function newPacket() {
    if (!project) return;
    const linkedBrief = records?.briefs.find((item) => item.id === selectedBriefId);
    const next = createDefaultProposalPacket(project, linkedBrief);
    setPacket(next);
    setSelectedPacketId(next.id);
  }

  function copyPacketSummary() {
    if (!packet) return;
    void navigator.clipboard?.writeText(buildProposalSummary(packet));
    setNotice("Proposal packet summary copied for the GitHub contributor note.");
  }

  function createReviewNote() {
    if (!project || !reviewNote) return;
    commit(saveCategorizedReviewNote(project, reviewNote), "Categorized review note saved and anchored to the selected canonical project element.");
  }

  function newReviewNote() {
    if (!project) return;
    const anchor: ReviewAnchor = targets.find((item) => item.value === `block:${block?.id}`) ?? { kind: "project", targetId: project.id, label: "Whole project" };
    setReviewNote({ id: makeId("categorized-review"), category: "craft", outcome: "open", title: "New collaboration review note", author: agreement?.ownerName || "Reviewer", anchor, observation: "", evidence: "", intendedOutcome: "", createdAt: now(), updatedAt: now() });
  }

  function saveDecision() {
    if (!project || !decision) return;
    const next = recordCollaborationDecision(project, decision);
    commit(next, "Decision recorded with rationale and a canonical revision snapshot.");
    setDecision(createDefaultDecision(next, records?.proposalPackets.find((item) => item.id === selectedPacketId)));
  }

  function welcomeMarkdown() {
    if (!project || !agreement) return "";
    const selectedAuthority = records?.authorities.find((item) => item.id === selectedAuthorityId) ?? authority ?? undefined;
    const selectedBrief = records?.briefs.find((item) => item.id === selectedBriefId) ?? brief ?? undefined;
    return buildWelcomeCardMarkdown(project, agreement, selectedAuthority, selectedBrief);
  }

  if (!project || !agreement || !authority || !brief || !packet || !decision) {
    return <main className={styles.empty}><h1>Working Together in PlotPickle</h1><p>{notice}</p><Link href="/">Return to PlotPickle</Link></main>;
  }

  const openThreads = project.review.threads.filter((thread) => thread.status === "open" || thread.status === "in-review");
  const rightsGaps = project.rights.collaborators.filter((item) => !item.agreementReference || !item.creditedAs);
  const selectedTargetValue = targets.find((item) => item.kind === brief.targetKind && item.targetId === brief.targetId)?.value ?? `project:${project.id}`;

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span>Read & Learn · Contributor operations</span><h1>Working Together in PlotPickle</h1><p>Choose the relationship, define authority, brief the work, review the change and record the canon decision. GitHub remains optional and technical; the human agreement comes first.</p></div>
      <div className={styles.heroActions}><Link href="/">Story Planner</Link><Link href="/pitch-review">Pitch & Review</Link><Link href="/#settings">Settings & Backups</Link></div>
    </header>

    <div className={styles.notice} role="status">{notice}</div>

    <nav className={styles.jumpNav} aria-label="Contributor handbook sections">
      <a href="#dashboard">Dashboard</a><a href="#agreement">Agreement</a><a href="#roles">Roles</a><a href="#briefs">Briefs</a><a href="#workflow">Workflow</a><a href="#proposals">Proposals</a><a href="#reviews">Reviews</a><a href="#decisions">Decisions</a><a href="#learning">Read & Learn</a>
    </nav>

    <section className={styles.dashboard} id="dashboard">
      <article><strong>{records?.authorities.length ?? 0}</strong><span>authority records</span></article>
      <article><strong>{records?.briefs.length ?? 0}</strong><span>contribution briefs</span></article>
      <article><strong>{records?.proposalPackets.length ?? 0}</strong><span>proposal packets</span></article>
      <article><strong>{openThreads.length}</strong><span>open review records</span></article>
      <article><strong>{records?.decisions.length ?? 0}</strong><span>recorded decisions</span></article>
      <article className={rightsGaps.length ? styles.warning : ""}><strong>{rightsGaps.length}</strong><span>rights record gaps</span></article>
    </section>

    <section className={styles.section} id="agreement">
      <header><span>1 · Operating agreement</span><h2>Choose the collaboration model</h2><p>Invitation, repository access, credit, ownership, compensation and licensing are separate decisions.</p></header>
      <div className={styles.modelGrid}>{collaborationModels.map((model) => <button type="button" className={agreement.model === model.id ? styles.selectedCard : styles.cardButton} onClick={() => setAgreement({ ...agreement, model: model.id, privacy: model.defaultPrivacy })} key={model.id}><strong>{model.label}</strong><p>{model.summary}</p><small>{model.ownershipNote}</small></button>)}</div>
      <div className={styles.formGrid}>
        <label>Project owner<input value={agreement.ownerName} onChange={(event) => setAgreement({ ...agreement, ownerName: event.target.value })} /></label>
        <label>Final canon authority<input value={agreement.canonicalAuthority} onChange={(event) => setAgreement({ ...agreement, canonicalAuthority: event.target.value })} /></label>
        <label>Privacy and sharing<select value={agreement.privacy} onChange={(event) => setAgreement({ ...agreement, privacy: event.target.value as CollaborationPrivacy })}>{privacyOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label>Reuse licence<input value={agreement.reuseLicence} onChange={(event) => setAgreement({ ...agreement, reuseLicence: event.target.value })} /></label>
        <label className={styles.wide}>Review response expectation<textarea value={agreement.responseExpectation} onChange={(event) => setAgreement({ ...agreement, responseExpectation: event.target.value })} /></label>
        <label className={styles.wide}>Confidentiality and external sharing<textarea value={agreement.confidentiality} onChange={(event) => setAgreement({ ...agreement, confidentiality: event.target.value })} /></label>
        <label className={styles.wide}>Credit expectation<textarea value={agreement.creditExpectation} onChange={(event) => setAgreement({ ...agreement, creditExpectation: event.target.value })} /></label>
        <label className={styles.wide}>Compensation expectation<textarea value={agreement.compensationExpectation} onChange={(event) => setAgreement({ ...agreement, compensationExpectation: event.target.value })} /></label>
        <label className={styles.wide}>Notes<textarea value={agreement.notes} onChange={(event) => setAgreement({ ...agreement, notes: event.target.value })} /></label>
        <label className={styles.check}><input type="checkbox" checked={agreement.unsolicitedProposals} onChange={(event) => setAgreement({ ...agreement, unsolicitedProposals: event.target.checked })} />Unsolicited proposals are accepted</label>
      </div>
      <button className={styles.primary} type="button" onClick={saveAgreement}>Save operating agreement</button>
    </section>

    <section className={styles.section} id="roles">
      <header><span>2 · Role and authority</span><h2>Creative authority is not the same as repository access</h2><p>Rights collaborators record contribution, credit, ownership and agreement references. Authority records separately define what each person may decide.</p></header>
      <div className={styles.split}>
        <aside className={styles.recordList}><button type="button" onClick={addCollaborator}>Add collaborator</button>{project.rights.collaborators.map((item) => <button type="button" className={authority.collaboratorId === item.id ? styles.activeRecord : ""} key={item.id} onClick={() => selectCollaborator(item.id)}><strong>{item.name}</strong><span>{item.role}</span><small>{item.agreementReference || "No agreement reference"}</small></button>)}</aside>
        <div>
          <div className={styles.formGrid}>
            <label>Name<input value={authority.collaboratorName} onChange={(event) => setAuthority({ ...authority, collaboratorName: event.target.value })} /></label>
            <label>Creative role<select value={authority.role} onChange={(event) => { const role = event.target.value as CollaborationRoleId; setAuthority({ ...authority, role, authority: collaborationRoles.find((item) => item.id === role)?.defaultAuthority ?? authority.authority }); }}>{collaborationRoles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
            <label className={styles.wide}>Contribution scope<textarea value={authority.scope} onChange={(event) => setAuthority({ ...authority, scope: event.target.value })} /></label>
            <label>Delegated by<input value={authority.delegatedBy} onChange={(event) => setAuthority({ ...authority, delegatedBy: event.target.value })} /></label>
            <label>Agreement reference<input value={authority.agreementReference} onChange={(event) => setAuthority({ ...authority, agreementReference: event.target.value })} /></label>
            <label className={styles.check}><input type="checkbox" checked={authority.active} onChange={(event) => setAuthority({ ...authority, active: event.target.checked })} />Authority is active</label>
          </div>
          <div className={styles.authorityGrid}>{authorityActions.map((action) => <label key={action.id}><input type="checkbox" checked={authority.authority.includes(action.id)} onChange={() => toggleAuthority(action.id)} />{action.label}</label>)}</div>
          <button className={styles.primary} type="button" onClick={saveCollaboratorAndAuthority}>Save rights and authority records</button>
        </div>
      </div>

      <div className={styles.welcomeCard}>
        <div><span>Shareable onboarding card</span><h3>Welcome card for the selected contributor and brief</h3><p>Generated from the saved project agreement, authority and contribution brief. It does not itself grant access, ownership or a licence.</p></div>
        <pre>{welcomeMarkdown()}</pre>
        <div className={styles.actions}><button type="button" onClick={() => downloadText(`${project.metadata.title}-contributor-welcome.md`, welcomeMarkdown(), "text/markdown")}>Download Markdown</button><button type="button" onClick={() => downloadText(`${project.metadata.title}-contributor-welcome.html`, buildWelcomeCardHtml(project, agreement, authority, records?.briefs.find((item) => item.id === selectedBriefId) ?? brief), "text/html")}>Download HTML</button><button type="button" onClick={() => void navigator.clipboard?.writeText(welcomeMarkdown())}>Copy welcome card</button></div>
      </div>
    </section>

    <section className={styles.section} id="briefs">
      <header><span>3 · Contribution brief</span><h2>Ask for bounded work</h2><p>Every requested contribution starts with a problem, target, purpose, canon locks, freedom level and acceptance criteria.</p></header>
      <div className={styles.toolbar}><select value={selectedBriefId} onChange={(event) => chooseBrief(event.target.value)}><option value="">New or unsaved brief</option>{records?.briefs.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}</select><button type="button" onClick={newBrief}>New brief</button></div>
      <div className={styles.formGrid}>
        <label>Brief title<input value={brief.title} onChange={(event) => setBrief({ ...brief, title: event.target.value })} /></label>
        <label>Template<select value={brief.template} onChange={(event) => setBrief({ ...brief, template: event.target.value })}>{briefTemplates.map((template) => <option key={template}>{template}</option>)}</select></label>
        <label>Contributor<select value={brief.contributorId} onChange={(event) => { const contributor = project.rights.collaborators.find((item) => item.id === event.target.value); setBrief({ ...brief, contributorId: event.target.value, contributorName: contributor?.name ?? "" }); }}><option value="">Unassigned</option>{project.rights.collaborators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Requested role<select value={brief.requestedRole} onChange={(event) => setBrief({ ...brief, requestedRole: event.target.value as CollaborationRoleId })}>{collaborationRoles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
        <label>Decision-maker<input value={brief.decisionMaker} onChange={(event) => setBrief({ ...brief, decisionMaker: event.target.value })} /></label>
        <label>Status<select value={brief.status} onChange={(event) => setBrief({ ...brief, status: event.target.value as ContributionBrief["status"] })}>{["draft", "assigned", "in-progress", "submitted", "accepted", "closed"].map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className={styles.wide}>Target<select value={selectedTargetValue} onChange={(event) => chooseTarget(event.target.value)}>{targets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}</select></label>
        <label className={styles.wide}>Problem or question<textarea value={brief.problem} onChange={(event) => setBrief({ ...brief, problem: event.target.value })} /></label>
        <label className={styles.wide}>Story purpose and audience effect<textarea value={brief.storyPurpose} onChange={(event) => setBrief({ ...brief, storyPurpose: event.target.value })} /></label>
        <label className={styles.wide}>Canon facts and continuity locks<textarea value={brief.canonLocks} onChange={(event) => setBrief({ ...brief, canonLocks: event.target.value })} /></label>
        <label className={styles.wide}>Elements that must not change<textarea value={brief.mustNotChange} onChange={(event) => setBrief({ ...brief, mustNotChange: event.target.value })} /></label>
        <label>Preferred output<input value={brief.preferredOutput} onChange={(event) => setBrief({ ...brief, preferredOutput: event.target.value })} /></label>
        <label>Creative freedom<select value={brief.creativeFreedom} onChange={(event) => setBrief({ ...brief, creativeFreedom: event.target.value as ContributionBrief["creativeFreedom"] })}><option value="exact">Exact</option><option value="bounded">Bounded</option><option value="exploratory">Exploratory</option></select></label>
        <label>Due date<input type="date" value={brief.dueDate} onChange={(event) => setBrief({ ...brief, dueDate: event.target.value })} /></label>
        <label>Review window<input value={brief.reviewWindow} onChange={(event) => setBrief({ ...brief, reviewWindow: event.target.value })} /></label>
        <label>Privacy<select value={brief.privacy} onChange={(event) => setBrief({ ...brief, privacy: event.target.value as CollaborationPrivacy })}>{privacyOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label>Credit expectation<input value={brief.creditExpectation} onChange={(event) => setBrief({ ...brief, creditExpectation: event.target.value })} /></label>
        <label>Compensation reference<input value={brief.compensationReference} onChange={(event) => setBrief({ ...brief, compensationReference: event.target.value })} /></label>
        <label>Ownership reference<input value={brief.ownershipReference} onChange={(event) => setBrief({ ...brief, ownershipReference: event.target.value })} /></label>
        <label>Licence / permission reference<input value={brief.licenceReference} onChange={(event) => setBrief({ ...brief, licenceReference: event.target.value })} /></label>
        <label className={styles.wide}>Acceptance criteria<textarea value={brief.acceptanceCriteria} onChange={(event) => setBrief({ ...brief, acceptanceCriteria: event.target.value })} /></label>
        <label>Related review thread IDs<input value={brief.relatedReviewThreadIds.join(", ")} onChange={(event) => setBrief({ ...brief, relatedReviewThreadIds: csv(event.target.value) })} /></label>
        <label>Previous proposal numbers<input value={brief.previousProposalNumbers.join(", ")} onChange={(event) => setBrief({ ...brief, previousProposalNumbers: numbers(event.target.value) })} /></label>
      </div>
      <button className={styles.primary} type="button" onClick={saveBrief}>Save contribution brief</button>
    </section>

    <section className={styles.section} id="workflow">
      <header><span>4 · Approved story workflow</span><h2>Approved story → local draft → proposal → review → decision → canon</h2><p>GitHub is optional. The same creative sequence works with local-only projects or deliberate `.ppf` file exchange.</p></header>
      <div className={styles.flow}><article><b>1</b><strong>Pull or receive approved story</strong><span>Start from a known canonical base.</span></article><i>→</i><article><b>2</b><strong>Compare and apply</strong><span>Nothing replaces the active project automatically.</span></article><i>→</i><article><b>3</b><strong>Work locally</strong><span>Autosaves, prompts and drafts remain private.</span></article><i>→</i><article><b>4</b><strong>Submit bounded proposal</strong><span>Attach the brief and proposal packet.</span></article><i>→</i><article><b>5</b><strong>Owner decides</strong><span>Merge, decline, defer, withdraw or supersede with rationale.</span></article></div>
      <div className={styles.baseState}><span>Current canonical base</span><code>{project.collaboration.lastPulledCommit || "No GitHub base recorded — use the current approved local or exchanged .ppf revision"}</code></div>
      <p className={styles.safety}>A stale proposal must be reconsidered against the newly approved story. PlotPickle does not pretend two complete creative versions can always be mechanically merged.</p>
    </section>

    <section className={styles.section} id="proposals">
      <header><span>5 · Proposal review packet</span><h2>Explain the change before opening GitHub</h2><p>The packet makes purpose, scope, dependencies, rights and unresolved questions understandable inside PlotPickle.</p></header>
      <div className={styles.toolbar}><select value={selectedPacketId} onChange={(event) => choosePacket(event.target.value)}><option value="">New or unsaved packet</option>{records?.proposalPackets.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}</select><button type="button" onClick={newPacket}>New packet</button></div>
      <div className={styles.formGrid}>
        <label>Packet title<input value={packet.title} onChange={(event) => setPacket({ ...packet, title: event.target.value })} /></label>
        <label>Linked brief<select value={packet.briefId} onChange={(event) => setPacket({ ...packet, briefId: event.target.value })}><option value="">No brief linked</option>{records?.briefs.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>Contributor<input value={packet.contributorName} onChange={(event) => setPacket({ ...packet, contributorName: event.target.value })} /></label>
        <label>Status<select value={packet.status} onChange={(event) => setPacket({ ...packet, status: event.target.value as ProposalReviewPacket["status"] })}>{["draft", "ready", "submitted", "changes-requested", "approved", "declined", "superseded", "withdrawn"].map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className={styles.wide}>What changed<textarea value={packet.changed} onChange={(event) => setPacket({ ...packet, changed: event.target.value })} /></label>
        <label className={styles.wide}>Why it changed<textarea value={packet.reason} onChange={(event) => setPacket({ ...packet, reason: event.target.value })} /></label>
        <label className={styles.wide}>Intended audience or story effect<textarea value={packet.audienceEffect} onChange={(event) => setPacket({ ...packet, audienceEffect: event.target.value })} /></label>
        <label className={styles.wide}>Affected areas, comma-separated<input value={packet.affectedAreas.join(", ")} onChange={(event) => setPacket({ ...packet, affectedAreas: csv(event.target.value) })} /></label>
        <label className={styles.wide}>Important before-and-after evidence<textarea value={packet.beforeAfterEvidence} onChange={(event) => setPacket({ ...packet, beforeAfterEvidence: event.target.value })} /></label>
        <label className={styles.wide}>Dependencies<textarea value={packet.dependencies} onChange={(event) => setPacket({ ...packet, dependencies: event.target.value })} /></label>
        <label className={styles.wide}>Character effects<textarea value={packet.characterEffects} onChange={(event) => setPacket({ ...packet, characterEffects: event.target.value })} /></label>
        <label className={styles.wide}>Continuity effects<textarea value={packet.continuityEffects} onChange={(event) => setPacket({ ...packet, continuityEffects: event.target.value })} /></label>
        <label className={styles.wide}>Runtime or production effects<textarea value={packet.runtimeProductionEffects} onChange={(event) => setPacket({ ...packet, runtimeProductionEffects: event.target.value })} /></label>
        <label className={styles.wide}>Rights and provenance effects<textarea value={packet.rightsEffects} onChange={(event) => setPacket({ ...packet, rightsEffects: event.target.value })} /></label>
        <label className={styles.wide}>New facts or canon assumptions<textarea value={packet.newCanonAssumptions} onChange={(event) => setPacket({ ...packet, newCanonAssumptions: event.target.value })} /></label>
        <label className={styles.wide}>Unresolved questions<textarea value={packet.unresolvedQuestions} onChange={(event) => setPacket({ ...packet, unresolvedQuestions: event.target.value })} /></label>
        <label className={styles.wide}>Alternatives considered<textarea value={packet.alternativesConsidered} onChange={(event) => setPacket({ ...packet, alternativesConsidered: event.target.value })} /></label>
        <label>Requested credit<input value={packet.requestedCredit} onChange={(event) => setPacket({ ...packet, requestedCredit: event.target.value })} /></label>
        <label>Pull request number<input type="number" min="1" value={packet.pullRequestNumber ?? ""} onChange={(event) => setPacket({ ...packet, pullRequestNumber: event.target.value ? Number(event.target.value) : null })} /></label>
        <label className={styles.wide}>Areas the owner should inspect closely<textarea value={packet.inspectClosely} onChange={(event) => setPacket({ ...packet, inspectClosely: event.target.value })} /></label>
      </div>
      <div className={styles.actions}><button className={styles.primary} type="button" onClick={savePacket}>Save proposal packet</button><button type="button" onClick={copyPacketSummary}>Copy GitHub contributor note</button></div>
      <pre className={styles.packetPreview}>{buildProposalSummary(packet)}</pre>
    </section>

    <section className={styles.section} id="reviews">
      <header><span>6 · Review the change</span><h2>Category, anchor, evidence and intended outcome</h2><p>Report the reader experience or factual conflict before prescribing a fix. Review the change—not the person.</p></header>
      <div className={styles.contextControls}>
        <label>Block<select value={blockNumber} onChange={(event) => { const nextNumber = Number(event.target.value); setBlockNumber(nextNumber); setSceneId(project.blocks[nextNumber - 1]?.scenes[0]?.id ?? ""); }}>{project.blocks.map((item) => <option key={item.id} value={item.number}>Block {item.number} · {item.title}</option>)}</select></label>
        <label>Scene<select value={sceneId} onChange={(event) => setSceneId(event.target.value)}>{block?.scenes.map((scene) => <option key={scene.id} value={scene.id}>Scene {scene.number} · {scene.title}</option>)}</select></label>
        <label>Character<select value={characterId} onChange={(event) => setCharacterId(event.target.value)}><option value="">No character focus</option>{project.characters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <ol className={styles.questionList}>{contextualQuestions.map((question) => <li key={question}>{question}</li>)}</ol>
      {!reviewNote ? <button type="button" className={styles.primary} onClick={newReviewNote}>Create categorized review note</button> : <div className={styles.formGrid}>
        <label>Category<select value={reviewNote.category} onChange={(event) => setReviewNote({ ...reviewNote, category: event.target.value as ReviewCategory })}>{reviewCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Outcome<select value={reviewNote.outcome} onChange={(event) => setReviewNote({ ...reviewNote, outcome: event.target.value as ReviewOutcome | "open" })}><option value="open">Open</option>{reviewOutcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}</select></label>
        <label>Reviewer<input value={reviewNote.author} onChange={(event) => setReviewNote({ ...reviewNote, author: event.target.value })} /></label>
        <label>Title<input value={reviewNote.title} onChange={(event) => setReviewNote({ ...reviewNote, title: event.target.value })} /></label>
        <label className={styles.wide}>Anchor<select value={targets.find((item) => item.kind === reviewNote.anchor.kind && item.targetId === reviewNote.anchor.targetId)?.value ?? `project:${project.id}`} onChange={(event) => { const target = targets.find((item) => item.value === event.target.value); if (target) setReviewNote({ ...reviewNote, anchor: { kind: target.kind, targetId: target.targetId, label: target.label } }); }}>{targets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}</select></label>
        <label className={styles.wide}>Observation or audience experience<textarea value={reviewNote.observation} onChange={(event) => setReviewNote({ ...reviewNote, observation: event.target.value })} /></label>
        <label className={styles.wide}>Specific evidence<textarea value={reviewNote.evidence} onChange={(event) => setReviewNote({ ...reviewNote, evidence: event.target.value })} /></label>
        <label className={styles.wide}>Intended outcome<textarea value={reviewNote.intendedOutcome} onChange={(event) => setReviewNote({ ...reviewNote, intendedOutcome: event.target.value })} /></label>
        <div className={styles.actions}><button type="button" onClick={() => setReviewNote(null)}>Cancel</button><button type="button" className={styles.primary} onClick={createReviewNote}>Save anchored review note</button></div>
      </div>}
      <div className={styles.reviewGrid}>{records?.reviewNotes.map((note) => <article key={note.id}><span>{note.category} · {note.outcome}</span><h3>{note.title}</h3><strong>{note.anchor.label}</strong><p>{note.observation}</p><small>{note.evidence}</small></article>)}</div>
    </section>

    <section className={styles.section} id="decisions">
      <header><span>7 · Canon decision</span><h2>Merge, decline, defer, withdraw or supersede with a reason</h2><p>Discussion and approval are not canon. Record the authorized decision and capture a revision snapshot.</p></header>
      <div className={styles.formGrid}>
        <label>Proposal packet<select value={decision.proposalPacketId} onChange={(event) => { const selected = records?.proposalPackets.find((item) => item.id === event.target.value); setDecision({ ...decision, proposalPacketId: event.target.value, pullRequestNumber: selected?.pullRequestNumber ?? null, summary: selected?.title ?? decision.summary }); }}><option value="">No packet selected</option>{records?.proposalPackets.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>Outcome<select value={decision.outcome} onChange={(event) => setDecision({ ...decision, outcome: event.target.value as DecisionOutcome })}>{decisionOutcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}</select></label>
        <label>Decision-maker<input value={decision.decisionMaker} onChange={(event) => setDecision({ ...decision, decisionMaker: event.target.value })} /></label>
        <label>Pull request number<input type="number" min="1" value={decision.pullRequestNumber ?? ""} onChange={(event) => setDecision({ ...decision, pullRequestNumber: event.target.value ? Number(event.target.value) : null })} /></label>
        <label className={styles.wide}>Decision summary<input value={decision.summary} onChange={(event) => setDecision({ ...decision, summary: event.target.value })} /></label>
        <label className={styles.wide}>Rationale<textarea value={decision.rationale} onChange={(event) => setDecision({ ...decision, rationale: event.target.value })} /></label>
        <label className={styles.wide}>Accepted portions<textarea value={decision.acceptedParts} onChange={(event) => setDecision({ ...decision, acceptedParts: event.target.value })} /></label>
        <label className={styles.wide}>Declined portions<textarea value={decision.declinedParts} onChange={(event) => setDecision({ ...decision, declinedParts: event.target.value })} /></label>
        <label>Resolved review thread IDs<input value={decision.resolvedReviewThreadIds.join(", ")} onChange={(event) => setDecision({ ...decision, resolvedReviewThreadIds: csv(event.target.value) })} /></label>
        <label>Deferred review thread IDs<input value={decision.deferredReviewThreadIds.join(", ")} onChange={(event) => setDecision({ ...decision, deferredReviewThreadIds: csv(event.target.value) })} /></label>
        <label className={styles.wide}>Follow-up work<textarea value={decision.followUp} onChange={(event) => setDecision({ ...decision, followUp: event.target.value })} /></label>
        <label className={styles.check}><input type="checkbox" checked={decision.rightsUpdated} onChange={(event) => setDecision({ ...decision, rightsUpdated: event.target.checked })} />Contributor credit and rights records have been reviewed</label>
      </div>
      <button className={styles.primary} type="button" onClick={saveDecision}>Record decision and snapshot</button>
      <div className={styles.decisionList}>{records?.decisions.map((item) => <article key={item.id}><span>{item.outcome} · {new Date(item.decidedAt).toLocaleString()}</span><h3>{item.summary}</h3><p>{item.rationale}</p><small>{item.decisionMaker} · Snapshot {item.revisionSnapshotId || "not recorded"}</small></article>)}</div>
    </section>

    <section className={styles.section} id="learning">
      <header><span>Complete handbook</span><h2>11 PlotPickled lessons</h2><p>The legacy Afterglow-specific guide becomes a reusable operating handbook for private, commissioned, co-written, production, public-feedback and openly licensed projects.</p></header>
      <input className={styles.search} type="search" value={lessonQuery} onChange={(event) => setLessonQuery(event.target.value)} placeholder="Search Your Role, post-submission, feedback, privacy, rights, scale…" />
      <div className={styles.lessonGrid}>{filteredLessons.map((lesson) => <article key={lesson.id}><span>Lesson {lesson.number} · {lesson.duration}</span><h3>{lesson.title}</h3><p>{lesson.overview}</p><details><summary>Read lesson</summary>{lesson.sections.map((section) => <section key={section.heading}><h4>{section.heading}</h4>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.points?.length ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}</section>)}<h4>Worked example</h4><p>{lesson.example.text}</p><h4>Common mistakes</h4><ul>{lesson.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul><h4>Active-project exercise</h4><p>{lesson.exercise}</p><a href={lesson.workspaceTarget}>Apply this lesson</a></details></article>)}</div>
    </section>

    <footer className={styles.footer}><Link href="/">Story Planner</Link><Link href="/pitch-review">Pitch & Review Studio</Link><Link href="/characters-in-motion">Characters in Motion</Link><span>GitHub, public access, credit, ownership and creative licensing remain separate decisions.</span></footer>
  </main>;
}
