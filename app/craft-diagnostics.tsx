"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { diagnoseCraftLayer, type CraftFinding } from "@/lib/craft-diagnostics";
import styles from "./craft-diagnostics.module.css";

type Focus = { blockNumber?: number; sceneId?: string; characterId?: string };
type View = "overview" | "launch" | "threads" | "ledger" | "arcs" | "timeline";

function FindingCard({ item }: { item: CraftFinding }) {
  return (
    <article className={styles.finding} data-severity={item.severity}>
      <div><span>{item.scope}</span><b>{item.severity}</b></div>
      <h3>{item.title}</h3>
      <p>{item.reason}</p>
      {item.evidence.length ? <details><summary>Evidence</summary><ul>{item.evidence.map((entry, index) => <li key={`${item.id}-evidence-${index}`}>{entry}</li>)}</ul></details> : null}
      <div className={styles.questions}>{item.questions.map((question, index) => <p key={`${item.id}-question-${index}`}>{question}</p>)}</div>
    </article>
  );
}

function findingKey(item: CraftFinding) {
  return `${item.id}-${item.title}`;
}

export function CraftDiagnosticSummary({ project, focus }: { project: PlotPickleProject; focus?: Focus }) {
  const diagnostics = useMemo(() => diagnoseCraftLayer(project, focus), [focus, project]);
  return (
    <section className={styles.summary} aria-label="Diagnostic craft summary">
      <div className={styles.summaryHead}>
        <div><span>Diagnostic craft</span><strong>{diagnostics.summary.score}/100</strong></div>
        <Link href="/diagnostics">Open full diagnostics</Link>
      </div>
      <div className={styles.summaryCounts}>
        <div data-severity="problem"><b>{diagnostics.summary.problemCount}</b><span>root problems</span></div>
        <div data-severity="watch"><b>{diagnostics.summary.watchCount}</b><span>watch items</span></div>
        <div><b>{diagnostics.pulse.score.score}</b><span>scene pulse</span></div>
      </div>
      <div className={styles.compactFindings}>
        {diagnostics.findings.slice(0, 3).map((item) => <FindingCard item={item} key={findingKey(item)} />)}
        {!diagnostics.findings.length ? <p className={styles.healthy}>No active craft problem was found at this focus. Keep testing the evidence after each revision.</p> : null}
      </div>
    </section>
  );
}

