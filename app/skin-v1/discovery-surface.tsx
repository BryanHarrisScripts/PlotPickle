"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DISCOVERY_LANES,
  type DiscoveryAct,
  type DiscoveryCard,
  type DiscoveryLaneId,
} from "../../core/contracts/discovery";
import { projectDiscoveryPins } from "../../core/project/discovery";
import {
  saveActiveLibraryProject,
  type LibraryPPFProject,
} from "../../core/storage/project-library-browser";
import styles from "./discovery-surface.module.css";

type AgentResponse = {
  readonly text?: string;
  readonly message?: string;
};

type ComposerLane = DiscoveryLaneId | "unsorted";

const MIND_MAP_ACTS: readonly DiscoveryAct[] = [1, 2, 3, 4];
const ALL_LANE_IDS: readonly DiscoveryLaneId[] = DISCOVERY_LANES.map((lane) => lane.id);

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

export default function DiscoverySurface({ project }: { readonly project: LibraryPPFProject | null }) {
  const [selectedAct, setSelectedAct] = useState<DiscoveryAct>(1);
  const [content, setContent] = useState("");
  const [composerLane, setComposerLane] = useState<ComposerLane>("story");
  const [notice, setNotice] = useState("");
  const [developingAct, setDevelopingAct] = useState<DiscoveryAct | null>(null);
  const [proposalPickerOpen, setProposalPickerOpen] = useState(false);
  const [selectedProposalLanes, setSelectedProposalLanes] = useState<readonly DiscoveryLaneId[]>([]);
  const [projectContextOpen, setProjectContextOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [unsortedLaneChoices, setUnsortedLaneChoices] = useState<Readonly<Record<string, DiscoveryLaneId>>>({});
  const [workingCards, setWorkingCards] = useState<readonly DiscoveryCard[]>(project?.discovery.cards ?? []);

  useEffect(() => {
    setWorkingCards(project?.discovery.cards ?? []);
  }, [project?.id, project?.revision, project?.discovery.cards]);

  const projectContextCards = useMemo(() => project ? projectDiscoveryPins(project) : [], [project]);
  const selectedActProjectCards = projectContextCards.filter((card) => card.placement?.act === selectedAct);
  const selectedActLocalCards = workingCards.filter((card) => (
    card.placement?.act === selectedAct || (!card.placement && (card.inboxAct ?? 1) === selectedAct)
  ));
  const selectedActLaneCards = selectedActLocalCards.filter((card) => card.placement);
  const selectedActUnsorted = selectedActLocalCards.filter((card) => !card.placement);
  const agentCount = selectedActLocalCards.filter((card) => card.sourceState === "agent-proposal").length;
  const humanCount = selectedActLocalCards.filter((card) => card.sourceState === "new-local").length;
  const lockedCount = selectedActLocalCards.filter((card) => Boolean(card.lockedAt)).length;

  function persist(cards: readonly DiscoveryCard[]) {
    if (!project) return;
    setWorkingCards(cards);
    saveActiveLibraryProject({
      ...project,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
      discovery: { ...project.discovery, cards },
    });
  }

  function changeAct(act: DiscoveryAct) {
    setSelectedAct(act);
    setNotice("");
    setProposalPickerOpen(false);
    setSelectedProposalLanes([]);
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
    persist([...workingCards, card]);
    setContent("");
    const destination = placement
      ? DISCOVERY_LANES.find((lane) => lane.id === placement.lane)?.label ?? placement.lane
      : "Unsorted";
    setNotice(`Human Idea saved to Act ${selectedAct} · ${destination}.`);
  }

  function assignUnsortedLane(card: DiscoveryCard) {
    if (card.placement) return;
    const lane = unsortedLaneChoices[card.id] ?? "story";
    const now = new Date().toISOString();
    const updated = workingCards.map((candidate): DiscoveryCard => candidate.id === card.id ? {
      ...candidate,
      placement: humanPlacement(card.inboxAct ?? selectedAct, lane, now),
    } : candidate);
    persist(updated);
    setNotice(`Human Idea assigned to ${DISCOVERY_LANES.find((candidate) => candidate.id === lane)?.label ?? lane}.`);
  }

  function saveCard(card: DiscoveryCard) {
    if (card.savedAt) return;
    const now = new Date().toISOString();
    persist(workingCards.map((candidate): DiscoveryCard => candidate.id === card.id ? { ...candidate, savedAt: now } : candidate));
    setNotice(`${card.sourceState === "agent-proposal" ? "Agent Proposal" : "Human Idea"} saved with the project.`);
  }

  function toggleLock(card: DiscoveryCard) {
    if (!card.placement) {
      setNotice("Assign a lane before locking this Human Idea.");
      return;
    }
    const now = new Date().toISOString();
    const unlocking = Boolean(card.lockedAt);
    persist(workingCards.map((candidate): DiscoveryCard => candidate.id === card.id ? {
      ...candidate,
      savedAt: candidate.savedAt ?? now,
      lockedAt: unlocking ? null : now,
    } : candidate));
    setNotice(`${card.sourceState === "agent-proposal" ? "Agent Proposal" : "Human Idea"} ${unlocking ? "unlocked" : "locked"}.`);
  }

  function deleteCard(card: DiscoveryCard) {
    if (card.lockedAt) {
      setNotice("Unlock this idea before deleting it.");
      setPendingDeleteId(null);
      return;
    }
    persist(workingCards.filter((candidate) => candidate.id !== card.id));
    setPendingDeleteId(null);
    setNotice(`${card.sourceState === "agent-proposal" ? "Agent Proposal" : "Human Idea"} deleted.`);
  }

  function toggleProposalLane(lane: DiscoveryLaneId) {
    setSelectedProposalLanes((current) => current.includes(lane)
      ? current.filter((candidate) => candidate !== lane)
      : [...current, lane]);
  }

  async function developLanes(act: DiscoveryAct, laneIds: readonly DiscoveryLaneId[]) {
    if (!project || developingAct || !laneIds.length) return;
    setDevelopingAct(act);
    const context = compactProjectContext(project, act, workingCards);
    const proposals: DiscoveryCard[] = [];
    const successfulLaneIds = new Set<DiscoveryLaneId>();
    const failures: string[] = [];
    try {
      for (const lane of DISCOVERY_LANES.filter((candidate) => laneIds.includes(candidate.id))) {
        setNotice(`Creative Director is developing Agent Proposal · Act ${act} · ${lane.label}…`);
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
                "MIND_MAP_ACT_DEVELOPMENT_REQUEST",
                `Develop one substantial written MindMap proposal for Act ${act}, lane "${lane.label}".`,
                "Use only the supplied project evidence. Expand the narrative implications, relationships, pressure, choices, imagery or research needs appropriate to this lane. Do not claim the proposal is accepted canon. Do not return JSON, headings or process notes; return the proposed written idea only.",
                JSON.stringify({ act, lane: lane.id, context }),
              ].join("\n\n"),
            }),
          });
          const payload = await response.json() as AgentResponse;
          const text = payload.text?.trim() ?? "";
          if (!response.ok || !text) throw new Error(payload.message || "Creative Director returned no proposal.");
          const now = new Date().toISOString();
          successfulLaneIds.add(lane.id);
          proposals.push({
            id: globalThis.crypto.randomUUID(),
            kind: "text",
            content: text.slice(0, 12_000),
            assetRef: "",
            sourceState: "agent-proposal",
            sourceRef: `agent:creative-director:mind-map:act-${act}:${lane.id}`,
            createdAt: now,
            inboxAct: act,
            placement: {
              act,
              lane: lane.id,
              reason: `Creative Director proposal for Act ${act} · ${lane.label}; review before treating any idea as approved direction.`,
              evidenceRefs: [],
              classifierId: "creative-director",
              classifierVersion: "mind-map-v2",
              pinnedAt: now,
            },
            savedAt: null,
            lockedAt: null,
          });
        } catch (error) {
          failures.push(`${lane.label}: ${error instanceof Error ? error.message : "proposal failed"}`);
        }
      }

      if (proposals.length) {
        const retained = workingCards.filter((card) => !(
          card.sourceState === "agent-proposal"
          && card.placement?.act === act
          && successfulLaneIds.has(card.placement.lane)
        ));
        persist([...retained, ...proposals]);
      }
      setNotice(
        `Creative Director completed ${proposals.length} of ${laneIds.length} selected Agent Proposal lanes for Act ${act}.`
        + (failures.length ? ` ${failures.join(" ")}` : " Save and Lock remain explicit Human decisions."),
      );
      setProposalPickerOpen(false);
      setSelectedProposalLanes([]);
    } finally {
      setDevelopingAct(null);
    }
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
    <main className={styles.surface} data-discovery-surface="living-board" data-mind-map-surface="true" data-discovery-project={project.id} data-mind-map-act={selectedAct}>
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
          <span>Lane</span>
          <select value={composerLane} onChange={(event) => setComposerLane(event.target.value as ComposerLane)}>
            {DISCOVERY_LANES.map((lane) => <option value={lane.id} key={lane.id}>{lane.label}</option>)}
            <option value="unsorted">Unsorted</option>
          </select>
        </label>
        <label className={styles.ideaField}>
          <span>Human Idea</span>
          <textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder={`Act ${selectedAct}: write the story, plot, character, scene, dialogue, world, research, theme, motif, visual or image idea you want to explore…`} />
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

      <section className={styles.developAction} aria-label="MindMap Agent Proposal development">
        <button type="button" disabled={developingAct !== null} onClick={() => setProposalPickerOpen((open) => !open)}>
          {developingAct === selectedAct ? `Developing Agent Proposals · Act ${selectedAct}…` : `Develop Agent Proposals · Act ${selectedAct}`}
        </button>
        {proposalPickerOpen ? <div className={styles.proposalPicker}>
          <strong>Select lanes to develop</strong>
          <div className={styles.laneChoices}>
            {DISCOVERY_LANES.map((lane) => (
              <label key={lane.id}>
                <input
                  type="checkbox"
                  checked={selectedProposalLanes.includes(lane.id)}
                  disabled={developingAct !== null}
                  onChange={() => toggleProposalLane(lane.id)}
                />
                {lane.label}
              </label>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" disabled={developingAct !== null || selectedProposalLanes.length === 0} onClick={() => void developLanes(selectedAct, selectedProposalLanes)}>Generate Selected</button>
            <button type="button" disabled={developingAct !== null} onClick={() => void developLanes(selectedAct, ALL_LANE_IDS)}>Build All</button>
          </div>
        </div> : null}
      </section>

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
                <select value={unsortedLaneChoices[card.id] ?? "story"} onChange={(event) => setUnsortedLaneChoices((current) => ({ ...current, [card.id]: event.target.value as DiscoveryLaneId }))}>
                  {DISCOVERY_LANES.map((lane) => <option value={lane.id} key={lane.id}>{lane.label}</option>)}
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
        <small>THE LIVING MINDMAP · ACT {selectedAct} · ELEVEN GOVERNED LANES</small>
        <h3>STORY SHAPE · ACT {selectedAct}</h3>
        <div className={styles.laneGrid}>
          {DISCOVERY_LANES.map((lane) => {
            const cards = selectedActLaneCards.filter((card) => card.placement?.lane === lane.id);
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
                          {isAgent ? <button type="button" disabled={developingAct !== null} onClick={() => void developLanes(selectedAct, [lane.id])}>Redo</button> : null}
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
