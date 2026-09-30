"use client";

import { useEffect, useMemo, useState } from "react";
import { plotPickleCurriculum } from "../../adapters/curriculum/current-catalog";
import {
  DISCOVERY_LANES,
  type DiscoveryAct,
  type DiscoveryCard,
  type DiscoveryLaneId,
} from "../../core/contracts/discovery";
import {
  LEARN_TOPIC_SPINE,
  learnTopicHref,
  type LearnTopicSpineId,
} from "../../modules/learn/model/story-learning-context";
import {
  buildStoryDevelopmentFields,
  type StoryDevelopmentFieldDefinition,
} from "../../modules/learn/model/story-development-fields";
import { projectDiscoveryPins } from "../../core/project/discovery";
import {
  acceptStoryDevelopmentFieldProposal,
  storyDevelopmentFieldView,
  writeStoryDevelopmentFieldProposal,
  writeStoryDevelopmentFieldValue,
} from "../../core/project/story-development";
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

type ComposerLane = DiscoveryLaneId | "unsorted";

const MIND_MAP_ACTS: readonly DiscoveryAct[] = [1, 2, 3, 4];

function compactProjectContext(project: LibraryPPFProject, act: DiscoveryAct, cards: readonly DiscoveryCard[]) {
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
    mindMap: cards
      .filter((card) => card.placement?.act === act || (!card.placement && (card.inboxAct ?? 1) === act))
      .slice(-36)
      .map((card) => ({
        content: card.content.slice(0, 320),
        act: card.placement?.act ?? card.inboxAct ?? 1,
        lane: card.placement?.lane ?? null,
        source: card.sourceState,
        saved: Boolean(card.savedAt),
        locked: Boolean(card.lockedAt),
      })),
  };
}

