"use client";

import { useMemo, useState } from "react";
import styles from "./pitch-review-workspace.module.css";
import DialecticWorksheet from "./dialectic-worksheet";
import LoglineRubric from "./logline-rubric";
import {
  addReviewComment,
  approveLoglineCandidate,
  buildGuidedLoglineCandidate,
  buildPitchPackageHtml,
  buildPresentationMarkdown,
  compareRevisionSnapshotsForReview,
  createReviewThread,
  ensureReviewWorkspace,
  pitchExportFileNames,
  removeReviewThread,
  saveLoglineCandidate,
  updatePitchPackage,
  updateReviewThreadStatus,
  type LoglineWorkshopAnswers,
} from "@/lib/pitch-review";
import type { PitchPackage, PlotPickleProject, ReviewAnchor, ReviewPriority, ReviewThreadStatus } from "@/lib/project";

type View = "logline" | "dialectic" | "reviews" | "revisions" | "package" | "exports";

type AnchorOption = ReviewAnchor & { value: string };

const workshopSteps: Array<{ key: keyof LoglineWorkshopAnswers; title: string; question: string; placeholder: string }> = [
  { key: "protagonist", title: "Protagonist", question: "Who carries the film?", placeholder: "Name or defining role" },
  { key: "identity", title: "Identity", question: "What makes them immediately specific?", placeholder: "A reluctant archivist with a forbidden memory" },
  { key: "disruption", title: "Disruption", question: "What breaks the ordinary world?", placeholder: "The catalytic event" },
  { key: "goal", title: "Goal", question: "What must they actively achieve?", placeholder: "A visible, playable objective" },
  { key: "opposition", title: "Opposition", question: "What force makes that difficult?", placeholder: "Person, system, environment or inner pattern" },
  { key: "stakes", title: "Stakes", question: "What happens if they fail?", placeholder: "Personal and external cost" },
  { key: "distinction", title: "Distinction", question: "What makes this film unlike the obvious version?", placeholder: "Irony, world rule, relationship or signature move" },
];

function downloadText(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function excerpt(value: string, length = 92) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}

function buildAnchorOptions(project: PlotPickleProject): AnchorOption[] {
  const options: AnchorOption[] = [
    { value: "project:project", kind: "project", targetId: project.id, label: "Whole project" },
    { value: "story:logline", kind: "story-field", targetId: "story.logline", label: `Logline — ${excerpt(project.story.logline) || "Not written"}` },
    { value: "story:premise", kind: "story-field", targetId: "story.premise", label: `Premise — ${excerpt(project.story.premise) || "Not written"}` },
    { value: "story:theme", kind: "story-field", targetId: "story.theme", label: `Theme — ${excerpt(project.story.theme) || "Not written"}` },
  ];
  project.blocks.forEach((block) => {
    options.push({ value: `block:${block.id}`, kind: "block", targetId: block.id, label: `Block ${block.number}: ${block.title}` });
    block.scenes.forEach((scene) => options.push({ value: `scene:${scene.id}`, kind: "scene", targetId: scene.id, label: `Block ${block.number} · Scene ${scene.number}: ${scene.title || scene.purpose || "Untitled scene"}` }));
  });
  project.screenplay.draftElements.forEach((element) => options.push({
    value: `screenplay:${element.id}`,
    kind: "screenplay-element",
    targetId: element.id,
    label: `${element.type} · B${element.blockNumber}.${element.miniBlockNumber} — ${excerpt(element.text) || "Empty element"}`,
  }));
  project.characters.forEach((character) => options.push({ value: `character:${character.id}`, kind: "character", targetId: character.id, label: `Character: ${character.name}` }));
  return options;
}

