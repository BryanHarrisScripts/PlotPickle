"use client";

import { useMemo, useState } from "react";
import styles from "./feedback-workspace.module.css";
import ReviewWorkflowsPanel from "./review-workflows-panel";
import WritersRoomPanel from "./writers-room-panel";
import TableReadPanel from "./table-read-panel";
import {
  FEEDBACK_SECTIONS,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackFilters,
  type FeedbackSection,
  type FeedbackSource,
  type FeedbackStatus,
  type FeedbackTargetReference,
  type UnifiedFeedbackRecord,
} from "@/lib/unified-feedback";
import {
  addFeedbackComment,
  createFeedback,
  createStoredFeedbackModel,
  feedbackTargetOptions,
  updateFeedback,
} from "@/lib/unified-feedback-store";
import type { PlotPickleProject, ReviewPriority } from "@/lib/project";

const SECTION_LABELS: Record<FeedbackSection, string> = {
  overview: "Overview",
  "ai-review": "AI Review",
  "human-review": "Human Review",
  "writers-room": "Writers’ Room",
  "shooting-script": "Shooting Script",
  "table-read": "Table Read",
};

const SOURCE_OPTIONS: { id: FeedbackSource | ""; label: string }[] = [
  { id: "", label: "All sources" },
  { id: "human", label: "Human review" },
  { id: "ai", label: "AI proposal" },
  { id: "diagnostic", label: "Diagnostic" },
  { id: "collaboration", label: "Collaboration" },
  { id: "screenplay-annotation", label: "Screenplay annotation" },
  { id: "approval", label: "Approval" },
  { id: "writers-room", label: "Writers’ Room" },
  { id: "shooting-script", label: "Shooting Script" },
  { id: "table-read", label: "Table Read" },
];

