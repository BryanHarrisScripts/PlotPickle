"use client";

import { useMemo, useState } from "react";
import {
  DISCOVERY_LANES,
  normalizeDiscoveryMapperResult,
  type DiscoveryCard,
  type DiscoveryCardKind,
} from "../../core/contracts/discovery";
import { projectDiscoveryPins } from "../../core/project/discovery-projection";
import {
  saveActiveLibraryProject,
  type LibraryPPFProject,
} from "../../core/storage/project-library-browser";
import styles from "./discovery-surface.module.css";

type AgentResponse = {
  readonly text?: string;
  readonly message?: string;
};

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `discovery-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactProjectContext(project: LibraryPPFProject) {
  return {
    project: { id: project.id, title: project.title, revision: project.revision },
    foundationsBrief: project.foundations.brief.content.slice(0, 2400),
    worldBrief: project.world.brief.content.slice(0, 1800),
    blocks: project.structure.blocks.map((block) => ({
      id: block.id,
      number: block.number,
      act: block.actNumber,
      title: block.title,
      note: block.note.slice(0, 400),
    })),
    pinnedLocal: project.discovery.cards
      .filter((card) => card.placement)
      .slice(-24)
      .map((card) => ({
        id: card.id,
        kind: card.kind,
        content: card.content.slice(0, 280),
        act: card.placement?.act,
        lane: card.placement?.lane,
      })),
  };
}

export default function DiscoverySurface({ project }: { readonly project: LibraryPPFProject | null }) {
  const [kind, setKind] = useState<DiscoveryCardKind>("text");
  const [content, setContent] = useState("");
  const [assetRef, setAssetRef] = useState("");
  const [notice, setNotice] = useState("");
  const [pinningId, setPinningId] = useState<string | null>(null);

  const projectPins = useMemo(() => project ? projectDiscoveryPins(project) : [], [project]);
  const localCards = project?.discovery.cards ?? [];
  const pinnedLocal = localCards.filter((card) => card.placement);
  const inbox = localCards.filter((card) => !card.placement);
  const boardCards = [...projectPins, ...pinnedLocal];

  function persist(cards: readonly DiscoveryCard[]) {
    if (!project) return;
    saveActiveLibraryProject({
      ...project,
      discovery: { ...project.discovery, cards },
    });
  }

  function addCard() {
    if (!project) {
      setNotice("Load or create a story in Library before saving Discovery material.");
      return;
    }
    const cleaned = content.trim();
    if (!cleaned) {
      setNotice("Write the discovery before adding it to the Inbox.");
      return;
    }
    const card: DiscoveryCard = {
      id: newId(),
      kind,
      content: cleaned.slice(0, 12_000),
      assetRef: kind === "visual" ? assetRef.trim().slice(0, 2_000) : "",
      sourceState: "new-local",
      sourceRef: null,
      createdAt: new Date().toISOString(),
      placement: null,
    };
    persist([...localCards, card]);
    setContent("");
    setAssetRef("");
    setNotice("Added to the Discovery Inbox. Select Pin when you want PlotPickle to classify it.");
  }

  async function pinCard(card: DiscoveryCard) {
    if (!project || card.placement || pinningId) return;
    setPinningId(card.id);
    setNotice("Discovery Mapper is classifying this card.");
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
      let raw: unknown;
      try {
        raw = JSON.parse(payload.text || "");
      } catch {
        throw new Error("Discovery Mapper returned an invalid placement envelope.");
      }
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
      setNotice(error instanceof Error ? error.message : "Discovery classification failed. The card remains unpinned.");
    } finally {
      setPinningId(null);
    }
  }

  if (!project) {
    return (
      <main className={styles.surface} data-discovery-surface="living-board">
        <section className={styles.summary}>
          <div>
            <h2>DISCOVERY</h2>
            <p>Capture written and visual ideas before they become formal 24/96 structure.</p>
          </div>
          <strong>NO ACTIVE STORY</strong>
        </section>
        <p className={styles.notice}>Load or create a story in Library before persistent project pinning.</p>
      </main>
    );
  }

  return (
    <main className={styles.surface} data-discovery-surface="living-board" data-discovery-project={project.id}>
      <section className={styles.summary}>
        <div>
          <small>DISCOVERY · NON-CANON PROJECTION</small>
          <h2>{project.title}</h2>
          <p>Create freely. Pinning asks PlotPickle to classify Act + lane; it does not rewrite the story.</p>
        </div>
        <strong>{boardCards.length} PINNED · {inbox.length} INBOX</strong>
      </section>

      <section className={styles.composer} aria-label="Discovery composer">
        <label>
          <span>Material type</span>
          <select value={kind} onChange={(event) => setKind(event.target.value === "visual" ? "visual" : "text")}>
            <option value="text">Written idea</option>
            <option value="visual">Visual reference</option>
          </select>
        </label>
        {kind === "visual" ? <label>
          <span>Visual asset / reference</span>
          <input value={assetRef} onChange={(event) => setAssetRef(event.target.value)} placeholder="Existing project asset or reference path" />
        </label> : <div />}
        <label>
          <span>Discovery</span>
          <textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Scene fragment, dialogue, character thought, plot idea, theme, world note, visual intention..." />
        </label>
        <div className={styles.actions}>
          <button type="button" onClick={addCard}>Add to Inbox</button>
        </div>
      </section>

      {notice ? <p className={styles.notice} aria-live="polite">{notice}</p> : null}

      <section className={styles.inbox} aria-label="Discovery Inbox">
        <h3>INBOX · UNPINNED</h3>
        <div className={styles.inboxList}>
          {inbox.length ? inbox.map((card) => (
            <article className={styles.card} data-source-state="new-local" key={card.id}>
              <header><strong>{card.kind === "visual" ? "VISUAL" : "WRITTEN"}</strong><span className={styles.status}>NEW LOCAL</span></header>
              <p>{card.content}</p>
              {card.assetRef ? <small className={styles.visualRef}>{card.assetRef}</small> : null}
              <button type="button" disabled={Boolean(pinningId)} onClick={() => pinCard(card)}>
                {pinningId === card.id ? "Classifying..." : "Pin"}
              </button>
            </article>
          )) : <p className={styles.empty}>No unpinned material. Add a card above when a new idea arrives.</p>}
        </div>
      </section>

      <section className={styles.board} aria-label="Living Discovery Board">
        <small>THE LIVING DISCOVERY BOARD · SYSTEM-CLASSIFIED PLACEMENT</small>
        <h3>STORY SHAPE</h3>
        <div className={styles.boardGrid}>
          <div className={styles.corner}>LANE / ACT</div>
          {[1, 2, 3, 4].map((act) => <div className={styles.actHeader} key={act}>ACT {act}</div>)}
          {DISCOVERY_LANES.flatMap((lane) => {
            const cells = [1, 2, 3, 4].map((act) => (
              <div className={styles.cell} data-discovery-act={act} data-discovery-lane={lane.id} key={`${lane.id}-${act}`}>
                {boardCards.filter((card) => card.placement?.act === act && card.placement.lane === lane.id).map((card) => (
                  <article className={styles.card} data-source-state={card.sourceState} key={card.id}>
                    <header>
                      <strong>{card.kind === "visual" ? "VISUAL" : "NOTE"}</strong>
                      <span className={styles.status}>{card.sourceState === "project" ? "PROJECT" : "NEW LOCAL"}</span>
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
