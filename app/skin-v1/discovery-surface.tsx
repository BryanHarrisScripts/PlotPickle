"use client";

import { useEffect, useMemo, useState } from "react";
import { plotPickleCurriculum } from "../../adapters/curriculum/current-catalog";
import { type DiscoveryAct } from "../../core/contracts/discovery";
import {
  LEARN_TOPIC_SPINE,
  learnLessonHref,
  type LearnTopicSpineId,
} from "../../modules/learn/model/story-learning-context";
import {
  buildStoryDevelopmentFields,
  storyDevelopmentFieldPageCount,
  storyDevelopmentFieldPageForId,
  storyDevelopmentFieldsForPage,
  type StoryDevelopmentFieldDefinition,
} from "../../modules/learn/model/story-development-fields";
import { relevantProjectContextForField } from "../../modules/learn/model/relevant-project-context";
import {
  acceptStoryDevelopmentFieldProposal,
  storyDevelopmentFieldView,
  writeStoryDevelopmentFieldProposal,
  writeStoryDevelopmentFieldValue,
} from "../../core/project/story-development";
import { mindMapFieldNote } from "../../core/storage/library-project";
import {
  hasActiveLibraryProject,
  saveActiveLibraryProject,
  saveDetachedLibraryProjectAs,
  type LibraryPPFProject,
} from "../../core/storage/project-library-browser";
import styles from "./discovery-surface.module.css";

type AgentResponse = {
  readonly text?: string;
  readonly message?: string;
};

type ProfileStatus = {
  readonly authenticated?: boolean;
  readonly profile?: { readonly displayName?: string } | null;
};


const MIND_MAP_ACTS: readonly DiscoveryAct[] = [1, 2, 3, 4];

function compactProjectContext(project: LibraryPPFProject, act: DiscoveryAct) {
  const blockNumbers = new Set(project.structure.blocks.filter((block) => block.actNumber === act).map((block) => block.number));
  return {
    project: { id: project.id, title: project.title, revision: project.revision },
    foundationsBrief: project.foundations.brief.content.slice(0, 2400),
    worldBrief: project.world.brief.content.slice(0, 1800),
    blocks: project.structure.blocks
      .filter((block) => block.actNumber === act)
      .map((block) => ({
        id: block.id,
        number: block.number,
        act: block.actNumber,
        title: block.title,
        note: block.note.slice(0, 400),
      })),
    writing: project.writing.entries
      .filter((entry) => blockNumbers.has(entry.blockNumber))
      .slice(-24)
      .map((entry) => ({
        block: entry.blockNumber,
        mini: entry.miniBlockNumber,
        text: entry.text.slice(0, 500),
      })),
    screenplay: (project.sourceEvidence.screenplay?.passages ?? [])
      .filter((passage) => blockNumbers.has(passage.blockNumber))
      .slice(0, 30)
      .map((passage) => ({
        id: passage.id,
        block: passage.blockNumber,
        mini: passage.miniBlockNumber,
        text: passage.text.slice(0, 300),
      })),
    characterTruth: (project.sourceEvidence.characterTruth?.claims ?? [])
      .filter((claim) => claim.reviewState !== "rejected" && claim.handling === "writer-reference" && claim.kind !== "sensitive-source")
      .slice(0, 36)
      .map((claim) => ({
        characters: claim.characterIds,
        kind: claim.kind,
        summary: claim.summary.slice(0, 300),
      })),
  };
}

