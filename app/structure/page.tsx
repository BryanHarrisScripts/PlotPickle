"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type MiniBlock,
  type PlotPickleProject,
  type StoryScene,
  type StorySequence,
} from "@/lib/project";
import {
  buildStoryClock,
  pacingAverageShotSeconds,
  rebalanceStoryTiming,
  secondsToTimecode,
  type PacingProfile,
} from "@/lib/structure";
import styles from "./structure.module.css";

const STORAGE_KEY = "plotpickle.project.v1";

type SequenceTextKey = "title" | "purpose" | "question" | "promise" | "escalation" | "climax" | "turningPoint" | "result";
type SceneTextKey = "title" | "purpose" | "objective" | "conflict" | "turn" | "resolution" | "outcome";
type MiniTextKey = "label" | "function" | "purpose" | "characterId" | "objective" | "resistance" | "action" | "revelation" | "turn" | "visualBeat" | "dialogueIntention" | "entryState" | "exitState" | "setup" | "payoff" | "notes";

type FieldProps = {
  label: string;
  help?: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
};

function Field({ label, help, value, rows = 4, onChange }: FieldProps) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      {help ? <small>{help}</small> : null}
    </label>
  );
}

function NumberField({ label, value, min = 0, step = 1, onChange }: { label: string; value: number; min?: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className={styles.numberField}>
      <span>{label}</span>
      <input type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function sequenceCompletion(sequence: StorySequence) {
  const values = [sequence.question, sequence.promise, sequence.escalation, sequence.climax, sequence.turningPoint, sequence.result];
  return Math.round((values.filter((value) => value.trim()).length / values.length) * 100);
}

export default function StructureEnginePage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [sequenceNumber, setSequenceNumber] = useState(1);
  const [blockNumber, setBlockNumber] = useState(1);
  const [sceneNumber, setSceneNumber] = useState(1);
  const [miniNumber, setMiniNumber] = useState(1);
  const [runtimeDraft, setRuntimeDraft] = useState(120);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Loading the active PlotPickle project…");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setStatus("No saved project was found. A new 24/96 project is shown here.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) {
          setStatus("The saved project could not be upgraded. A blank project is shown instead.");
          return;
        }
        setProject(normalized);
        setRuntimeDraft(normalized.metadata.targetMinutes);
        setStatus(normalized.schemaVersion === "1.4.0"
          ? "Connected to the active PlotPickle project."
          : "Project upgraded to the current structure model.");
      } catch {
        setStatus("The saved project could not be opened. A blank project is shown instead.");
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const sequence = project.structure.sequences.find((item) => item.number === sequenceNumber) ?? project.structure.sequences[0];
  const sequenceBlocks = project.blocks.filter((block) => block.sequenceNumber === sequence.number);
  const block = project.blocks.find((item) => item.number === blockNumber && item.sequenceNumber === sequence.number) ?? sequenceBlocks[0];
  const scene = block.scenes.find((item) => item.number === sceneNumber) ?? block.scenes[0];
  const mini = scene.miniBlocks.find((item) => item.number === miniNumber) ?? scene.miniBlocks[0];

  const clock = useMemo(() => buildStoryClock(project), [project]);
  const totalBeats = useMemo(() => project.blocks.flatMap((item) => item.scenes).flatMap((item) => item.miniBlocks).reduce((sum, item) => sum + item.beatTarget, 0), [project]);
  const totalShots = useMemo(() => project.blocks.flatMap((item) => item.scenes).flatMap((item) => item.miniBlocks).reduce((sum, item) => sum + item.shotTarget, 0), [project]);
  const totalSeconds = useMemo(() => project.blocks.flatMap((item) => item.scenes).flatMap((item) => item.miniBlocks).reduce((sum, item) => sum + item.estimatedSeconds, 0), [project]);
  const actualAverageShot = totalShots ? totalSeconds / totalShots : 0;
  const selectedRows = clock.filter((row) => {
    if (row.level === "sequence") return row.id === sequence.id;
    return sequenceBlocks.some((item) => row.label.includes(`Block ${item.number}`) || row.label.startsWith(`B${item.number}.`));
  });

  function commit(next: PlotPickleProject, message = "Saved to this device.") {
    const updated: PlotPickleProject = {
      ...next,
      metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
    };
    setProject(updated);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setStatus(message);
  }

  function updateSequence(key: SequenceTextKey, value: string) {
    commit({
      ...project,
      structure: {
        ...project.structure,
        sequences: project.structure.sequences.map((item) => item.number === sequence.number ? { ...item, [key]: value } : item),
      },
    });
  }

  function updateScene(key: SceneTextKey, value: string) {
    updateBlockScenes((current) => current.map((item) => item.number === scene.number ? { ...item, [key]: value } : item));
  }

  function updateMini(key: MiniTextKey, value: string) {
    updateSceneMinis((current) => current.map((item) => item.number === mini.number ? { ...item, [key]: value } : item));
  }

  function updateMiniNumber(key: "estimatedSeconds" | "beatTarget" | "shotTarget", value: number) {
    updateSceneMinis((current) => current.map((item) => item.number === mini.number ? { ...item, [key]: Math.max(0, value || 0) } : item));
  }

  function updateSceneMinis(transform: (items: MiniBlock[]) => MiniBlock[]) {
    updateBlockScenes((current) => current.map((item) => item.number === scene.number ? { ...item, miniBlocks: transform(item.miniBlocks) } : item));
  }

  function updateBlockScenes(transform: (items: StoryScene[]) => StoryScene[]) {
    commit({
      ...project,
      blocks: project.blocks.map((item) => item.number === block.number ? { ...item, scenes: transform(item.scenes) } : item),
    });
  }

  function selectSequence(nextSequence: number) {
    const firstBlock = project.structure.sequences.find((item) => item.number === nextSequence)?.blockNumbers[0] ?? 1;
    setSequenceNumber(nextSequence);
    setBlockNumber(firstBlock);
    setSceneNumber(1);
    setMiniNumber(1);
  }

  function selectBlock(nextBlock: number) {
    setBlockNumber(nextBlock);
    setSceneNumber(1);
    setMiniNumber(1);
  }

  function rebalance() {
    const next = rebalanceStoryTiming(project, runtimeDraft);
    commit(next, `Rebalanced the full story clock to ${next.metadata.targetMinutes} minutes.`);
  }

  function updatePacing(profile: PacingProfile) {
    const average = pacingAverageShotSeconds(profile, project.structure.averageShotSeconds);
    commit({
      ...project,
      structure: { ...project.structure, pacingProfile: profile, averageShotSeconds: average },
    }, `Pacing profile changed to ${profile}. Beat and shot targets remain editable.`);
  }

  function exportProject() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plotpickle-project"}.plotpickle.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Project exported with sequences, scenes, mini-blocks, beats, shots, and timing.");
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>PlotPickle Playhouse · Complete structural hierarchy</p>
            <h1>Structure Engine</h1>
            <p>Navigate twelve sequences, develop forty-eight scenes and ninety-six mini-blocks, and keep the entire screenplay synchronized to a visible story clock.</p>
          </div>
          <div className={styles.actions}>
            <Link href="/" className={styles.secondary}>Back to PlotPickle</Link>
            <Link href="/craftloop" className={styles.secondary}>CraftLoop</Link>
            <Link href="/pageflow" className={styles.secondary}>PageFlow</Link>
            <button type="button" onClick={exportProject}>Export project</button>
          </div>
        </header>

        <section className={styles.dashboard}>
          <div><strong>4</strong><span>acts</span></div>
          <div><strong>12</strong><span>sequences</span></div>
          <div><strong>24</strong><span>blocks</span></div>
          <div><strong>{project.blocks.reduce((sum, item) => sum + item.scenes.length, 0)}</strong><span>scenes</span></div>
          <div><strong>{project.blocks.flatMap((item) => item.scenes).reduce((sum, item) => sum + item.miniBlocks.length, 0)}</strong><span>mini-blocks</span></div>
          <div><strong>{totalBeats}</strong><span>beat target</span></div>
          <div><strong>{totalShots}</strong><span>shot target</span></div>
          <div><strong>{actualAverageShot.toFixed(2)}s</strong><span>calculated ASL</span></div>
        </section>

        <section className={styles.clockControls}>
          <div>
            <p className={styles.kicker}>Story Clock</p>
            <h2>{secondsToTimecode(totalSeconds)} planned runtime</h2>
            <p>Rebalance changes timing allocations only. It does not overwrite story, scene, dialogue, or visual content.</p>
          </div>
          <NumberField label="Target minutes" value={runtimeDraft} min={1} step={1} onChange={setRuntimeDraft} />
          <label className={styles.selectField}>
            <span>Pacing profile</span>
            <select value={project.structure.pacingProfile} onChange={(event) => updatePacing(event.target.value as PacingProfile)}>
              <option value="original-24-96">Original 24/96 feature</option>
              <option value="contemplative">Contemplative</option>
              <option value="moderate">Moderate</option>
              <option value="propulsive">Propulsive</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <button type="button" onClick={rebalance}>Rebalance full timeline</button>
        </section>

        <section className={styles.sequenceSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>12-Sequence Navigator</p>
            <h2>Three dramatic movements inside every act.</h2>
          </div>
          <div className={styles.sequenceGrid}>
            {project.structure.sequences.map((item) => (
              <button type="button" key={item.id} onClick={() => selectSequence(item.number)} className={item.number === sequence.number ? styles.activeSequence : ""}>
                <span>Act {item.act} · Sequence {item.number}</span>
                <strong>{item.title}</strong>
                <small>Blocks {item.blockNumbers[0]}–{item.blockNumbers[1]} · {item.targetMinutes.toFixed(1)} min · {sequenceCompletion(item)}%</small>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.sequenceEditor}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Sequence {sequence.number} · Act {sequence.act}</p>
            <h2>{sequence.title}</h2>
            <p>{sequence.purpose}</p>
          </div>
          <div className={styles.twoColumns}>
            <Field label="Sequence title" value={sequence.title} onChange={(value) => updateSequence("title", value)} />
            <Field label="Purpose" value={sequence.purpose} onChange={(value) => updateSequence("purpose", value)} />
            <Field label="Question" help="What question or uncertainty becomes active across these two blocks?" value={sequence.question} onChange={(value) => updateSequence("question", value)} />
            <Field label="Promise" help="What dramatic experience or outcome does the sequence invite the audience to anticipate?" value={sequence.promise} onChange={(value) => updateSequence("promise", value)} />
            <Field label="Escalation" help="How does the second block make the sequence harder or more revealing?" value={sequence.escalation} onChange={(value) => updateSequence("escalation", value)} />
            <Field label="Climax" help="What is the sequence's highest-pressure moment?" value={sequence.climax} onChange={(value) => updateSequence("climax", value)} />
            <Field label="Turning point" help="What decision, revelation, reversal, or consequence changes direction?" value={sequence.turningPoint} onChange={(value) => updateSequence("turningPoint", value)} />
            <Field label="Result carried forward" help="What becomes newly true for the next sequence?" value={sequence.result} onChange={(value) => updateSequence("result", value)} />
          </div>
        </section>

        <section className={styles.builder}>
          <aside className={styles.navigator}>
            <p className={styles.kicker}>Blocks and scenes</p>
            {sequenceBlocks.map((item) => (
              <div key={item.id} className={styles.blockGroup}>
                <button type="button" onClick={() => selectBlock(item.number)} className={item.number === block.number ? styles.activeBlock : ""}>
                  <span>Block {item.number}</span>
                  <strong>{item.title}</strong>
                  <small>{item.targetMinutes.toFixed(1)} minutes</small>
                </button>
                {item.number === block.number ? item.scenes.map((sceneItem) => (
                  <button type="button" key={sceneItem.id} className={sceneItem.number === scene.number ? styles.activeScene : styles.sceneButton} onClick={() => { setSceneNumber(sceneItem.number); setMiniNumber(sceneItem.miniBlocks[0]?.number ?? 1); }}>
                    Scene {sceneItem.number} · {Math.round(sceneItem.estimatedSeconds)}s
                  </button>
                )) : null}
              </div>
            ))}
          </aside>

          <div className={styles.sceneWorkspace}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Block {block.number} · Scene {scene.number}</p>
              <h2>{scene.title}</h2>
              <p>{scene.purpose}</p>
            </div>
            <div className={styles.twoColumns}>
              <Field label="Scene title" value={scene.title} onChange={(value) => updateScene("title", value)} />
              <Field label="Scene purpose" value={scene.purpose} onChange={(value) => updateScene("purpose", value)} />
              <Field label="Objective" value={scene.objective} onChange={(value) => updateScene("objective", value)} />
              <Field label="Conflict" value={scene.conflict} onChange={(value) => updateScene("conflict", value)} />
              <Field label="Turn or reversal" value={scene.turn} onChange={(value) => updateScene("turn", value)} />
              <Field label="Resolution" value={scene.resolution} onChange={(value) => updateScene("resolution", value)} />
              <Field label="Outcome carried forward" value={scene.outcome} onChange={(value) => updateScene("outcome", value)} />
            </div>

            <div className={styles.miniTabs}>
              {scene.miniBlocks.map((item) => (
                <button type="button" key={item.id} onClick={() => setMiniNumber(item.number)} className={item.number === mini.number ? styles.activeMini : ""}>
                  <span>B{block.number}.{item.number}</span>
                  <strong>{item.label}</strong>
                  <small>{Math.round(item.estimatedSeconds)}s · {item.beatTarget} beats · {item.shotTarget} shots</small>
                </button>
              ))}
            </div>

            <div className={styles.miniEditor}>
              <div className={styles.sectionHeading}>
                <p className={styles.kicker}>Mini-block B{block.number}.{mini.number}</p>
                <h2>{mini.label}</h2>
                <p>{mini.function}</p>
              </div>
              <div className={styles.metricInputs}>
                <NumberField label="Seconds" value={mini.estimatedSeconds} min={0} step={5} onChange={(value) => updateMiniNumber("estimatedSeconds", value)} />
                <NumberField label="Beat target" value={mini.beatTarget} min={0} onChange={(value) => updateMiniNumber("beatTarget", value)} />
                <NumberField label="Shot target" value={mini.shotTarget} min={0} onChange={(value) => updateMiniNumber("shotTarget", value)} />
                <label className={styles.selectField}>
                  <span>Active character</span>
                  <select value={mini.characterId} onChange={(event) => updateMini("characterId", event.target.value)}>
                    <option value="">Not assigned</option>
                    {project.characters.map((character) => <option value={character.id} key={character.id}>{character.name}</option>)}
                  </select>
                </label>
              </div>
              <div className={styles.twoColumns}>
                <Field label="Label" value={mini.label} onChange={(value) => updateMini("label", value)} />
                <Field label="Structural function" value={mini.function} onChange={(value) => updateMini("function", value)} />
                <Field label="Purpose" value={mini.purpose} onChange={(value) => updateMini("purpose", value)} />
                <Field label="Objective" value={mini.objective} onChange={(value) => updateMini("objective", value)} />
                <Field label="Resistance" value={mini.resistance} onChange={(value) => updateMini("resistance", value)} />
                <Field label="Action" value={mini.action} onChange={(value) => updateMini("action", value)} />
                <Field label="Revelation or new information" value={mini.revelation} onChange={(value) => updateMini("revelation", value)} />
                <Field label="Turn" value={mini.turn} onChange={(value) => updateMini("turn", value)} />
                <Field label="Entry state" value={mini.entryState} onChange={(value) => updateMini("entryState", value)} />
                <Field label="Exit state" value={mini.exitState} onChange={(value) => updateMini("exitState", value)} />
                <Field label="Visual beat" value={mini.visualBeat} onChange={(value) => updateMini("visualBeat", value)} />
                <Field label="Dialogue intention" value={mini.dialogueIntention} onChange={(value) => updateMini("dialogueIntention", value)} />
                <Field label="Setup" value={mini.setup} onChange={(value) => updateMini("setup", value)} />
                <Field label="Payoff" value={mini.payoff} onChange={(value) => updateMini("payoff", value)} />
                <Field label="Notes" value={mini.notes} rows={6} onChange={(value) => updateMini("notes", value)} />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.timeline}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Sequence {sequence.number} timeline</p>
            <h2>See when every unit begins and ends.</h2>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Level</th><th>Unit</th><th>Start</th><th>End</th><th>Duration</th><th>Beats</th><th>Shots</th></tr></thead>
              <tbody>
                {selectedRows.map((row) => (
                  <tr key={`${row.level}-${row.id}`}>
                    <td>{row.level}</td>
                    <td>{row.label}</td>
                    <td>{secondsToTimecode(row.startSeconds)}</td>
                    <td>{secondsToTimecode(row.endSeconds)}</td>
                    <td>{Math.round(row.durationSeconds)}s</td>
                    <td>{row.beats}</td>
                    <td>{row.shots}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className={styles.status} aria-live="polite">{hydrated ? status : "Loading the active PlotPickle project…"}</p>
      </div>
    </main>
  );
}
