"use client";

import { useMemo, useState } from "react";
import styles from "./pitch-review-workspace.module.css";
import DialecticWorksheet from "./dialectic-worksheet";
import LoglineLab from "./logline-lab";
import {
  addReviewComment,
  buildPitchPackageHtml,
  buildPresentationMarkdown,
  compareRevisionSnapshotsForReview,
  createReviewThread,
  ensureReviewWorkspace,
  pitchExportFileNames,
  removeReviewThread,
  updatePitchPackage,
  updateReviewThreadStatus,
} from "@/lib/pitch-review";
import type { PitchPackage, PlotPickleProject, ReviewAnchor, ReviewPriority, ReviewThreadStatus } from "@/lib/project";

type View = "logline" | "dialectic" | "reviews" | "revisions" | "package" | "exports";
export type PitchReviewScope = "pitch" | "plan";

type AnchorOption = ReviewAnchor & { value: string };

const WORKFLOWS: Array<[View, string, PitchReviewScope]> = [
  ["logline", "Logline Lab", "pitch"],
  ["dialectic", "Theme Dialectic", "plan"],
  ["package", "Pitch Package", "pitch"],
  ["exports", "Exports", "pitch"],
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

export default function PitchReviewWorkspace({
  project,
  onProjectChange,
  scope = "pitch",
}: {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  scope?: PitchReviewScope;
}) {
  const active = useMemo(() => ensureReviewWorkspace(project), [project]);
  const scopedWorkflows = useMemo(() => WORKFLOWS.filter((workflow) => workflow[2] === scope), [scope]);
  const [selectedView, setView] = useState<View>(scopedWorkflows[0]?.[0] ?? "logline");
  const view = scopedWorkflows.some(([id]) => id === selectedView)
    ? selectedView
    : scopedWorkflows[0]?.[0] ?? "logline";
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

  const metrics = scope === "plan" ? [
    { value: active.storyThreads.length, label: "story threads" },
    { value: active.characters.length, label: "character viewpoints" },
    { value: active.story.theme ? 1 : 0, label: "working answer" },
    { value: active.story.antiTheme ? 1 : 0, label: "competing answer" },
  ] : [
    { value: active.review.loglineCandidates.length, label: "saved loglines" },
    { value: packageDraft.selectedCharacterIds.length, label: "package characters" },
    { value: packageDraft.selectedLocationIds.length, label: "package locations" },
    { value: packageDraft.includeSections.length, label: "export sections" },
  ];

  return (
    <section className={styles.workspace} aria-labelledby="pitch-review-title">
      <header className={styles.hero}>
        <div>
          <p>PlotPickle 0.16 · Phase D</p>
          <h1 id="pitch-review-title">{scope === "plan" ? "Theme Dialectic" : "Pitch Package Studio"}</h1>
          <span>{scope === "plan" ? "Plan owns the central question and competing answers. This worksheet tests them before Pitch turns the story into a package." : "Develop the logline, pitch package and exports without mixing in review-thread or approval controls."}</span>
        </div>
        <div className={styles.metrics}>
          {metrics.map((metric) => <article key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></article>)}
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Pitch and review workflows">
        {scopedWorkflows.map(([id, label]) => <button key={id} type="button" className={view === id ? styles.activeTab : ""} onClick={() => setView(id)}>{label}</button>)}
      </nav>

      {view === "logline" ? <LoglineLab project={active} onProjectChange={onProjectChange} /> : null}

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
