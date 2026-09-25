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
      .filter((card) => card.placement && (!act || card.placement.act === act))
      .slice(-36)
      .map((card) => ({
        content: card.content.slice(0, 320),
        act: card.placement?.act,
        lane: card.placement?.lane,
        source: card.sourceState,
      })),
  };
}

export default function DiscoverySurface({ project }: { readonly project: LibraryPPFProject | null }) {
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState("");
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [developingAct, setDevelopingAct] = useState<DiscoveryAct | null>(null);

  const projectPins = useMemo(() => project ? projectDiscoveryPins(project) : [], [project]);
  const localCards = project?.discovery.cards ?? [];
  const pinnedLocal = localCards.filter((card) => card.placement);
  const inbox = localCards.filter((card) => !card.placement);
  const boardCards = [...projectPins, ...pinnedLocal];

  function persist(cards: readonly DiscoveryCard[]) {
    if (!project) return;
    saveActiveLibraryProject({
      ...project,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
      discovery: { ...project.discovery, cards },
    });
  }

  function addCard() {
    if (!project) {
      setNotice("Load or create a story in Library before saving Mind Map material.");
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
      placement: null,
    };
    persist([...localCards, card]);
    setContent("");
    setNotice("Written idea added to the Mind Map Inbox. Select Pin when you want PlotPickle to classify it.");
  }

  async function pinCard(card: DiscoveryCard) {
    if (!project || card.placement || pinningId) return;
    setPinningId(card.id);
    setNotice("Discovery Mapper is classifying this Human-authored card.");
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
            "Classify only the supplied Human-authored card. Return the governed structured placement.",
            JSON.stringify({
              card: {
                id: card.id,
                kind: card.kind,
                content: card.content,
                assetRef: card.assetRef,
              },
              context: compactProjectContext(project),
            }),
          ].join("\n"),
        }),
      });
      const payload = await response.json() as AgentResponse;
      if (!response.ok) throw new Error(payload.message || "Discovery classification failed.");
      const raw: unknown = JSON.parse(payload.text || "");
      const mapped = normalizeDiscoveryMapperResult(raw);
      if (!mapped) throw new Error("Discovery Mapper did not return a valid Act and lane.");
      const updated = localCards.map((candidate): DiscoveryCard => candidate.id === card.id ? {
        ...candidate,
        placement: {
          ...mapped,
          classifierId: "discovery-mapper",
          classifierVersion: "1",
          pinnedAt: new Date().toISOString(),
        },
      } : candidate);
      persist(updated);
      setNotice(`Pinned to Act ${mapped.act} · ${DISCOVERY_LANES.find((lane) => lane.id === mapped.lane)?.label ?? mapped.lane}. Placement is read-only in v1.`);
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
                `Develop one substantial written Mind Map proposal for Act ${act}, lane "${lane.label}".`,
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
        `Creative Director completed ${proposals.length} of 6 Mind Map lanes for Act ${act}.`
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
            <h2>MIND MAP</h2>
            <p>Capture written ideas before they become formal 24/96 structure.</p>
          </div>
          <strong>NO ACTIVE STORY</strong>
        </section>
        <p className={styles.notice}>Load or create a story in Library before persistent project pinning.</p>
      </main>
    );
  }

  return (
    <main className={styles.surface} data-discovery-surface="living-board" data-mind-map-surface="true" data-discovery-project={project.id}>
      <section className={styles.summary}>
        <div>
          <small>MIND MAP · NON-CANON PROJECTION</small>
          <h2>{project.title}</h2>
          <p>Create written ideas freely. Human cards can be pinned by Discovery Mapper; Creative Director Act development creates reviewable proposals directly in the governed lane.</p>
        </div>
        <strong>{boardCards.length} PINNED · {inbox.length} INBOX</strong>
      </section>

      <section className={styles.composer} aria-label="Mind Map written idea composer">
        <div>
          <span>Material type</span>
          <strong>Written idea</strong>
        </div>
        <label>
          <span>Written idea</span>
          <textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Scene fragment, dialogue, character thought, plot idea, theme, world note or visual intention..." />
        </label>
        <div className={styles.actions}>
          <button type="button" onClick={addCard}>Add to Inbox</button>
        </div>
      </section>

      <section className={styles.actions} aria-label="Mind Map agent development">
        {MIND_MAP_ACTS.map((act) => (
          <button type="button" key={act} disabled={developingAct !== null} onClick={() => void developAct(act)}>
            {developingAct === act ? `Developing Act ${act}…` : `Develop Act ${act} Mind Map`}
          </button>
        ))}
      </section>

      {notice ? <p className={styles.notice} aria-live="polite">{notice}</p> : null}

      <section className={styles.inbox} aria-label="Mind Map Inbox">
        <h3>INBOX · UNPINNED WRITTEN IDEAS</h3>
        <div className={styles.inboxList}>
          {inbox.length ? inbox.map((card) => (
            <article className={styles.card} data-source-state={card.sourceState} key={card.id}>
              <header><strong>WRITTEN</strong><span className={styles.status}>NEW LOCAL</span></header>
              <p>{card.content}</p>
              <button type="button" disabled={Boolean(pinningId)} onClick={() => pinCard(card)}>
                {pinningId === card.id ? "Classifying..." : "Pin"}
              </button>
            </article>
          )) : <p className={styles.empty}>No unpinned material. Add a written idea above when a new idea arrives.</p>}
        </div>
      </section>

      <section className={styles.board} aria-label="Living Mind Map Board">
        <small>THE LIVING MIND MAP · ACT + LANE PLACEMENT</small>
        <h3>STORY SHAPE</h3>
        <div className={styles.boardGrid}>
          <div className={styles.corner}>LANE / ACT</div>
          {MIND_MAP_ACTS.map((act) => <div className={styles.actHeader} key={act}>ACT {act}</div>)}
          {DISCOVERY_LANES.flatMap((lane) => {
            const cells = MIND_MAP_ACTS.map((act) => (
              <div className={styles.cell} data-discovery-act={act} data-discovery-lane={lane.id} key={`${lane.id}-${act}`}>
                {boardCards.filter((card) => card.placement?.act === act && card.placement.lane === lane.id).map((card) => (
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
                ))}
              </div>
            ));
            return [<div className={styles.laneLabel} key={`${lane.id}-label`}>{lane.label}</div>, ...cells];
          })}
        </div>
      </section>
    </main>
  );
}
