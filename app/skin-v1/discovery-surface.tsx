"use client";

import { useMemo, useState } from "react";
import {
  DISCOVERY_LANES,
  normalizeDiscoveryMapperResult,
  type DiscoveryAct,
  type DiscoveryCard,
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

const MIND_MAP_ACTS: readonly DiscoveryAct[] = [1, 2, 3, 4];

function compactProjectContext(project: LibraryPPFProject, act?: DiscoveryAct) {
  const blockNumbers = new Set(project.structure.blocks.filter((block) => !act || block.actNumber === act).map((block) => block.number));
  return {
    project: { id: project.id, title: project.title, revision: project.revision },
    foundationsBrief: project.foundations.brief.content.slice(0, 2400),
    worldBrief: project.world.brief.content.slice(0, 1800),
    blocks: project.structure.blocks
      .filter((block) => !act || block.actNumber === act)
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
    mindMap: project.discovery.cards
      .filter((card) => (
        card.placement?.act === act
        || (!card.placement && (card.inboxAct ?? 1) === act)
      ))
      .slice(-36)
      .map((card) => ({
        content: card.content.slice(0, 320),
        act: card.placement?.act ?? card.inboxAct ?? 1,
        lane: card.placement?.lane ?? null,
        source: card.sourceState,
      })),
  };
}

export default function DiscoverySurface({ project }: { readonly project: LibraryPPFProject | null }) {
  const [selectedAct, setSelectedAct] = useState<DiscoveryAct>(1);
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState("");
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [developingAct, setDevelopingAct] = useState<DiscoveryAct | null>(null);

  const projectPins = useMemo(() => project ? projectDiscoveryPins(project) : [], [project]);
  const localCards = project?.discovery.cards ?? [];
  const pinnedLocal = localCards.filter((card) => card.placement);
  const boardCards = [...projectPins, ...pinnedLocal];
  const selectedActBoardCards = boardCards.filter((card) => card.placement?.act === selectedAct);
  const selectedActInbox = localCards.filter((card) => (
    !card.placement && (card.inboxAct ?? 1) === selectedAct
  ));

  function persist(cards: readonly DiscoveryCard[]) {
    if (!project) return;
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
  }

  function addCard() {
    if (!project) {
      setNotice("Load or create a story in Library before saving MindMap material.");
      return;
    }
    const cleaned = content.trim();
    if (!cleaned) {
      setNotice("Write the idea before adding it to the Inbox.");
      return;
    }
    const card: DiscoveryCard = {
      id: globalThis.crypto.randomUUID(),
      kind: "text",
      content: cleaned.slice(0, 12_000),
      assetRef: "",
      sourceState: "new-local",
      sourceRef: null,
      createdAt: new Date().toISOString(),
      inboxAct: selectedAct,
      placement: null,
    };
    persist([...localCards, card]);
    setContent("");
    setNotice(`Written idea added to Act ${selectedAct} Inbox. Select Pin when you want PlotPickle to classify its lane.`);
  }

  async function pinCard(card: DiscoveryCard) {
    if (!project || card.placement || pinningId) return;
    const fixedAct = card.inboxAct ?? 1;
    setPinningId(card.id);
    setNotice(`Discovery Mapper is classifying this Act ${fixedAct} Human-authored card.`);
    try {
      const response = await fetch("/api/writing-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "discovery-mapper",
          modelRole: "quality",
          tone: "direct",
          message: [
            "DISCOVERY_PIN_REQUEST",
            `Classify only the supplied Human-authored card into one governed lane for Act ${fixedAct}. The Act is fixed and must remain ${fixedAct}. Return the governed structured placement with act=${fixedAct}.`,
            JSON.stringify({
              requiredAct: fixedAct,
              card: {
                id: card.id,
                kind: card.kind,
                content: card.content,
                assetRef: card.assetRef,
              },
              context: compactProjectContext(project, fixedAct),
            }),
          ].join("\n"),
        }),
      });
      const payload = await response.json() as AgentResponse;
      if (!response.ok) throw new Error(payload.message || "Discovery classification failed.");
      const raw: unknown = JSON.parse(payload.text || "");
      const mapped = normalizeDiscoveryMapperResult(raw);
      if (!mapped) throw new Error("Discovery Mapper did not return a valid Act and lane.");
      if (mapped.act !== fixedAct) {
        throw new Error(`Discovery Mapper tried to move this card from Act ${fixedAct} to Act ${mapped.act}. The card remains unpinned.`);
      }
      const updated = localCards.map((candidate): DiscoveryCard => candidate.id === card.id ? {
        ...candidate,
        inboxAct: fixedAct,
        placement: {
          ...mapped,
          act: fixedAct,
          classifierId: "discovery-mapper",
          classifierVersion: "1",
          pinnedAt: new Date().toISOString(),
        },
      } : candidate);
      persist(updated);
      setNotice(`Pinned within Act ${fixedAct} · ${DISCOVERY_LANES.find((lane) => lane.id === mapped.lane)?.label ?? mapped.lane}. Placement is read-only in v1.`);
    } catch (error) {
      const message = error instanceof SyntaxError
        ? "Discovery Mapper returned an invalid placement envelope. The card remains unpinned."
        : error instanceof Error
          ? error.message
          : "Discovery classification failed. The card remains unpinned.";
      setNotice(message);
    } finally {
      setPinningId(null);
    }
  }

  async function developAct(act: DiscoveryAct) {
    if (!project || developingAct) return;
    setDevelopingAct(act);
    const context = compactProjectContext(project, act);
    const proposals: DiscoveryCard[] = [];
    const failures: string[] = [];
    try {
      for (const lane of DISCOVERY_LANES) {
        setNotice(`Creative Director is developing Act ${act} · ${lane.label}…`);
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
              reason: `Creative Director proposal for Act ${act} · ${lane.label}; review before treating any idea as canon.`,
              evidenceRefs: [],
              classifierId: "creative-director",
              classifierVersion: "mind-map-v1",
              pinnedAt: now,
            },
          });
        } catch (error) {
          failures.push(`${lane.label}: ${error instanceof Error ? error.message : "proposal failed"}`);
        }
      }

      if (proposals.length) {
        const retained = localCards.filter((card) => !(
          card.sourceState === "agent-proposal"
          && card.placement?.act === act
          && card.placement.classifierId === "creative-director"
        ));
        persist([...retained, ...proposals]);
      }
      setNotice(
        `Creative Director completed ${proposals.length} of ${DISCOVERY_LANES.length} MindMap lanes for Act ${act}.`
        + (failures.length ? ` ${failures.join(" ")}` : " Proposals remain non-canon until the Human chooses to use them."),
      );
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
        <p className={styles.notice}>Load or create a story in Library before persistent project pinning.</p>
      </main>
    );
  }

  return (
    <main className={styles.surface} data-discovery-surface="living-board" data-mind-map-surface="true" data-discovery-project={project.id} data-mind-map-act={selectedAct}>
      <section className={styles.summary}>
        <div>
          <small>MindMap · ACT {selectedAct} · NON-CANON PROJECTION</small>
          <h2>{project.title}</h2>
          <p>Work one Act at a time. Written ideas stay with the selected Act; Creative Director proposals fill that Act's eleven governed narrative lanes.</p>
        </div>
        <strong>{selectedActBoardCards.length} PINNED · {selectedActInbox.length} INBOX</strong>
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

      <section className={styles.composer} aria-label={`Act ${selectedAct} MindMap written idea composer`}>
        <div>
          <span>Material type</span>
          <strong>Written idea</strong>
        </div>
        <div>
          <span>Inbox</span>
          <strong>Act {selectedAct}</strong>
        </div>
        <label>
          <span>Written idea</span>
          <textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder={`Act ${selectedAct}: scene fragment, dialogue, character thought, plot idea, theme, world note or visual intention…`} />
        </label>
        <div className={styles.actions}>
          <button type="button" onClick={addCard}>Add to Act {selectedAct} Inbox</button>
        </div>
      </section>

      <section className={styles.developAction} aria-label="MindMap agent development">
        <button type="button" disabled={developingAct !== null} onClick={() => void developAct(selectedAct)}>
          {developingAct === selectedAct ? `Developing Act ${selectedAct}…` : `Develop Act ${selectedAct} Mind Map`}
        </button>
      </section>

      {notice ? <p className={styles.notice} aria-live="polite">{notice}</p> : null}

      <section className={styles.inbox} aria-label={`Act ${selectedAct} MindMap Inbox`}>
        <h3>ACT {selectedAct} INBOX · UNPINNED WRITTEN IDEAS</h3>
        <div className={styles.inboxList}>
          {selectedActInbox.length ? selectedActInbox.map((card) => (
            <article className={styles.card} data-source-state={card.sourceState} data-inbox-act={card.inboxAct ?? 1} key={card.id}>
              <header><strong>WRITTEN</strong><span className={styles.status}>ACT {card.inboxAct ?? 1} · NEW LOCAL</span></header>
              <p>{card.content}</p>
              <button type="button" disabled={Boolean(pinningId)} onClick={() => pinCard(card)}>
                {pinningId === card.id ? "Classifying..." : "Pin to this Act"}
              </button>
            </article>
          )) : <p className={styles.empty}>No unpinned Act {selectedAct} material. Add a written idea above when a new idea arrives.</p>}
        </div>
      </section>

      <section className={styles.board} aria-label={`Act ${selectedAct} Living MindMap Board`}>
        <small>THE LIVING MINDMAP · ACT {selectedAct} · ELEVEN GOVERNED LANES</small>
        <h3>STORY SHAPE · ACT {selectedAct}</h3>
        <div className={styles.laneGrid}>
          {DISCOVERY_LANES.map((lane) => {
            const cards = selectedActBoardCards.filter((card) => card.placement?.lane === lane.id);
            return (
              <section className={styles.lanePanel} data-discovery-act={selectedAct} data-discovery-lane={lane.id} key={lane.id}>
                <header className={styles.laneHeader}>
                  <h4>{lane.label}</h4>
                  <span>{cards.length} {cards.length === 1 ? "NOTE" : "NOTES"}</span>
                </header>
                <div className={styles.laneCards}>
                  {cards.length ? cards.map((card) => (
                    <article className={styles.card} data-source-state={card.sourceState} key={card.id}>
                      <header>
                        <strong>NOTE</strong>
                        <span className={styles.status}>
                          {card.sourceState === "project" ? "PROJECT" : card.sourceState === "agent-proposal" ? "AGENT PROPOSAL" : "NEW LOCAL"}
                        </span>
                      </header>
                      <p>{card.content}</p>
                      {card.assetRef ? <small className={styles.visualRef}>{card.assetRef}</small> : null}
                      <small>{card.placement?.reason}</small>
                    </article>
                  )) : <p className={styles.empty}>No Act {selectedAct} material in this lane yet.</p>}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}