function humanPlacement(act: DiscoveryAct, lane: DiscoveryLaneId, occurredAt: string) {
  const label = DISCOVERY_LANES.find((candidate) => candidate.id === lane)?.label ?? lane;
  return {
    act,
    lane,
    reason: `Human selected Act ${act} · ${label}.`,
    evidenceRefs: [] as readonly string[],
    classifierId: "human-direct-placement",
    classifierVersion: "mind-map-v2",
    pinnedAt: occurredAt,
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
  const [content, setContent] = useState("");
  const [composerLane, setComposerLane] = useState<ComposerLane>("story");
  const [notice, setNotice] = useState("");
  const [developingFieldId, setDevelopingFieldId] = useState<string | null>(null);
  const [fieldDrafts, setFieldDrafts] = useState<Readonly<Record<string, string>>>({});
  const [proposalDrafts, setProposalDrafts] = useState<Readonly<Record<string, string>>>({});
  const [projectContextOpen, setProjectContextOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [unsortedLaneChoices, setUnsortedLaneChoices] = useState<Readonly<Record<string, DiscoveryLaneId>>>({});
  const [workingCards, setWorkingCards] = useState<readonly DiscoveryCard[]>(project?.discovery.cards ?? []);
  const canonicalFields = useMemo(() => buildStoryDevelopmentFields(plotPickleCurriculum), []);

  useEffect(() => {
    setWorkingCards(project?.discovery.cards ?? []);
  }, [project?.id, project?.revision, project?.discovery.cards]);

  useEffect(() => {
    setSelectedTopic(initialTopic);
    const firstLane = DISCOVERY_LANES.find((lane) => lane.topic === initialTopic);
    if (firstLane) setComposerLane(firstLane.id);
  }, [initialTopic]);

  useEffect(() => {
    if (!initialFieldId || selectedTopic !== initialTopic) return;
    window.requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>("[data-canonical-field-id]"))
        .find((element) => element.dataset.canonicalFieldId === initialFieldId);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [initialFieldId, initialTopic, selectedTopic]);

  useEffect(() => {
    if (!project) {
      setFieldDrafts({});
      setProposalDrafts({});
      return;
    }
    setFieldDrafts(Object.fromEntries(canonicalFields.map((field) => [
      field.canonicalId,
      storyDevelopmentFieldView(project, field).value,
    ])));
    setProposalDrafts(Object.fromEntries(canonicalFields
      .map((field) => [field.canonicalId, storyDevelopmentFieldView(project, field).proposal] as const)
      .filter(([, proposal]) => Boolean(proposal))));
  }, [project?.id, project?.revision, canonicalFields]);

  const projectContextCards = useMemo(() => project ? projectDiscoveryPins(project) : [], [project]);
  const selectedCanonicalFields = canonicalFields.filter((field) => field.topicId === selectedTopic);
  const selectedActProjectCards = projectContextCards.filter((card) => card.placement?.act === selectedAct);
  const selectedActLocalCards = workingCards.filter((card) => (
    card.placement?.act === selectedAct || (!card.placement && (card.inboxAct ?? 1) === selectedAct)
  ));
  const selectedTopicLanes = DISCOVERY_LANES.filter((lane) => lane.topic === selectedTopic);
  const selectedTopicLaneIds = new Set<DiscoveryLaneId>(selectedTopicLanes.map((lane) => lane.id));
  const selectedActLaneCards = selectedActLocalCards.filter((card) => card.placement);
  const selectedActTopicCards = selectedActLaneCards.filter((card) => card.placement && selectedTopicLaneIds.has(card.placement.lane));
  const selectedActUnsorted = selectedActLocalCards.filter((card) => !card.placement);
  const agentCount = selectedActTopicCards.filter((card) => card.sourceState === "agent-proposal").length;
  const humanCount = selectedActTopicCards.filter((card) => card.sourceState === "new-local").length;
  const lockedCount = selectedActTopicCards.filter((card) => Boolean(card.lockedAt)).length;

  function persist(cards: readonly DiscoveryCard[]) {
    if (!project) return false;
    const next: LibraryPPFProject = {
      ...project,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
      discovery: { ...project.discovery, cards },
    };

    if (!hasActiveLibraryProject()) {
      const suggested = project.title === "Untitled Story" ? "" : project.title;
      const title = window.prompt("Save as New Project", suggested)?.trim() ?? "";
      if (!title) {
        setNotice("Save cancelled. The blank workspace was not added to Library.");
        return false;
      }
      const saved = saveDetachedLibraryProjectAs(next, { title, format: "Feature" });
      setWorkingCards(saved.discovery.cards);
      return true;
    }

    const saved = saveActiveLibraryProject(next);
    setWorkingCards(saved.discovery.cards);
    return true;
  }

  function keepDraftCards(cards: readonly DiscoveryCard[]) {
    setWorkingCards(cards);
  }

  function changeAct(act: DiscoveryAct) {
    setSelectedAct(act);
    setNotice("");
  }

  function changeTopic(topic: LearnTopicSpineId) {
    const firstLane = DISCOVERY_LANES.find((lane) => lane.topic === topic);
    setSelectedTopic(topic);
    if (firstLane) setComposerLane(firstLane.id);
    setNotice("");
  }

  function openLearnTopic() {
    window.location.assign(learnTopicHref(selectedTopic));
  }

  function addHumanIdea() {
    if (!project) {
      setNotice("Load or create a story in Library before saving MindMap material.");
      return;
    }
    const cleaned = content.trim();
    if (!cleaned) {
      setNotice("Write the idea before saving it.");
      return;
    }
    const now = new Date().toISOString();
    const placement = composerLane === "unsorted" ? null : humanPlacement(selectedAct, composerLane, now);
    const card: DiscoveryCard = {
      id: globalThis.crypto.randomUUID(),
      kind: "text",
      content: cleaned.slice(0, 12_000),
      assetRef: "",
      sourceState: "new-local",
      sourceRef: "human:mind-map",
      createdAt: now,
      inboxAct: selectedAct,
      placement,
      savedAt: now,
      lockedAt: null,
    };
    if (!persist([...workingCards, card])) return;
    setContent("");
    const destination = placement
      ? DISCOVERY_LANES.find((lane) => lane.id === placement.lane)?.label ?? placement.lane
      : "Unsorted";
    setNotice(`Human Idea saved to Act ${selectedAct} · ${destination}.`);
  }

  function assignUnsortedLane(card: DiscoveryCard) {
    if (card.placement) return;
    const lane = unsortedLaneChoices[card.id] ?? selectedTopicLanes[0]?.id ?? "story";
    const now = new Date().toISOString();
    const updated = workingCards.map((candidate): DiscoveryCard => candidate.id === card.id ? {
      ...candidate,
      placement: humanPlacement(card.inboxAct ?? selectedAct, lane, now),
    } : candidate);
    if (!persist(updated)) return;
    setNotice(`Human Idea assigned to ${DISCOVERY_LANES.find((candidate) => candidate.id === lane)?.label ?? lane}.`);
  }

  function saveCard(card: DiscoveryCard) {
    if (card.savedAt) return;
    const now = new Date().toISOString();
    if (!persist(workingCards.map((candidate): DiscoveryCard => candidate.id === card.id ? { ...candidate, savedAt: now } : candidate))) return;
    setNotice(`${card.sourceState === "agent-proposal" ? "Agent Proposal" : "Human Idea"} saved with the project.`);
  }

  function toggleLock(card: DiscoveryCard) {
    if (!card.placement) {
      setNotice("Assign a lane before locking this Human Idea.");
      return;
    }
    const now = new Date().toISOString();
    const unlocking = Boolean(card.lockedAt);
    if (!persist(workingCards.map((candidate): DiscoveryCard => candidate.id === card.id ? {
      ...candidate,
      savedAt: candidate.savedAt ?? now,
      lockedAt: unlocking ? null : now,
    } : candidate))) return;
    setNotice(`${card.sourceState === "agent-proposal" ? "Agent Proposal" : "Human Idea"} ${unlocking ? "unlocked" : "locked"}.`);
  }

  function deleteCard(card: DiscoveryCard) {
    if (card.lockedAt) {
      setNotice("Unlock this idea before deleting it.");
      setPendingDeleteId(null);
      return;
    }
    const remaining = workingCards.filter((candidate) => candidate.id !== card.id);
    if (hasActiveLibraryProject()) persist(remaining);
    else keepDraftCards(remaining);
    setPendingDeleteId(null);
    setNotice(`${card.sourceState === "agent-proposal" ? "Agent Proposal" : "Human Idea"} deleted.`);
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

  async function createCanonicalFieldProposal(field: StoryDevelopmentFieldDefinition) {
    if (!project || developingFieldId) return;
    setDevelopingFieldId(field.canonicalId);
    setNotice(`${field.actionLabel}…`);
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
              context: compactProjectContext(project, selectedAct, workingCards),
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
      setNotice(`${field.lessonTitle} proposal is ready for Human review.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Agent proposal failed.");
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
    setNotice(`${field.lessonTitle} proposal accepted into the canonical project field and remains editable.`);
  }

  if (!project) {
    return (
      <main className={styles.surface} data-discovery-surface="living-board" data-mind-map-surface="true">
        <section className={styles.summary}>
          <div>
            <h2>MindMap</h2>
            <p>Capture written ideas before they become formal 24/96 structure.</p>
          </div>
          <strong>NO ACTIVE STORY</strong>
        </section>
        <p className={styles.notice}>Load or create a story in Library before saving MindMap material.</p>
      </main>
    );
  }

  return (
    <main className={styles.surface} data-discovery-surface="living-board" data-mind-map-surface="true" data-discovery-project={project.id} data-mind-map-act={selectedAct} data-mind-map-topic={selectedTopic}>
      <section className={styles.summary}>
        <div>
          <small>MindMap · ACT {selectedAct} · NON-CANON WORKSPACE</small>
          <h2>{project.title}</h2>
          <p>Project Context is deterministic reference material. Human Ideas and Agent Proposals are the working material you can save and lock.</p>
        </div>
        <div className={styles.scoreboard} aria-label={`Act ${selectedAct} MindMap source scoreboard`}>
          <span>PROJECT <strong>{selectedActProjectCards.length}</strong></span>
          <span>AGENT <strong>{agentCount}</strong></span>
          <span>HUMAN <strong>{humanCount}</strong></span>
          <span>LOCKED <strong>{lockedCount}</strong></span>
          {selectedActUnsorted.length ? <span>UNSORTED <strong>{selectedActUnsorted.length}</strong></span> : null}
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
        <strong>{LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label}</strong>
        <button type="button" onClick={openLearnTopic}>Open in Learn</button>
      </div>

      <section className={styles.fieldWorkspace} aria-label={`${LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label} canonical story fields`}>
        <header className={styles.fieldWorkspaceHeader}>
          <div>
            <small>CANONICAL PROJECT FIELDS</small>
            <h3>{LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label}</h3>
          </div>
          <span>{selectedCanonicalFields.length} {selectedCanonicalFields.length === 1 ? "FIELD" : "FIELDS"}</span>
        </header>
        <p className={styles.fieldWorkspaceHelp}>Write directly or ask the agent for a proposal. A proposal never replaces your value until you choose Use Proposal.</p>
        <div className={styles.fieldGrid}>
          {selectedCanonicalFields.map((field) => {
            const persisted = storyDevelopmentFieldView(project, field);
            const proposal = proposalDrafts[field.canonicalId] ?? persisted.proposal;
            return (
              <article className={styles.fieldCard} data-canonical-field-id={field.canonicalId} data-field-classification={field.classification} key={field.canonicalId} tabIndex={-1}>
                <header>
                  <div>
                    <strong>{field.lessonTitle}</strong>
                    <small>{field.canonicalId}</small>
                  </div>
                  <span>{persisted.acceptedSource === "agent-proposal" ? "AGENT-ASSISTED" : persisted.value ? "SAVED" : "OPEN"}</span>
                </header>
                <p>{field.prompt}</p>
                <label>
                  <span>Your project value</span>
                  <textarea
                    rows={4}
                    value={fieldDrafts[field.canonicalId] ?? persisted.value}
                    onChange={(event) => setFieldDrafts((current) => ({ ...current, [field.canonicalId]: event.target.value }))}
                    placeholder="Write the project decision or application note…"
                  />
                </label>
                <div className={styles.fieldActions}>
                  <button type="button" onClick={() => saveCanonicalField(field)}>Save {field.lessonTitle}</button>
                  <button type="button" disabled={developingFieldId !== null} onClick={() => void createCanonicalFieldProposal(field)}>
                    {developingFieldId === field.canonicalId ? "Creating Proposal…" : field.actionLabel}
                  </button>
                </div>
                {proposal ? <div className={styles.fieldProposal} data-canonical-field-proposal={field.canonicalId}>
                  <label>
                    <span>Agent Proposal · editable before use</span>
                    <textarea
                      rows={4}
                      value={proposal}
                      onChange={(event) => setProposalDrafts((current) => ({ ...current, [field.canonicalId]: event.target.value }))}
                    />
                  </label>
                  <button type="button" onClick={() => useCanonicalFieldProposal(field)}>Use Proposal</button>
                </div> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.composer} aria-label={`Act ${selectedAct} MindMap Human Idea composer`}>
        <div>
          <span>Source</span>
          <strong>Human Idea</strong>
        </div>
        <div>
          <span>Act</span>
          <strong>Act {selectedAct}</strong>
        </div>
        <label>
          <span>Element</span>
          <select value={composerLane} onChange={(event) => setComposerLane(event.target.value as ComposerLane)}>
            {selectedTopicLanes.map((lane) => <option value={lane.id} key={lane.id}>{lane.label}</option>)}
            <option value="unsorted">Unsorted</option>
          </select>
        </label>
        <label className={styles.ideaField}>
          <span>Human Idea</span>
          <textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder={`Act ${selectedAct} · ${LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label}: write the idea you want to explore…`} />
        </label>
        <div className={styles.actions}>
          <button type="button" onClick={addHumanIdea}>Save Human Idea · Act {selectedAct}</button>
        </div>
      </section>

      <details className={styles.projectContext} open={projectContextOpen} onToggle={(event) => setProjectContextOpen(event.currentTarget.open)}>
        <summary>
          <span>PROJECT CONTEXT · DETERMINISTIC FROM PLOTPICKLE</span>
          <strong>{selectedActProjectCards.length}</strong>
        </summary>
        <p>Read-only reference material derived from the saved canonical story. It does not need Save, Lock, Delete or Redo.</p>
        <div className={styles.projectContextList}>
          {selectedActProjectCards.length ? selectedActProjectCards.map((card) => (
            <article className={styles.projectCard} data-source-state="project" key={card.id}>
              <header><strong>PROJECT CONTEXT</strong><span>ACT {selectedAct}</span></header>
              <p>{card.content}</p>
              <small>{card.placement?.reason}</small>
            </article>
          )) : <p className={styles.empty}>No deterministic project context is available for Act {selectedAct} yet.</p>}
        </div>
      </details>

      {notice ? <p className={styles.notice} aria-live="polite">{notice}</p> : null}

      {selectedActUnsorted.length ? <section className={styles.inbox} aria-label={`Act ${selectedAct} MindMap Unsorted Human Ideas`}>
        <h3>ACT {selectedAct} · UNSORTED HUMAN IDEAS</h3>
        <p>Choose a lane directly. No AI classification is required.</p>
        <div className={styles.inboxList}>
          {selectedActUnsorted.map((card) => (
            <article className={styles.card} data-source-state="new-local" key={card.id}>
              <header><strong>HUMAN IDEA</strong><span className={styles.status}>{card.savedAt ? "SAVED" : "DRAFT"}</span></header>
              <p>{card.content}</p>
              <label className={styles.assignLane}>Lane
                <select value={unsortedLaneChoices[card.id] ?? selectedTopicLanes[0]?.id ?? "story"} onChange={(event) => setUnsortedLaneChoices((current) => ({ ...current, [card.id]: event.target.value as DiscoveryLaneId }))}>
                  {selectedTopicLanes.map((lane) => <option value={lane.id} key={lane.id}>{lane.label}</option>)}
                </select>
              </label>
              <div className={styles.cardActions}>
                <button type="button" onClick={() => assignUnsortedLane(card)}>Assign Lane</button>
                <button type="button" disabled={Boolean(card.savedAt)} onClick={() => saveCard(card)}>{card.savedAt ? "Saved" : "Save"}</button>
                <button type="button" disabled>Lock</button>
                <button type="button" onClick={() => setPendingDeleteId(card.id)}>Delete</button>
              </div>
              {pendingDeleteId === card.id ? <div className={styles.deleteConfirm} role="alert"><span>Delete this Human Idea?</span><button type="button" onClick={() => deleteCard(card)}>Yes</button><button type="button" onClick={() => setPendingDeleteId(null)}>No</button></div> : null}
            </article>
          ))}
        </div>
      </section> : null}

      <section className={styles.board} aria-label={`Act ${selectedAct} Living MindMap Board`}>
        <small>THE LIVING MINDMAP · ACT {selectedAct} · 12 LEARN TOPICS</small>
        <h3>{LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label} · ACT {selectedAct}</h3>
        <div className={styles.laneGrid}>
          {selectedTopicLanes.map((lane) => {
            const cards = selectedActTopicCards.filter((card) => card.placement?.lane === lane.id);
            return (
              <section className={styles.lanePanel} data-discovery-act={selectedAct} data-discovery-lane={lane.id} key={lane.id}>
                <header className={styles.laneHeader}>
                  <h4>{lane.label}</h4>
                  <span>{cards.length} {cards.length === 1 ? "IDEA" : "IDEAS"}</span>
                </header>
                <div className={styles.laneCards}>
                  {cards.length ? cards.map((card) => {
                    const isAgent = card.sourceState === "agent-proposal";
                    const isLocked = Boolean(card.lockedAt);
                    return (
                      <article className={styles.card} data-source-state={card.sourceState} data-locked={isLocked ? "true" : "false"} key={card.id}>
                        <header>
                          <strong>{isAgent ? "AGENT PROPOSAL" : "HUMAN IDEA"}</strong>
                          <span className={styles.status}>{isLocked ? "LOCKED" : card.savedAt ? "SAVED" : "DRAFT"}</span>
                        </header>
                        <p>{card.content}</p>
                        {card.assetRef ? <small className={styles.visualRef}>{card.assetRef}</small> : null}
                        <small>{card.placement?.reason}</small>
                        <div className={styles.cardActions}>
                          <button type="button" disabled={Boolean(card.savedAt)} onClick={() => saveCard(card)}>{card.savedAt ? "Saved" : "Save"}</button>
                          <button type="button" onClick={() => toggleLock(card)}>{isLocked ? "Unlock" : "Lock"}</button>
                          <button type="button" disabled={isLocked} onClick={() => setPendingDeleteId(card.id)}>Delete</button>
                        </div>
                        {pendingDeleteId === card.id ? <div className={styles.deleteConfirm} role="alert"><span>Delete this {isAgent ? "Agent Proposal" : "Human Idea"}?</span><button type="button" onClick={() => deleteCard(card)}>Yes</button><button type="button" onClick={() => setPendingDeleteId(null)}>No</button></div> : null}
                      </article>
                    );
                  }) : <p className={styles.empty}>No Act {selectedAct} ideas in this lane yet.</p>}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}