const PRIORITIES: { id: ReviewPriority | ""; label: string }[] = [
  { id: "", label: "All priorities" },
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

const CATEGORIES: FeedbackCategory[] = [
  "story", "structure", "character", "relationship", "world", "dialogue", "action",
  "continuity", "visual", "production", "performance", "rights", "technical", "other",
];

const ROLE_OPTIONS = [
  "writer", "co-writer", "reviewer", "editor", "director", "producer", "actor", "designer", "ai-assistant", "system", "other",
] as const;

const RESOLVED_STATUSES: FeedbackStatus[] = ["accepted", "partially-accepted", "rejected", "resolved"];
const REVIEW_STATES: { label: string; status: FeedbackStatus }[] = [
  { label: "Open", status: "open" },
  { label: "Considered", status: "under-review" },
  { label: "Deferred", status: "deferred" },
  { label: "Resolved", status: "resolved" },
];

function titleCase(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function feedbackStatusLabel(status: FeedbackStatus) {
  return status === "under-review" ? "Considered" : titleCase(status);
}

function recordBelongsToSection(record: UnifiedFeedbackRecord, section: FeedbackSection) {
  if (section === "overview") return true;
  if (section === "ai-review") return ["ai", "diagnostic"].includes(record.source);
  if (section === "human-review") return ["human", "collaboration", "approval", "screenplay-annotation"].includes(record.source);
  if (section === "writers-room") return record.source === "writers-room";
  if (section === "shooting-script") return record.source === "shooting-script" || record.target.kind === "production-item";
  return record.source === "table-read" || record.category === "performance";
}

function sourceForSection(section: FeedbackSection): FeedbackSource {
  if (section === "ai-review") return "ai";
  if (section === "writers-room") return "writers-room";
  if (section === "shooting-script") return "shooting-script";
  if (section === "table-read") return "table-read";
  return "human";
}

function RecordCard({ record, selected, onSelect }: { record: UnifiedFeedbackRecord; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`${styles.recordCard} ${record.source === "ai" || record.source === "diagnostic" ? styles.aiRecord : styles.humanRecord} ${selected ? styles.selectedRecord : ""}`} onClick={onSelect} aria-pressed={selected}>
      <span className={styles.recordTopline}>
        <i className={styles[`priority${titleCase(record.priority)}`]}>{record.priority}</i>
        <b>{feedbackStatusLabel(record.status)}</b>
      </span>
      <strong>{record.title}</strong>
      <span>{record.target.label}</span>
      <p>{record.body}</p>
      <small>{titleCase(record.source)} · {record.thread.length} message{record.thread.length === 1 ? "" : "s"}</small>
    </button>
  );
}

type FeedbackWorkspaceProps = {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  onOpenTarget?: (target: FeedbackTargetReference) => void;
  initialTargetId?: string;
};

export default function FeedbackWorkspace({ project, onProjectChange, onOpenTarget, initialTargetId = "" }: FeedbackWorkspaceProps) {
  const [section, setSection] = useState<FeedbackSection>("overview");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const [source, setSource] = useState<FeedbackSource | "">("");
  const [priority, setPriority] = useState<ReviewPriority | "">("");
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [includeResolved, setIncludeResolved] = useState(true);
  const [targetFilter, setTargetFilter] = useState(initialTargetId);
  const [selectedId, setSelectedId] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newAuthor, setNewAuthor] = useState("Local reviewer");
  const [newTargetKey, setNewTargetKey] = useState("");
  const [newPriority, setNewPriority] = useState<ReviewPriority>("normal");
  const [newCategory, setNewCategory] = useState<FeedbackCategory>("story");
  const [newProposedChange, setNewProposedChange] = useState("");

  const filters: FeedbackFilters = useMemo(() => ({
    query,
    statuses: status ? [status] : undefined,
    sources: source ? [source] : undefined,
    priorities: priority ? [priority] : undefined,
    categories: category ? [category] : undefined,
    targetId: targetFilter || undefined,
    includeResolved,
  }), [query, status, source, priority, category, targetFilter, includeResolved]);

  const model = useMemo(() => createStoredFeedbackModel(project, filters), [project, filters]);
  const targets = useMemo(() => feedbackTargetOptions(project), [project]);
  const sectionRecords = model.visibleRecords.filter((record) => recordBelongsToSection(record, section));
  const selectedRecord = sectionRecords.find((record) => record.id === selectedId)
    ?? model.records.find((record) => record.id === selectedId)
    ?? sectionRecords[0]
    ?? model.records[0];
  const canonicalThreadCount = project.review.threads.length;
  const activeCount = model.records.filter((record) => !RESOLVED_STATUSES.includes(record.status)).length;

  function clearFilters() {
    setQuery("");
    setStatus("");
    setSource("");
    setPriority("");
    setCategory("");
    setTargetFilter("");
    setIncludeResolved(true);
  }

  function openSection(next: FeedbackSection) {
    setSection(next);
    setSelectedId("");
    if (next !== "overview") setSource("");
  }

  function updateSelected(patch: Parameters<typeof updateFeedback>[2]) {
    if (!selectedRecord || selectedRecord.synthetic) return;
    onProjectChange(updateFeedback(project, selectedRecord.id, patch));
  }

  function addComment() {
    if (!selectedRecord || selectedRecord.synthetic || !commentBody.trim()) return;
    onProjectChange(addFeedbackComment(project, selectedRecord.id, "Local reviewer", commentBody));
    setCommentBody("");
  }

  function openRefine(record: UnifiedFeedbackRecord) {
    const block = project.blocks.find((candidate) => candidate.id === record.target.blockId)
      ?? project.blocks.find((candidate) => candidate.scenes.some((scene) => scene.id === record.target.sceneId || scene.miniBlocks.some((mini) => mini.id === record.target.miniBlockId)))
      ?? project.blocks.find((candidate) => candidate.number === project.screenplay.draftElements.find((element) => element.id === record.target.screenplayElementId)?.blockNumber);
    const mini = record.target.miniBlockId && block
      ? block.scenes.flatMap((scene) => scene.miniBlocks).find((candidate) => candidate.id === record.target.miniBlockId)
      : project.screenplay.draftElements.find((element) => element.id === record.target.screenplayElementId);
    const blockNumber = block?.number ?? 1;
    const miniBlockNumber = mini && "number" in mini ? mini.number : mini?.miniBlockNumber ?? 1;
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", "refine");
    url.searchParams.set("block", String(blockNumber));
    url.searchParams.set("mini", String(miniBlockNumber));
    url.searchParams.set("feedback", record.id);
    url.searchParams.set("target", record.target.targetId);
    window.location.assign(`${url.pathname}?${url.searchParams.toString()}`);
  }

  function createRecord() {
    const option = targets.find((candidate) => `${candidate.kind}:${candidate.target.targetId}` === newTargetKey) ?? targets[0];
    if (!option || !newBody.trim()) return;
    const next = createFeedback(project, {
      title: newTitle,
      body: newBody,
      author: newAuthor,
      role: section === "table-read" ? "actor" : section === "shooting-script" ? "director" : "reviewer",
      source: sourceForSection(section),
      priority: newPriority,
      category: newCategory,
      proposedChange: newProposedChange,
      target: option.target,
    });
    onProjectChange(next);
    setNewTitle("");
    setNewBody("");
    setNewProposedChange("");
    setCreateOpen(false);
  }

  return (
    <div className={styles.workspace}>
      <aside className={styles.submenu} aria-label="Feedback sections">
        <div>
          <p>Feedback</p>
          <strong>Review without losing context</strong>
          <span>One discoverable workspace for every note, proposal, diagnostic and decision.</span>
        </div>
        <nav>
          {FEEDBACK_SECTIONS.map((item) => (
            <button type="button" key={item} className={section === item ? styles.activeSection : ""} onClick={() => openSection(item)}>
              <strong>{SECTION_LABELS[item]}</strong>
              <span>{model.bySection[item]}</span>
            </button>
          ))}
        </nav>
        <div className={styles.methodNote}>
          <span>Anchored review</span>
          <strong>{canonicalThreadCount} canonical threads</strong>
          <p>Stable IDs keep feedback attached when Blocks or mini-blocks move.</p>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <p>Unified review workspace</p>
            <h1>Collect, compare and resolve feedback around the current work.</h1>
            <span>Existing review threads, revision snapshots, diagnostics and optional AI proposals remain anchored to canonical story records. Suggestions do not overwrite the screenplay automatically.</span>
          </div>
          <button type="button" onClick={() => setCreateOpen((open) => !open)}>{createOpen ? "Close new feedback" : "Add feedback"}</button>
        </header>

        <section className={styles.metrics} aria-label="Feedback status summary">
          <article><strong>{model.counts.total}</strong><span>Total records</span></article>
          <article><strong>{activeCount}</strong><span>Active</span></article>
          <article><strong>{model.counts.resolved}</strong><span>Resolved history</span></article>
          <article><strong>{model.counts.ai + model.counts.diagnostics}</strong><span>AI and diagnostics</span></article>
          <article><strong>{model.counts.human}</strong><span>Human review</span></article>
        </section>

        {section === "ai-review" ? <ReviewWorkflowsPanel project={project} mode="ai" onProjectChange={onProjectChange} /> : null}
        {section === "human-review" ? <ReviewWorkflowsPanel project={project} mode="human" onProjectChange={onProjectChange} /> : null}
        {section === "writers-room" ? <WritersRoomPanel project={project} onProjectChange={onProjectChange} /> : null}
        {section === "table-read" ? <TableReadPanel project={project} onProjectChange={onProjectChange} initialTargetId={initialTargetId} /> : null}

        {createOpen ? (
          <section className={styles.createPanel} aria-label="Create feedback">
            <div className={styles.panelHeading}><div><p>New feedback</p><h2>{SECTION_LABELS[section]}</h2></div><span>Canon changes require a separate explicit action.</span></div>
            <div className={styles.formGrid}>
              <label><span>Target</span><select value={newTargetKey} onChange={(event) => setNewTargetKey(event.target.value)}><option value="">Project</option>{targets.map((option) => <option key={`${option.kind}:${option.target.targetId}`} value={`${option.kind}:${option.target.targetId}`}>{titleCase(option.kind)} · {option.target.label}</option>)}</select></label>
              <label><span>Author</span><input value={newAuthor} onChange={(event) => setNewAuthor(event.target.value)} /></label>
              <label><span>Priority</span><select value={newPriority} onChange={(event) => setNewPriority(event.target.value as ReviewPriority)}>{PRIORITIES.filter((item) => item.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label><span>Category</span><select value={newCategory} onChange={(event) => setNewCategory(event.target.value as FeedbackCategory)}>{CATEGORIES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
            </div>
            <label><span>Title</span><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="What needs attention?" /></label>
            <label><span>Feedback</span><textarea rows={4} value={newBody} onChange={(event) => setNewBody(event.target.value)} placeholder="State the observation, evidence and question." /></label>
            <label><span>Proposed change</span><textarea rows={3} value={newProposedChange} onChange={(event) => setNewProposedChange(event.target.value)} placeholder="Optional proposal. It will not be applied automatically." /></label>
            <button type="button" className={styles.primary} disabled={!newBody.trim()} onClick={createRecord}>Create anchored feedback</button>
          </section>
        ) : null}

        <section className={styles.filters} aria-label="Feedback filters">
          <label><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, body, target, author…" /></label>
          <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as FeedbackStatus | "")}><option value="">All statuses</option>{FEEDBACK_STATUSES.map((item) => <option key={item} value={item}>{feedbackStatusLabel(item)}</option>)}</select></label>
          <label><span>Source</span><select value={source} onChange={(event) => setSource(event.target.value as FeedbackSource | "")}>{SOURCE_OPTIONS.map((item) => <option key={item.id || "all"} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as ReviewPriority | "")}>{PRIORITIES.map((item) => <option key={item.id || "all"} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory | "")}><option value="">All categories</option>{CATEGORIES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
          <label className={styles.checkbox}><input type="checkbox" checked={includeResolved} onChange={(event) => setIncludeResolved(event.target.checked)} /><span>Include resolved history</span></label>
          <button type="button" onClick={clearFilters}>Clear filters</button>
        </section>

        <div className={styles.reviewLayout}>
          <section className={styles.recordList} aria-label={`${SECTION_LABELS[section]} feedback records`}>
            <header><div><p>{SECTION_LABELS[section]}</p><h2>{sectionRecords.length} visible records</h2></div>{targetFilter ? <button type="button" onClick={() => setTargetFilter("")}>Clear target</button> : null}</header>
            {sectionRecords.length ? sectionRecords.map((record) => <RecordCard key={record.id} record={record} selected={record.id === selectedRecord?.id} onSelect={() => setSelectedId(record.id)} />) : <div className={styles.empty}><strong>No feedback matches this view.</strong><span>Clear filters or add a new anchored record.</span></div>}
          </section>

          <aside className={styles.inspector} aria-label="Feedback record detail">
            {selectedRecord ? <>
              <header><div><p>{titleCase(selectedRecord.source)}</p><h2>{selectedRecord.title}</h2></div><span>{feedbackStatusLabel(selectedRecord.status)}</span></header>
              <button type="button" className={styles.targetButton} onClick={() => onOpenTarget?.(selectedRecord.target)}><strong>{selectedRecord.target.label}</strong><span>Open in {titleCase(selectedRecord.target.workspace)}</span></button>
              <div className={styles.metaGrid}>
                <span><b>Author</b>{selectedRecord.author}</span><span><b>Role</b>{titleCase(selectedRecord.role)}</span><span><b>Category</b>{titleCase(selectedRecord.category)}</span><span><b>Priority</b>{titleCase(selectedRecord.priority)}</span>
              </div>
              <section className={styles.bodyPanel}><strong>Feedback</strong><p>{selectedRecord.body}</p></section>
              {selectedRecord.proposedChange ? <section className={styles.proposal}><strong>Proposed change</strong><p>{selectedRecord.proposedChange}</p><span>Review before applying. Feedback never changes canon automatically.</span></section> : null}

              <section className={styles.bodyPanel} aria-label="Feedback decision state">
                <strong>Review state</strong>
                <p>Classify this note without changing the story. Refine receives this same feedback record and target.</p>
                <div className={styles.formGrid}>
                  {REVIEW_STATES.map((item) => <button type="button" key={item.status} disabled={selectedRecord.synthetic} aria-pressed={selectedRecord.status === item.status} onClick={() => updateSelected({ status: item.status })}>{item.label}</button>)}
                </div>
                <button type="button" className={styles.primary} onClick={() => openRefine(selectedRecord)}>Continue to Refine</button>
              </section>

              {selectedRecord.synthetic ? <div className={styles.readOnly}>Imported diagnostic or revision evidence is read-only. Create a human thread to record a decision.</div> : <>
                <div className={styles.formGrid}>
                  <label><span>Status</span><select value={selectedRecord.status} onChange={(event) => updateSelected({ status: event.target.value as FeedbackStatus })}>{FEEDBACK_STATUSES.map((item) => <option key={item} value={item}>{feedbackStatusLabel(item)}</option>)}</select></label>
                  <label><span>Priority</span><select value={selectedRecord.priority} onChange={(event) => updateSelected({ priority: event.target.value as ReviewPriority })}>{PRIORITIES.filter((item) => item.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                  <label><span>Category</span><select value={selectedRecord.category} onChange={(event) => updateSelected({ category: event.target.value as FeedbackCategory })}>{CATEGORIES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
                  <label><span>Role</span><select value={selectedRecord.role} onChange={(event) => updateSelected({ role: event.target.value as (typeof ROLE_OPTIONS)[number] })}>{ROLE_OPTIONS.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
                </div>
                <label><span>Proposed change</span><textarea key={`${selectedRecord.id}:proposal:${selectedRecord.updatedAt}`} rows={4} defaultValue={selectedRecord.proposedChange} onBlur={(event) => updateSelected({ proposedChange: event.target.value })} /></label>
                <label><span>Resolution</span><textarea key={`${selectedRecord.id}:resolution:${selectedRecord.updatedAt}`} rows={3} defaultValue={selectedRecord.resolution} onBlur={(event) => updateSelected({ resolution: event.target.value })} placeholder="Record why the feedback was accepted, rejected, deferred or resolved." /></label>
                <label><span>Linked revision</span><select value={selectedRecord.linkedRevisionId} onChange={(event) => updateSelected({ linkedRevisionId: event.target.value })}><option value="">No linked revision</option>{project.revisions.map((revision) => <option key={revision.id} value={revision.id}>{revision.label}</option>)}</select></label>
              </>}

              <section className={styles.thread}><header><strong>Thread</strong><span>{selectedRecord.thread.length} messages</span></header>{selectedRecord.thread.map((message) => <article key={message.id}><div><strong>{message.author}</strong><span>{titleCase(message.role)} · {new Date(message.createdAt).toLocaleString("en-CA")}</span></div><p>{message.body}</p></article>)}</section>
              {!selectedRecord.synthetic ? <div className={styles.commentComposer}><textarea rows={3} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Add a reply without changing canon." /><button type="button" disabled={!commentBody.trim()} onClick={addComment}>Add comment</button></div> : null}
            </> : <div className={styles.empty}><strong>No feedback selected.</strong><span>Choose a record or create new feedback.</span></div>}
          </aside>
        </div>
      </main>
    </div>
  );
}