export default function DiscoverySurface({
  project,
  initialTopic = "foundations",
  initialFieldId = null,
}: {
  readonly project: LibraryPPFProject | null;
  readonly initialTopic?: LearnTopicSpineId;
  readonly initialFieldId?: string | null;
}) {
  const [selectedAct, setSelectedAct] = useState<DiscoveryAct>(1);
  const [selectedTopic, setSelectedTopic] = useState<LearnTopicSpineId>(initialTopic);
  const [selectedFieldPage, setSelectedFieldPage] = useState(1);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(initialFieldId);
  const [notice, setNotice] = useState("");
  const [developingFieldId, setDevelopingFieldId] = useState<string | null>(null);
  const [fieldDrafts, setFieldDrafts] = useState<Readonly<Record<string, string>>>({});
  const [proposalDrafts, setProposalDrafts] = useState<Readonly<Record<string, string>>>({});
  const [humanDisplayName, setHumanDisplayName] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Readonly<Record<string, string>>>({});
  const [savedNoteTexts, setSavedNoteTexts] = useState<Readonly<Record<string, string>>>({});
  const canonicalFields = useMemo(() => buildStoryDevelopmentFields(plotPickleCurriculum), []);

  useEffect(() => {
    setSelectedTopic(initialTopic);
    setSelectedFieldPage(1);
    setSelectedFieldId(initialFieldId);
  }, [initialFieldId, initialTopic]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" }).then(
      async (response) => {
        if (!response.ok || cancelled) return;
        const status = await response.json() as ProfileStatus;
        if (cancelled) return;
        setHumanDisplayName(status.authenticated ? status.profile?.displayName?.trim() || "" : "");
      },
      () => {
        if (!cancelled) setHumanDisplayName("");
      },
    );
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!initialFieldId || selectedTopic !== initialTopic) return;
    const topicFields = canonicalFields.filter((field) => field.topicId === selectedTopic);
    const targetPage = storyDevelopmentFieldPageForId(topicFields, initialFieldId);
    if (selectedFieldPage !== targetPage) {
      setSelectedFieldPage(targetPage);
      return;
    }
    setSelectedFieldId(initialFieldId);
    window.requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>("[data-canonical-field-id]"))
        .find((element) => element.dataset.canonicalFieldId === initialFieldId);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [canonicalFields, initialFieldId, initialTopic, selectedFieldPage, selectedTopic]);

  useEffect(() => {
    if (!project) {
      setFieldDrafts({});
      setProposalDrafts({});
      setNoteDrafts({});
      setSavedNoteTexts({});
      return;
    }
    setFieldDrafts(Object.fromEntries(canonicalFields.map((field) => [
      field.canonicalId,
      storyDevelopmentFieldView(project, field).value,
    ])));
    setProposalDrafts(Object.fromEntries(canonicalFields
      .map((field) => [field.canonicalId, storyDevelopmentFieldView(project, field).proposal] as const)
      .filter(([, proposal]) => Boolean(proposal))));
    const incomingNotes = Object.fromEntries(canonicalFields.map((field) => [
      field.canonicalId,
      mindMapFieldNote(project.mindMapNotes, field.canonicalId).text,
    ]));
    setNoteDrafts((current) => Object.fromEntries(canonicalFields.map((field) => {
      const currentDraft = current[field.canonicalId];
      const wasDirty = currentDraft !== undefined && currentDraft !== (savedNoteTexts[field.canonicalId] ?? "");
      return [field.canonicalId, wasDirty ? currentDraft : incomingNotes[field.canonicalId]];
    })));
    setSavedNoteTexts(incomingNotes);
  }, [project?.id, project?.revision, canonicalFields]);

  const selectedCanonicalFields = canonicalFields.filter((field) => field.topicId === selectedTopic);
  const selectedFieldPageCount = storyDevelopmentFieldPageCount(selectedCanonicalFields);
  const visibleCanonicalFields = storyDevelopmentFieldsForPage(selectedCanonicalFields, selectedFieldPage);
  const selectedField = visibleCanonicalFields.find((field) => field.canonicalId === selectedFieldId)
    ?? visibleCanonicalFields[0]
    ?? null;
  const selectedFieldContextCount = selectedCanonicalFields.reduce(
    (total, field) => total + relevantProjectContextForField(project, field, selectedAct).length,
    0,
  );
  const selectedTopicLabel = LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label ?? selectedTopic;
  const persistedFieldNote = project && selectedField
    ? mindMapFieldNote(project.mindMapNotes, selectedField.canonicalId)
    : { text: "", updatedAt: null };
  const selectedFieldNoteDraft = selectedField
    ? noteDrafts[selectedField.canonicalId] ?? persistedFieldNote.text
    : "";
  const notesDirty = selectedField
    ? selectedFieldNoteDraft !== (savedNoteTexts[selectedField.canonicalId] ?? persistedFieldNote.text)
    : false;
  const notesOwnerLabel = humanDisplayName ? `${humanDisplayName}’s Notes` : "My Notes";

  function changeAct(act: DiscoveryAct) {
    setSelectedAct(act);
    setNotice("");
  }

  function changeTopic(topic: LearnTopicSpineId) {
    setSelectedTopic(topic);
    setSelectedFieldPage(1);
    setSelectedFieldId(null);
    setNotice("");
  }

  function openSelectedFieldInLearn() {
    if (!selectedField) return;
    window.location.assign(learnLessonHref(selectedField.topicId, selectedField.lessonId));
  }

  function persistCanonicalProject(next: LibraryPPFProject) {
    if (!project) return null;
    if (!hasActiveLibraryProject()) {
      const suggested = project.title === "Untitled Story" ? "" : project.title;
      const title = window.prompt("Save as New Project", suggested)?.trim() ?? "";
      if (!title) {
        setNotice("Save cancelled. The blank workspace was not added to Library.");
        return null;
      }
      return saveDetachedLibraryProjectAs(next, { title, format: "Feature" });
    }
    return saveActiveLibraryProject(next);
  }

  function saveCanonicalField(field: StoryDevelopmentFieldDefinition) {
    if (!project) return;
    const value = fieldDrafts[field.canonicalId] ?? storyDevelopmentFieldView(project, field).value;
    const next = writeStoryDevelopmentFieldValue({
      project,
      field,
      value,
      source: "human",
    });
    const saved = persistCanonicalProject(next);
    if (!saved) return;
    setFieldDrafts((current) => ({
      ...current,
      [field.canonicalId]: storyDevelopmentFieldView(saved, field).value,
    }));
    setNotice(`${field.lessonTitle} saved to the canonical project field.`);
  }

  function saveSelectedFieldNotes() {
    if (!project || !selectedField) return;
    const now = new Date().toISOString();
    const text = selectedFieldNoteDraft.slice(0, 24_000);
    const canonicalFieldId = selectedField.canonicalId;
    const next: LibraryPPFProject = {
      ...project,
      revision: project.revision + 1,
      updatedAt: now,
      mindMapNotes: {
        ...project.mindMapNotes,
        fields: {
          ...project.mindMapNotes.fields,
          [canonicalFieldId]: { text, updatedAt: now },
        },
      },
    };
    const saved = persistCanonicalProject(next);
    if (!saved) return;
    const savedNote = mindMapFieldNote(saved.mindMapNotes, canonicalFieldId);
    setNoteDrafts((current) => ({ ...current, [canonicalFieldId]: savedNote.text }));
    setSavedNoteTexts((current) => ({ ...current, [canonicalFieldId]: savedNote.text }));
    setNotice(`${selectedField.lessonTitle} notes saved with this project.`);
  }

  async function createCanonicalFieldProposal(field: StoryDevelopmentFieldDefinition) {
    if (!project || developingFieldId) return;
    setDevelopingFieldId(field.canonicalId);
    setNotice("Asking Agent for a suggestion…");
    try {
      const response = await fetch("/api/writing-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "creative-director",
          modelRole: "quality",
          tone: "direct",
          conversationMode: true,
          message: [
            "MIND_MAP_CANONICAL_FIELD_PROPOSAL",
            `Create one proposal for ${field.canonicalId}.`,
            `Craft prompt: ${field.prompt}`,
            "Use only the supplied project evidence. Do not claim the proposal is accepted canon. Return only the proposed field value, without JSON, headings, scoring or process notes.",
            JSON.stringify({
              topic: field.topicId,
              lessonId: field.lessonId,
              fieldId: field.fieldId,
              currentValue: fieldDrafts[field.canonicalId] ?? storyDevelopmentFieldView(project, field).value,
              context: compactProjectContext(project, selectedAct),
            }),
          ].join("\n\n"),
        }),
      });
      const payload = await response.json() as AgentResponse;
      const proposal = payload.text?.trim() ?? "";
      if (!response.ok || !proposal) throw new Error(payload.message || "Creative Director returned no proposal.");

      setProposalDrafts((current) => ({ ...current, [field.canonicalId]: proposal }));
      if (hasActiveLibraryProject()) {
        saveActiveLibraryProject(writeStoryDevelopmentFieldProposal({
          project,
          field,
          proposal,
          sourceRef: `agent:creative-director:mind-map:${field.canonicalId}`,
        }));
      }
      setNotice(`${field.lessonTitle} Agent Suggestion is ready for Human review.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Agent suggestion failed.");
    } finally {
      setDevelopingFieldId(null);
    }
  }

  function useCanonicalFieldProposal(field: StoryDevelopmentFieldDefinition) {
    if (!project) return;
    const proposal = (proposalDrafts[field.canonicalId] ?? storyDevelopmentFieldView(project, field).proposal).trim();
    if (!proposal) return;
    const withProposal = writeStoryDevelopmentFieldProposal({
      project,
      field,
      proposal,
      sourceRef: `agent:creative-director:mind-map:${field.canonicalId}`,
    });
    const next = acceptStoryDevelopmentFieldProposal({ project: withProposal, field });
    const saved = persistCanonicalProject(next);
    if (!saved) return;
    const value = storyDevelopmentFieldView(saved, field).value;
    setFieldDrafts((current) => ({ ...current, [field.canonicalId]: value }));
    setProposalDrafts((current) => ({ ...current, [field.canonicalId]: "" }));
    setNotice(`${field.lessonTitle} suggestion accepted into Project Value and remains editable.`);
  }

  if (!project) {
    return (
      <main className={styles.surface} data-discovery-surface="canonical-authoring" data-mind-map-surface="true">
        <section className={styles.summary}>
          <div>
            <h2>MindMap</h2>
            <p>Load or create a story to author canonical story-development fields and Human Notes.</p>
          </div>
          <strong>NO ACTIVE STORY</strong>
        </section>
        <p className={styles.notice}>Load or create a story in Library before editing Mind Map material.</p>
      </main>
    );
  }

  return (
    <main className={styles.surface} data-discovery-surface="canonical-authoring" data-mind-map-surface="true" data-discovery-project={project.id} data-mind-map-act={selectedAct} data-mind-map-topic={selectedTopic}>
      <section className={styles.summary}>
        <div>
          <small>MindMap · ACT {selectedAct} · CANONICAL AUTHORING</small>
          <h2>{project.title}</h2>
          <p>Human Notes support thinking. Project Value is story truth. Agent Suggestions remain separate until the Human chooses Use Suggestion.</p>
        </div>
        <div className={styles.scoreboard} aria-label={`Act ${selectedAct} MindMap authoring summary`}>
          <span>FIELDS <strong>{selectedCanonicalFields.length}</strong></span>
          <span>CONTEXT <strong>{selectedFieldContextCount}</strong></span>
          <span>NOTES <strong>{notesDirty ? "UNSAVED" : persistedFieldNote.text ? "SAVED" : "EMPTY"}</strong></span>
        </div>
      </section>

      <nav className={styles.actRail} aria-label="MindMap acts">
        {MIND_MAP_ACTS.map((act) => (
          <button
            type="button"
            key={act}
            aria-current={selectedAct === act ? "page" : undefined}
            data-mind-map-act-choice={act}
            onClick={() => changeAct(act)}
          >
            Act {act}
          </button>
        ))}
      </nav>

      <nav className={styles.topicRail} aria-label="MindMap Learn topics">
        {LEARN_TOPIC_SPINE.map((topic) => (
          <button
            type="button"
            key={topic.id}
            aria-current={selectedTopic === topic.id ? "page" : undefined}
            data-mind-map-topic={topic.id}
            onClick={() => changeTopic(topic.id)}
          >
            {topic.label}
          </button>
        ))}
      </nav>

      <div className={styles.topicToolbar}>
        <strong>{selectedTopicLabel}</strong>
        <span>{selectedCanonicalFields.length} {selectedCanonicalFields.length === 1 ? "FIELD" : "FIELDS"}</span>
      </div>

      {selectedFieldPageCount > 1 ? (
        <nav className={styles.fieldPager} aria-label={`${selectedTopicLabel} field pages`} data-mind-map-field-pager={selectedTopic}>
          {Array.from({ length: selectedFieldPageCount }, (_, index) => index + 1).map((page) => (
            <button
              type="button"
              key={page}
              aria-current={selectedFieldPage === page ? "page" : undefined}
              data-mind-map-field-page={page}
              onClick={() => {
                setSelectedFieldPage(page);
                setSelectedFieldId(null);
                setNotice("");
              }}
            >
              {page}
            </button>
          ))}
        </nav>
      ) : null}

      {selectedField ? (
        <section className={styles.contextualActions} data-mind-map-selected-field-actions={selectedField.canonicalId} aria-label="Selected Mind Map field actions">
          <div>
            <small>SELECTED FIELD</small>
            <strong>{selectedField.lessonTitle}</strong>
            <code>{selectedField.canonicalId}</code>
          </div>
          <div className={styles.contextualActionButtons}>
            <button type="button" onClick={() => saveCanonicalField(selectedField)}>Save Changes</button>
            <button type="button" disabled={developingFieldId !== null} onClick={() => void createCanonicalFieldProposal(selectedField)}>
              {developingFieldId === selectedField.canonicalId ? "Asking Agent…" : selectedField.actionLabel}
            </button>
            <button
              type="button"
              aria-expanded={notesOpen}
              data-mind-map-human-notes-toggle={selectedField.canonicalId}
              onClick={() => setNotesOpen((current) => !current)}
            >
              {notesOwnerLabel}
            </button>
            <button type="button" onClick={openSelectedFieldInLearn}>Open in Learn</button>
          </div>
        </section>
      ) : null}

      {notesOpen && selectedField ? (
        <section className={styles.humanNotes} data-mind-map-human-notes={selectedField.canonicalId} aria-label={`${selectedField.lessonTitle} Human notes`}>
          <header>
            <div>
              <small>HUMAN WORKING NOTES · NON-CANON</small>
              <h3>{selectedField.lessonTitle} · {notesOwnerLabel}</h3>
              <code>{selectedField.canonicalId}</code>
            </div>
            <span data-notes-save-state={notesDirty ? "unsaved" : "saved"}>{notesDirty ? "UNSAVED CHANGES" : "SAVED"}</span>
          </header>
          <p>Private working notes for the selected field. Saving notes does not change Project Value or accept an Agent Suggestion.</p>
          <textarea
            rows={6}
            value={selectedFieldNoteDraft}
            onChange={(event) => setNoteDrafts((current) => ({ ...current, [selectedField.canonicalId]: event.target.value }))}
            placeholder={`Write notes for ${selectedField.lessonTitle}…`}
          />
          <div className={styles.fieldActions}>
            <button type="button" disabled={!notesDirty} onClick={saveSelectedFieldNotes}>Save Notes</button>
          </div>
        </section>
      ) : null}

      <section className={styles.fieldWorkspace} aria-label={`${LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label} canonical story fields`}>
        <header className={styles.fieldWorkspaceHeader}>
          <div>
            <small>CANONICAL PROJECT FIELDS</small>
            <h3>{LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label}</h3>
          </div>
          <span>PAGE {selectedFieldPage} OF {selectedFieldPageCount} · {visibleCanonicalFields.length} VISIBLE / {selectedCanonicalFields.length} {selectedCanonicalFields.length === 1 ? "FIELD" : "FIELDS"}</span>
        </header>
        <p className={styles.fieldWorkspaceHelp}>Write directly or ask the Agent for a suggestion. A suggestion never replaces Project Value until you choose Use Suggestion.</p>
        <div className={styles.fieldGrid}>
          {visibleCanonicalFields.map((field) => {
            const persisted = storyDevelopmentFieldView(project, field);
            const proposal = proposalDrafts[field.canonicalId] ?? persisted.proposal;
            const relevantContext = relevantProjectContextForField(project, field, selectedAct);
            return (
              <article
                className={styles.fieldCard}
                data-canonical-field-id={field.canonicalId}
                data-field-classification={field.classification}
                data-selected-field={selectedField?.canonicalId === field.canonicalId ? "true" : "false"}
                key={field.canonicalId}
                tabIndex={0}
                onClick={() => setSelectedFieldId(field.canonicalId)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedFieldId(field.canonicalId);
                }}
              >
                <header>
                  <div>
                    <strong>{field.lessonTitle}</strong>
                    <small>{field.canonicalId}</small>
                  </div>
                  <div className={styles.fieldStatus}>
                    {selectedField?.canonicalId === field.canonicalId ? <strong>SELECTED</strong> : null}
                    <span>{persisted.acceptedSource === "agent-proposal" ? "AGENT-ASSISTED" : persisted.value ? "SAVED" : "OPEN"}</span>
                  </div>
                </header>
                <p>{field.prompt}</p>
                <label className={styles.projectValue}>
                  <span>PROJECT VALUE</span>
                  <textarea
                    rows={4}
                    value={fieldDrafts[field.canonicalId] ?? persisted.value}
                    onChange={(event) => setFieldDrafts((current) => ({ ...current, [field.canonicalId]: event.target.value }))}
                    placeholder="Write the project decision or application note…"
                  />
                </label>
                {proposal ? <div className={styles.fieldProposal} data-canonical-field-proposal={field.canonicalId}>
                  <label>
                    <span>AGENT SUGGESTION · editable before use</span>
                    <textarea
                      rows={4}
                      value={proposal}
                      onChange={(event) => setProposalDrafts((current) => ({ ...current, [field.canonicalId]: event.target.value }))}
                    />
                  </label>
                  <button type="button" onClick={() => useCanonicalFieldProposal(field)}>Use Suggestion</button>
                </div> : null}
                {relevantContext.length ? (
                  <details className={styles.fieldContext} data-relevant-project-context={field.canonicalId}>
                    <summary>
                      <span>RELEVANT PROJECT CONTEXT</span>
                      <strong>{relevantContext.length}</strong>
                    </summary>
                    <p>Read-only evidence selected by explicit PlotPickle rules for this field. It does not change Project Value.</p>
                    <div className={styles.fieldContextList}>
                      {relevantContext.map((item) => (
                        <article key={item.id} data-relevant-context-item={item.id}>
                          <header><strong>{item.label}</strong><span>READ ONLY</span></header>
                          <p>{item.text}</p>
                          <small>{item.reason}</small>
                          <div className={styles.evidenceRefs} aria-label="Evidence references">
                            {item.evidenceRefs.map((ref) => <code key={ref}>{ref}</code>)}
                          </div>
                        </article>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {notice ? <p className={styles.notice} aria-live="polite">{notice}</p> : null}

    </main>
  );
}