export default function PitchReviewWorkspace({ project, onProjectChange }: { project: PlotPickleProject; onProjectChange: (project: PlotPickleProject) => void }) {
  const active = useMemo(() => ensureReviewWorkspace(project), [project]);
  const [view, setView] = useState<View>("logline");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<LoglineWorkshopAnswers>({
    protagonist: project.development.foundations.protagonist,
    identity: "",
    disruption: project.story.catalyst,
    goal: project.development.foundations.objective,
    opposition: project.development.foundations.opposition,
    stakes: project.story.stakes,
    distinction: project.development.pickle.signatureMove,
  });
  const [candidatePreview, setCandidatePreview] = useState("");
  const anchorOptions = useMemo(() => buildAnchorOptions(active), [active]);
  const [anchorValue, setAnchorValue] = useState(anchorOptions[0]?.value ?? "project:project");
  const [threadTitle, setThreadTitle] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [reviewer, setReviewer] = useState("Writer");
  const [priority, setPriority] = useState<ReviewPriority>("normal");
  const [selectedThreadId, setSelectedThreadId] = useState(active.review.threads[0]?.id ?? "");
  const [reply, setReply] = useState("");
  const [leftRevisionId, setLeftRevisionId] = useState(active.revisions.at(-2)?.id ?? active.revisions[0]?.id ?? "");
  const [rightRevisionId, setRightRevisionId] = useState(active.revisions.at(-1)?.id ?? "");
  const [packageDraft, setPackageDraft] = useState<PitchPackage>(active.review.pitchPackage);

  const selectedThread = active.review.threads.find((thread) => thread.id === selectedThreadId) ?? active.review.threads[0];
  const comparison = useMemo(() => {
    const left = active.revisions.find((revision) => revision.id === leftRevisionId);
    const right = active.revisions.find((revision) => revision.id === rightRevisionId);
    return left && right && left.id !== right.id ? compareRevisionSnapshotsForReview(left, right) : null;
  }, [active.revisions, leftRevisionId, rightRevisionId]);

  function createCandidate() {
    const next = buildGuidedLoglineCandidate(active, answers);
    setCandidatePreview(next);
  }

  function keepCandidate() {
    if (!candidatePreview) return;
    onProjectChange(saveLoglineCandidate(active, candidatePreview));
    setCandidatePreview("");
  }

  function addThread() {
    const anchor = anchorOptions.find((option) => option.value === anchorValue);
    if (!anchor || !threadBody.trim()) return;
    const next = createReviewThread(active, { title: threadTitle, body: threadBody, author: reviewer, priority, anchor });
    onProjectChange(next);
    const created = next.review.threads.at(-1);
    setSelectedThreadId(created?.id ?? "");
    setThreadTitle("");
    setThreadBody("");
  }

  function changeStatus(status: ReviewThreadStatus) {
    if (!selectedThread) return;
    onProjectChange(updateReviewThreadStatus(active, selectedThread.id, status));
  }

  function addReply() {
    if (!selectedThread || !reply.trim()) return;
    onProjectChange(addReviewComment(active, selectedThread.id, reviewer, reply));
    setReply("");
  }

  function savePackage() {
    const next = updatePitchPackage(active, packageDraft);
    onProjectChange(next);
    setPackageDraft(next.review.pitchPackage);
  }

  function printPackage() {
    const html = buildPitchPackageHtml(updatePitchPackage(active, packageDraft));
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 150);
  }

  const counts = {
    open: active.review.threads.filter((thread) => thread.status === "open" || thread.status === "in-review").length,
    resolved: active.review.threads.filter((thread) => thread.status === "resolved").length,
    revisions: active.revisions.length,
    candidates: active.review.loglineCandidates.length,
  };

  return (
    <section className={styles.workspace} aria-labelledby="pitch-review-title">
      <header className={styles.hero}>
        <div>
          <p>PlotPickle 0.16 · Phase D</p>
          <h1 id="pitch-review-title">Pitch & Review Studio</h1>
          <span>Move from a local draft review to a complete shareable pitch package without separating comments, revisions or story evidence from the active project.</span>
        </div>
        <div className={styles.metrics}>
          <article><strong>{counts.open}</strong><span>active review threads</span></article>
          <article><strong>{counts.resolved}</strong><span>resolved threads</span></article>
          <article><strong>{counts.revisions}</strong><span>revision snapshots</span></article>
          <article><strong>{counts.candidates}</strong><span>saved loglines</span></article>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Pitch and review workflows">
        {([
          ["logline", "Logline Workshop"],
          ["dialectic", "Theme Dialectic"],
          ["reviews", "Anchored Reviews"],
          ["revisions", "Revision Compare"],
          ["package", "Pitch Package"],
          ["exports", "Exports"],
        ] as Array<[View, string]>).map(([id, label]) => <button key={id} type="button" className={view === id ? styles.activeTab : ""} onClick={() => setView(id)}>{label}</button>)}
      </nav>

      {view === "logline" ? <><div className={styles.twoColumn}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><span>Step {step + 1} of {workshopSteps.length}</span><h2>{workshopSteps[step].title}</h2></div><small>One concrete decision at a time</small></div>
          <p className={styles.question}>{workshopSteps[step].question}</p>
          <textarea value={answers[workshopSteps[step].key]} placeholder={workshopSteps[step].placeholder} onChange={(event) => setAnswers({ ...answers, [workshopSteps[step].key]: event.target.value })} />
          <div className={styles.actions}><button type="button" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>Previous</button>{step < workshopSteps.length - 1 ? <button type="button" className={styles.primary} onClick={() => setStep(step + 1)}>Next question</button> : <button type="button" className={styles.primary} onClick={createCandidate}>Build logline candidate</button>}</div>
          {candidatePreview ? <div className={styles.preview}><span>Review before saving</span><p>{candidatePreview}</p><div className={styles.actions}><button type="button" onClick={() => setCandidatePreview("")}>Discard</button><button type="button" className={styles.primary} onClick={keepCandidate}>Save candidate</button></div></div> : null}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><span>Candidate library</span><h2>Compare and approve</h2></div><small>Approval updates the canonical logline</small></div>
          <div className={styles.stack}>{active.review.loglineCandidates.length ? active.review.loglineCandidates.map((candidate) => <article className={candidate.selected ? styles.selectedCard : styles.card} key={candidate.id}><span>{candidate.source} · {new Date(candidate.createdAt).toLocaleString()}</span><p>{candidate.text}</p><button type="button" disabled={candidate.selected} onClick={() => onProjectChange(approveLoglineCandidate(active, candidate.id))}>{candidate.selected ? "Current approved logline" : "Approve this logline"}</button></article>) : <p className={styles.empty}>No saved candidates yet. Complete the guided questions to create the first one.</p>}</div>
        </section>
      </div><LoglineRubric project={active} text={candidatePreview || active.story.logline || active.development.pitch.oneSentence} /></> : null}

      {view === "dialectic" ? <DialecticWorksheet project={active} onProjectChange={onProjectChange} /> : null}

      {view === "reviews" ? <div className={styles.reviewLayout}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><span>New local review thread</span><h2>Anchor the note</h2></div><small>Stable IDs survive scene movement</small></div>
          <label>Reviewer<input value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label>
          <label>Anchor<select value={anchorValue} onChange={(event) => setAnchorValue(event.target.value)}>{anchorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as ReviewPriority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          <label>Thread title<input value={threadTitle} placeholder="What needs attention?" onChange={(event) => setThreadTitle(event.target.value)} /></label>
          <label>Opening comment<textarea value={threadBody} placeholder="Describe the reader experience, evidence or question." onChange={(event) => setThreadBody(event.target.value)} /></label>
          <button type="button" className={styles.primary} onClick={addThread}>Create anchored thread</button>
        </section>
        <aside className={styles.threadList} aria-label="Review threads">{active.review.threads.length ? active.review.threads.map((thread) => <button type="button" key={thread.id} className={selectedThread?.id === thread.id ? styles.activeThread : ""} onClick={() => setSelectedThreadId(thread.id)}><span>{thread.status} · {thread.priority}</span><strong>{thread.title}</strong><small>{thread.anchor.label}</small></button>) : <p className={styles.empty}>No review threads.</p>}</aside>
        <section className={styles.panel}>{selectedThread ? <>
          <div className={styles.panelTitle}><div><span>{selectedThread.anchor.kind}</span><h2>{selectedThread.title}</h2></div><small>{selectedThread.anchor.label}</small></div>
          <div className={styles.statusRow}>{(["open", "in-review", "resolved", "deferred"] as ReviewThreadStatus[]).map((status) => <button type="button" className={selectedThread.status === status ? styles.activeStatus : ""} key={status} onClick={() => changeStatus(status)}>{status}</button>)}</div>
          <div className={styles.comments}>{selectedThread.comments.map((comment) => <article key={comment.id}><header><strong>{comment.author}</strong><span>{new Date(comment.createdAt).toLocaleString()}</span></header><p>{comment.body}</p></article>)}</div>
          <label>Add reply<textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Add evidence, a decision or a follow-up question." /></label>
          <div className={styles.actions}><button type="button" onClick={() => onProjectChange(removeReviewThread(active, selectedThread.id))}>Delete thread</button><button type="button" className={styles.primary} onClick={addReply}>Add reply</button></div>
        </> : <p className={styles.empty}>Select or create a review thread.</p>}</section>
      </div> : null}

      {view === "revisions" ? <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><span>Canonical revision history</span><h2>Select two snapshots</h2></div><small>No project mutation</small></div>
          <label>Earlier snapshot<select value={leftRevisionId} onChange={(event) => setLeftRevisionId(event.target.value)}><option value="">Choose snapshot</option>{active.revisions.map((revision) => <option key={revision.id} value={revision.id}>{revision.label} · {new Date(revision.createdAt).toLocaleString()}</option>)}</select></label>
          <label>Later snapshot<select value={rightRevisionId} onChange={(event) => setRightRevisionId(event.target.value)}><option value="">Choose snapshot</option>{active.revisions.map((revision) => <option key={revision.id} value={revision.id}>{revision.label} · {new Date(revision.createdAt).toLocaleString()}</option>)}</select></label>
          <p className={styles.help}>Revision comparison reads the saved snapshot payloads and does not restore either version.</p>
        </section>
        <section className={styles.panel}>{comparison ? <>
          <div className={styles.panelTitle}><div><span>{comparison.leftLabel} → {comparison.rightLabel}</span><h2>Revision comparison</h2></div><small>{comparison.changedSections.length} changed sections</small></div>
          <p className={styles.summary}>{comparison.summary}</p>
          <div className={styles.chips}>{comparison.changedSections.map((section) => <span key={section}>{section}</span>)}</div>
          <details><summary>Added fields ({comparison.addedKeys.length})</summary><pre>{comparison.addedKeys.join("\n") || "None"}</pre></details>
          <details><summary>Removed fields ({comparison.removedKeys.length})</summary><pre>{comparison.removedKeys.join("\n") || "None"}</pre></details>
        </> : <p className={styles.empty}>Choose two different revision snapshots to compare.</p>}</section>
      </div> : null}

      {view === "package" ? <div className={styles.packageLayout}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><span>Pitch package builder</span><h2>Editorial content</h2></div><small>Saved inside the active project</small></div>
          {([[
            "title", "Title"], ["subtitle", "Subtitle"], ["tagline", "Tagline"], ["logline", "Logline"], ["synopsis", "Synopsis"], ["creatorStatement", "Creator statement"], ["audience", "Audience"], ["comparableTitles", "Comparable titles"], ["visualStatement", "Visual statement"], ["contactLine", "Contact line"],
          ] as Array<[keyof PitchPackage, string]>).map(([key, label]) => <label key={key}>{label}{["synopsis", "creatorStatement", "visualStatement"].includes(key) ? <textarea value={String(packageDraft[key])} onChange={(event) => setPackageDraft({ ...packageDraft, [key]: event.target.value })} /> : <input value={String(packageDraft[key])} onChange={(event) => setPackageDraft({ ...packageDraft, [key]: event.target.value })} />}</label>)}
          <button type="button" className={styles.primary} onClick={savePackage}>Save pitch package</button>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><span>Package contents</span><h2>Select sections and evidence</h2></div><small>Controls every export</small></div>
          <div className={styles.checkGrid}>{["cover", "logline", "synopsis", "characters", "world", "visuals", "creator", "rights"].map((section) => <label key={section}><input type="checkbox" checked={packageDraft.includeSections.includes(section)} onChange={(event) => setPackageDraft({ ...packageDraft, includeSections: event.target.checked ? [...packageDraft.includeSections, section] : packageDraft.includeSections.filter((item) => item !== section) })} />{section}</label>)}</div>
          <h3>Characters</h3><div className={styles.checkGrid}>{active.characters.map((character) => <label key={character.id}><input type="checkbox" checked={packageDraft.selectedCharacterIds.includes(character.id)} onChange={(event) => setPackageDraft({ ...packageDraft, selectedCharacterIds: event.target.checked ? [...packageDraft.selectedCharacterIds, character.id] : packageDraft.selectedCharacterIds.filter((id) => id !== character.id) })} />{character.name}</label>)}</div>
          <h3>Locations</h3><div className={styles.checkGrid}>{active.world.locations.map((location) => <label key={location.id}><input type="checkbox" checked={packageDraft.selectedLocationIds.includes(location.id)} onChange={(event) => setPackageDraft({ ...packageDraft, selectedLocationIds: event.target.checked ? [...packageDraft.selectedLocationIds, location.id] : packageDraft.selectedLocationIds.filter((id) => id !== location.id) })} />{location.name}</label>)}</div>
        </section>
      </div> : null}

      {view === "exports" ? <section className={styles.exportPanel}>
        <div><span>Shareable output</span><h2>Export the current pitch package</h2><p>Save the package first, then create a self-contained HTML file, print the same design to PDF, or export a slide-by-slide Markdown deck that can be pasted into presentation software.</p></div>
        <div className={styles.exportGrid}>
          <article><strong>PDF</strong><p>Opens a clean print layout in a separate window. Choose Save as PDF in the print dialog.</p><button type="button" onClick={printPackage}>Open PDF layout</button></article>
          <article><strong>HTML</strong><p>A self-contained pitch package that can be emailed, archived or opened in any modern browser.</p><button type="button" onClick={() => { const prepared = updatePitchPackage(active, packageDraft); const names = pitchExportFileNames(prepared); downloadText(names.html, buildPitchPackageHtml(prepared), "text/html"); }}>Download HTML</button></article>
          <article><strong>Presentation-ready</strong><p>A slide-separated Markdown outline with title, story, character, world, visual, positioning and rights slides.</p><button type="button" onClick={() => { const prepared = updatePitchPackage(active, packageDraft); const names = pitchExportFileNames(prepared); downloadText(names.presentation, buildPresentationMarkdown(prepared), "text/markdown"); }}>Download pitch deck</button></article>
        </div>
      </section> : null}
    </section>
  );
}