export default function CraftDiagnosticsWorkspace({ project }: { project: PlotPickleProject }) {
  const [view, setView] = useState<View>("overview");
  const [blockNumber, setBlockNumber] = useState(1);
  const [sceneId, setSceneId] = useState(project.blocks[0]?.scenes[0]?.id ?? "");
  const [characterId, setCharacterId] = useState(project.characters[0]?.id ?? "");
  const diagnostics = useMemo(() => diagnoseCraftLayer(project, { blockNumber, sceneId, characterId }), [blockNumber, characterId, project, sceneId]);
  const selectedBlock = project.blocks[blockNumber - 1];

  function chooseBlock(value: number) {
    setBlockNumber(value);
    setSceneId(project.blocks[value - 1]?.scenes[0]?.id ?? "");
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.hero}>
        <div><p>PlotPickle 0.14 · Diagnostic craft layer</p><h1>Find the cause beneath the weak movement.</h1><span>Act I Launch, Opening Move, Scene Pulse, thread overlays, setup/payoff/reflection, character arcs, and chronology versus presentation all read the same canonical story.</span></div>
        <div className={styles.heroScore}><strong>{diagnostics.summary.score}</strong><span>diagnostic signal</span><small>{diagnostics.summary.problemCount} problems · {diagnostics.summary.watchCount} watch items</small></div>
      </header>

      <div className={styles.controls}>
        <label><span>Block focus</span><select value={blockNumber} onChange={(event) => chooseBlock(Number(event.target.value))}>{project.blocks.map((block) => <option value={block.number} key={block.id}>Block {block.number}: {block.title}</option>)}</select></label>
        <label><span>Scene focus</span><select value={sceneId} onChange={(event) => setSceneId(event.target.value)}>{selectedBlock.scenes.map((scene) => <option value={scene.id} key={scene.id}>{scene.number}. {scene.title}</option>)}</select></label>
        <label><span>Character focus</span><select value={characterId} onChange={(event) => setCharacterId(event.target.value)} disabled={!project.characters.length}>{project.characters.map((character) => <option value={character.id} key={character.id}>{character.name}</option>)}</select></label>
      </div>

      <nav className={styles.tabs} aria-label="Diagnostic views">
        {(["overview", "launch", "threads", "ledger", "arcs", "timeline"] as View[]).map((item) => <button type="button" className={view === item ? styles.active : ""} onClick={() => setView(item)} key={item}>{item === "launch" ? "Opening & Act I" : item}</button>)}
      </nav>

      {view === "overview" ? <div className={styles.overview}>
        <div className={styles.scoreGrid}>
          <article><span>Opening Move</span><strong>{diagnostics.opening.score.score}</strong><small>{diagnostics.opening.score.complete}/{diagnostics.opening.score.total} audience effects present</small></article>
          <article><span>Act I Launch</span><strong>{diagnostics.launch.score.score}</strong><small>{diagnostics.launch.score.complete}/{diagnostics.launch.score.total} launch signals present</small></article>
          <article><span>Scene Pulse</span><strong>{diagnostics.pulse.score.score}</strong><small>{diagnostics.pulse.scene?.title || "No selected scene"}</small></article>
          <article><span>Story systems</span><strong>{project.storyThreads.length + project.characters.length}</strong><small>threads and character arcs being tracked</small></article>
        </div>
        <div className={styles.findingGrid}>{diagnostics.findings.map((item) => <FindingCard item={item} key={findingKey(item)} />)}{!diagnostics.findings.length ? <p className={styles.healthy}>No active diagnostic finding at this focus.</p> : null}</div>
      </div> : null}

      {view === "launch" ? <div className={styles.twoPanel}>
        <section><h2>Opening Move</h2><p>Seven first-contact effects test what the audience begins tracking, feeling and predicting.</p><div className={styles.signalList}>{diagnostics.opening.effects.map((effect) => <article data-present={effect.present} key={effect.name}><div><strong>{effect.name}</strong><span>{effect.present ? "Present" : "Missing"}</span></div><p>{effect.diagnosis}</p><small>{effect.evidence || "No evidence recorded."}</small></article>)}</div></section>
        <section><h2>Act I Launch</h2><p>Twelve functions across Blocks 1–6 test whether the remaining eighteen blocks have enough story pressure and promise.</p><div className={styles.signalList}>{diagnostics.launch.signals.map((signal) => <article data-present={signal.present} key={`${signal.blockNumber}-${signal.name}`}><div><strong>Block {signal.blockNumber} · {signal.name}</strong><span>{signal.present ? "Present" : "Missing"}</span></div><p>{signal.diagnosis}</p><small>{signal.evidence || "No evidence recorded."}</small></article>)}</div><h3>Downstream promises</h3><ul>{diagnostics.launch.downstreamPromises.map((item, index) => <li key={`promise-${index}`}>{item}</li>)}{!diagnostics.launch.downstreamPromises.length ? <li>No tracked promise yet.</li> : null}</ul></section>
      </div> : null}

      {view === "threads" ? <div className={styles.overlayGrid}>{diagnostics.threads.map((thread) => <article className={styles.overlay} key={thread.id}><div><span>{thread.status}</span><strong>{thread.name}</strong></div><p>Blocks: {thread.blocks.join(", ") || "No scene evidence"}</p><div className={styles.blockTrack}>{project.blocks.map((block) => <i data-active={thread.blocks.includes(block.number)} data-gap={thread.gapBlocks.includes(block.number)} title={`Block ${block.number}`} key={block.id} />)}</div><small>{thread.milestoneCount} milestones · {thread.sceneIds.length} scenes · {thread.gapBlocks.length} gap blocks</small>{thread.findings.map((item) => <FindingCard item={item} key={findingKey(item)} />)}</article>)}{!diagnostics.threads.length ? <p className={styles.empty}>Add Story Threads in Core Model to build overlays.</p> : null}</div> : null}

      {view === "ledger" ? <div className={styles.tableWrap}><table><thead><tr><th>Status</th><th>Setup</th><th>Payoff</th><th>Reflection</th></tr></thead><tbody>{diagnostics.ledger.entries.map((entry) => <tr key={entry.id} data-status={entry.status}><td>{entry.status}</td><td><b>{entry.setupBlock ? `Block ${entry.setupBlock}` : "Missing"}</b><span>{entry.setup || "No visible setup"}</span></td><td><b>{entry.payoffBlock ? `Block ${entry.payoffBlock}` : "Open"}</b><span>{entry.payoff || "No matched payoff"}</span></td><td><b>{entry.reflectionBlock ? `Block ${entry.reflectionBlock}` : "Missing"}</b><span>{entry.reflection || "No emotional or thematic reflection"}</span></td></tr>)}</tbody></table>{!diagnostics.ledger.entries.length ? <p className={styles.empty}>Add setup and payoff text to blocks to build the ledger.</p> : null}</div> : null}

      {view === "arcs" ? <div className={styles.arcGrid}>{diagnostics.arcs.map((arc) => <article className={styles.arc} key={arc.characterId}><h2>{arc.characterName}</h2><div className={styles.arcTrack}>{arc.checkpoints.map((point, index) => <div data-filled={Boolean(point.evidence)} key={`${point.label}-${index}`}><i /><strong>{point.label}</strong><span>{point.blockNumber ? `Block ${point.blockNumber}` : "Flexible"}</span><p>{point.evidence || "No visible evidence"}</p></div>)}</div>{arc.findings.map((item) => <FindingCard item={item} key={findingKey(item)} />)}</article>)}{!diagnostics.arcs.length ? <p className={styles.empty}>Add characters and Arc Matrix fields to build checkpoint views.</p> : null}</div> : null}

      {view === "timeline" ? <div className={styles.tableWrap}><table><thead><tr><th>Scene</th><th>Chronology</th><th>Presentation</th><th>Shift</th><th>Temporal signal</th></tr></thead><tbody>{diagnostics.timeline.rows.map((row) => <tr key={row.sceneId}><td><b>Block {row.blockNumber}</b><span>{row.title}</span></td><td>{row.chronologyPosition}</td><td>{row.presentationPosition ?? "Not drafted"}</td><td>{row.presentationDelta === null ? "—" : row.presentationDelta === 0 ? "Same" : row.presentationDelta > 0 ? `Later +${row.presentationDelta}` : `Earlier ${row.presentationDelta}`}</td><td>{row.temporalSignal || "Linear / not signalled"}</td></tr>)}</tbody></table><div className={styles.findingGrid}>{diagnostics.timeline.findings.map((item) => <FindingCard item={item} key={findingKey(item)} />)}</div></div> : null}
    </section>
  );
}
