"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type PlotPickleProject,
} from "@/lib/project";
import {
  addDynamicScene,
  addShortSceneToMini,
  assignMiniBlockToScene,
  buildStoryClock,
  duplicateDynamicScene,
  moveDynamicScene,
  moveSceneBetweenBlocks,
  pacingAverageShotSeconds,
  rebalanceStoryTiming,
  removeDynamicScene,
  removeShortSceneFromMini,
  secondsToTimecode,
  updateShortSceneInMini,
  type MiniBlock,
  type PacingProfile,
  type SceneType,
  type ShortScene,
  type StoryScene,
  type StorySequence,
} from "@/lib/structure";
import {
  analyzeSceneStructure,
  buildGlobalSceneIndex,
  synchronizeScreenplaySceneReferences,
} from "@/lib/scene-management";
import styles from "./structure.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const sceneTypes: SceneType[] = ["action", "dialogue", "suspense", "revelation", "montage", "transition", "other"];

type SequenceTextKey = "title" | "purpose" | "question" | "promise" | "escalation" | "climax" | "turningPoint" | "result";
type SceneTextKey = "title" | "purpose" | "entryCondition" | "exitCondition" | "objective" | "opposition" | "conflict" | "action" | "reversal" | "turn" | "resolution" | "outcome";
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

function CharacterChecklist({
  label,
  characterIds,
  project,
  onToggle,
}: {
  label: string;
  characterIds: string[];
  project: PlotPickleProject;
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className={styles.characterChecklist}>
      <legend>{label}</legend>
      {project.characters.length ? project.characters.map((character) => (
        <label key={character.id}>
          <input type="checkbox" checked={characterIds.includes(character.id)} onChange={() => onToggle(character.id)} />
          <span>{character.name}</span>
        </label>
      )) : <small>Add characters in Story Planner before assigning entrances and exits.</small>}
    </fieldset>
  );
}

function selectedOrFirst<T extends { id: string }>(items: T[], selectedId: string) {
  return items.find((item) => item.id === selectedId) ?? items[0];
}

export default function StructureEnginePage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [sequenceNumber, setSequenceNumber] = useState(1);
  const [blockNumber, setBlockNumber] = useState(1);
  const [sceneId, setSceneId] = useState("");
  const [miniId, setMiniId] = useState("");
  const [shortSceneId, setShortSceneId] = useState("");
  const [moveTargetBlock, setMoveTargetBlock] = useState(2);
  const [runtimeDraft, setRuntimeDraft] = useState(120);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Loading the active PlotPickle project…");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          const blank = createBlankProject();
          setProject(blank);
          setSceneId(blank.blocks[0].scenes[0].id);
          setMiniId(blank.blocks[0].scenes[0].miniBlocks[0].id);
          setStatus("No saved project was found. The flexible 48-scene starting template is shown here.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) {
          setStatus("The saved project could not be upgraded. A blank project is shown instead.");
          return;
        }
        const synchronized = synchronizeScreenplaySceneReferences(normalized, normalized.blocks);
        setProject(synchronized);
        setRuntimeDraft(synchronized.metadata.targetMinutes);
        setSceneId(synchronized.blocks[0].scenes[0].id);
        setMiniId(synchronized.blocks[0].scenes[0].miniBlocks[0]?.id ?? "");
        setStatus("Connected to the active PlotPickle project. Scene counts are flexible in every block.");
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
  const block = project.blocks.find((item) => item.number === blockNumber) ?? sequenceBlocks[0] ?? project.blocks[0];
  const scene = selectedOrFirst(block.scenes, sceneId);
  const mini = scene ? selectedOrFirst(scene.miniBlocks, miniId) : undefined;
  const shortScene = mini ? selectedOrFirst(mini.shortScenes, shortSceneId) : undefined;

  const sceneIndex = useMemo(() => buildGlobalSceneIndex(project.blocks), [project.blocks]);
  const diagnostics = useMemo(() => analyzeSceneStructure(project), [project]);
  const sceneEntry = sceneIndex.find((entry) => entry.sceneId === scene.id);
  const globalSceneNumber = sceneEntry?.globalNumber ?? 1;
  const clock = useMemo(() => buildStoryClock(project), [project]);
  const allScenes = useMemo(() => project.blocks.flatMap((item) => item.scenes), [project]);
  const allMinis = useMemo(() => allScenes.flatMap((item) => item.miniBlocks), [allScenes]);
  const totalBeats = useMemo(() => allMinis.reduce((sum, item) => sum + item.beatTarget, 0), [allMinis]);
  const totalShots = useMemo(() => allMinis.reduce((sum, item) => sum + item.shotTarget, 0), [allMinis]);
  const totalSeconds = useMemo(() => allMinis.reduce((sum, item) => sum + item.estimatedSeconds, 0), [allMinis]);
  const totalShortScenes = useMemo(() => allMinis.reduce((sum, item) => sum + item.shortScenes.length, 0), [allMinis]);
  const actualAverageShot = totalShots ? totalSeconds / totalShots : 0;
  const selectedRows = clock.filter((row) => {
    if (row.level === "sequence") return row.id === sequence.id;
    return sequenceBlocks.some((item) => row.label.includes(`Block ${item.number}`) || row.label.startsWith(`B${item.number}.`));
  });

  function commit(next: PlotPickleProject, message = "Saved to this device.") {
    const synchronized = synchronizeScreenplaySceneReferences(next, project.blocks);
    const updated: PlotPickleProject = {
      ...synchronized,
      metadata: { ...synchronized.metadata, updatedAt: new Date().toISOString() },
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

  function updateBlockScenes(transform: (items: StoryScene[]) => StoryScene[], message?: string) {
    commit({
      ...project,
      blocks: project.blocks.map((item) => item.number === block.number ? { ...item, scenes: transform(item.scenes) } : item),
    }, message);
  }

  function updateScene(key: SceneTextKey, value: string) {
    updateBlockScenes((current) => current.map((item) => item.id === scene.id
      ? {
          ...item,
          [key]: value,
          ...(key === "opposition" ? { conflict: value } : {}),
          ...(key === "conflict" ? { opposition: value } : {}),
          ...(key === "reversal" ? { turn: value } : {}),
          ...(key === "turn" ? { reversal: value } : {}),
        }
      : item));
  }

  function updateSceneType(value: SceneType) {
    updateBlockScenes((current) => current.map((item) => item.id === scene.id ? { ...item, sceneType: value } : item));
  }

  function updateSceneTiming(key: "estimatedSeconds" | "pageEstimate", value: number) {
    const safe = Math.max(0, value || 0);
    updateBlockScenes((current) => current.map((item) => {
      if (item.id !== scene.id) return item;
      if (key === "pageEstimate") return { ...item, pageEstimate: safe };
      const duration = safe;
      const count = item.miniBlocks.length;
      return {
        ...item,
        estimatedSeconds: duration,
        pageEstimate: duration / 60,
        miniBlocks: count ? item.miniBlocks.map((assigned) => ({ ...assigned, estimatedSeconds: duration / count })) : item.miniBlocks,
      };
    }), "Scene duration and assigned mini-block timing updated.");
  }

  function toggleSceneCharacter(key: "characterIds" | "charactersEntering" | "charactersLeaving", characterId: string) {
    updateBlockScenes((current) => current.map((item) => {
      if (item.id !== scene.id) return item;
      const values = item[key].includes(characterId) ? item[key].filter((id) => id !== characterId) : [...item[key], characterId];
      const characterIds = key === "characterIds" ? values : [...new Set([...item.characterIds, characterId])];
      return { ...item, [key]: values, characterIds };
    }));
  }

  function updateSceneMinis(transform: (items: MiniBlock[]) => MiniBlock[], message?: string) {
    updateBlockScenes((current) => current.map((item) => item.id === scene.id ? { ...item, miniBlocks: transform(item.miniBlocks) } : item), message);
  }

  function updateMini(key: MiniTextKey, value: string) {
    if (!mini) return;
    updateSceneMinis((current) => current.map((item) => item.id === mini.id ? { ...item, [key]: value } : item));
  }

  function updateMiniNumber(key: "estimatedSeconds" | "beatTarget" | "shotTarget", value: number) {
    if (!mini) return;
    updateSceneMinis((current) => current.map((item) => item.id === mini.id ? { ...item, [key]: Math.max(0, value || 0) } : item));
  }

  function addScene() {
    const nextScenes = addDynamicScene(block.scenes, block.number, scene.id);
    const created = nextScenes.find((item) => !block.scenes.some((existing) => existing.id === item.id));
    updateBlockScenes(() => nextScenes, created?.miniBlocks.length
      ? "Scene added and assigned a mini-block from the most flexible neighbouring scene."
      : "Scene added without a mini-block. Reassign a mini-block or use a short scene inside an existing mini-block.");
    if (created) {
      setSceneId(created.id);
      setMiniId(created.miniBlocks[0]?.id ?? "");
    }
  }

  function duplicateScene() {
    const nextScenes = duplicateDynamicScene(block.scenes, scene.id, block.number);
    const created = nextScenes.find((item) => !block.scenes.some((existing) => existing.id === item.id));
    updateBlockScenes(() => nextScenes, "Scene duplicated. Its story content was copied without duplicating a structural mini-block.");
    if (created) {
      setSceneId(created.id);
      setMiniId(created.miniBlocks[0]?.id ?? "");
    }
  }

  function deleteScene() {
    if (block.scenes.length <= 1) {
      setStatus("Every block must retain at least one scene.");
      return;
    }
    const index = block.scenes.findIndex((item) => item.id === scene.id);
    const nextScenes = removeDynamicScene(block.scenes, scene.id);
    const nextScene = nextScenes[Math.max(0, Math.min(index - 1, nextScenes.length - 1))];
    updateBlockScenes(() => nextScenes, "Scene removed. Its mini-blocks were preserved and reassigned to a neighbouring scene.");
    setSceneId(nextScene.id);
    setMiniId(nextScene.miniBlocks[0]?.id ?? "");
  }

  function reorderScene(direction: "up" | "down") {
    const nextScenes = moveDynamicScene(block.scenes, scene.id, direction);
    updateBlockScenes(() => nextScenes, `Scene moved ${direction} within Block ${block.number}.`);
  }

  function moveSceneToAnotherBlock() {
    if (moveTargetBlock === block.number) {
      setStatus("Choose a different target block.");
      return;
    }
    if (block.scenes.length <= 1) {
      setStatus("A block cannot be left without a scene.");
      return;
    }
    const target = project.blocks.find((item) => item.number === moveTargetBlock);
    if (!target) return;
    const nextBlocks = moveSceneBetweenBlocks(project.blocks, scene.id, moveTargetBlock);
    commit({ ...project, blocks: nextBlocks }, `Scene moved from Block ${block.number} to Block ${moveTargetBlock}. Its original mini-blocks remained with the source block.`);
    setSequenceNumber(target.sequenceNumber);
    setBlockNumber(target.number);
    setSceneId(scene.id);
    const moved = nextBlocks.find((item) => item.number === target.number)?.scenes.find((item) => item.id === scene.id);
    setMiniId(moved?.miniBlocks[0]?.id ?? "");
  }

  function reassignMini(miniBlockId: string, targetSceneId: string) {
    const nextScenes = assignMiniBlockToScene(block.scenes, miniBlockId, targetSceneId);
    updateBlockScenes(() => nextScenes, "Mini-block assignment updated.");
    if (targetSceneId === scene.id) setMiniId(miniBlockId);
  }

  function addShortScene() {
    if (!mini) return;
    const updatedMini = addShortSceneToMini(mini);
    const created = updatedMini.shortScenes.at(-1);
    updateSceneMinis((items) => items.map((item) => item.id === mini.id ? updatedMini : item), "Short scene added inside the selected mini-block.");
    if (created) setShortSceneId(created.id);
  }

  function updateShortScene(patch: Partial<ShortScene>) {
    if (!mini || !shortScene) return;
    updateSceneMinis((items) => items.map((item) => item.id === mini.id ? updateShortSceneInMini(item, shortScene.id, patch) : item));
  }

  function deleteShortScene() {
    if (!mini || !shortScene) return;
    const remaining = mini.shortScenes.filter((item) => item.id !== shortScene.id);
    updateSceneMinis((items) => items.map((item) => item.id === mini.id ? removeShortSceneFromMini(item, shortScene.id) : item), "Short scene removed.");
    setShortSceneId(remaining[0]?.id ?? "");
  }

  function selectSequence(nextSequence: number) {
    const firstBlock = project.structure.sequences.find((item) => item.number === nextSequence)?.blockNumbers[0] ?? 1;
    const nextBlock = project.blocks[firstBlock - 1];
    setSequenceNumber(nextSequence);
    setBlockNumber(firstBlock);
    setSceneId(nextBlock.scenes[0].id);
    setMiniId(nextBlock.scenes[0].miniBlocks[0]?.id ?? "");
    setShortSceneId("");
    setMoveTargetBlock(firstBlock === 24 ? 23 : firstBlock + 1);
  }

  function selectBlock(nextBlockNumber: number) {
    const nextBlock = project.blocks[nextBlockNumber - 1];
    setSequenceNumber(nextBlock.sequenceNumber);
    setBlockNumber(nextBlockNumber);
    setSceneId(nextBlock.scenes[0].id);
    setMiniId(nextBlock.scenes[0].miniBlocks[0]?.id ?? "");
    setShortSceneId("");
    setMoveTargetBlock(nextBlockNumber === 24 ? 23 : nextBlockNumber + 1);
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
    setStatus("Project exported with flexible scenes, mini-block assignments, short scenes, beats, shots, and timing.");
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>PlotPickle Playhouse · Flexible dramatic hierarchy</p>
            <h1>Structure Engine</h1>
            <p>Start with forty-eight scenes, then add, remove, duplicate, reorder or move scenes until the structure matches the film. The template is guidance, not a restriction.</p>
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
          <div><strong>{allScenes.length}</strong><span>scenes</span></div>
          <div><strong>{project.storyThreads.length}</strong><span>story threads</span></div>
          <div><strong>{allMinis.length}</strong><span>mini-blocks</span></div>
          <div><strong>{totalShortScenes}</strong><span>short scenes</span></div>
          <div><strong>{totalShots}</strong><span>shot target</span></div>
          <div><strong>{actualAverageShot.toFixed(2)}s</strong><span>calculated ASL</span></div>
        </section>

        <section className={styles.templateNote}>
          <div><span>Starting template</span><strong>48 scenes</strong></div>
          <p>A feature often lands around forty to sixty scenes. PlotPickle keeps two scenes per block only as the initial distribution; each block may contain one or more scenes, and each mini-block may hold multiple short scenes.</p>
        </section>

        <section className={styles.templateNote}>
          <div><span>Selected scene threads</span><strong>{scene.threadIds.length}</strong></div>
          <p>{project.storyThreads.length ? "Assign structural scenes to the main plot, subplots, relationships, mysteries, thematic arguments or world pressures." : "Create Story Threads in Story Planner → Core Model, then return here to see their structural coverage."}</p>
          {project.storyThreads.length ? <div>{project.storyThreads.map((thread) => <label key={thread.id} style={{ marginRight: "1rem" }}><input type="checkbox" checked={scene.threadIds.includes(thread.id)} onChange={() => updateBlockScenes((current) => current.map((item) => item.id === scene.id ? { ...item, threadIds: item.threadIds.includes(thread.id) ? item.threadIds.filter((id) => id !== thread.id) : [...item.threadIds, thread.id] } : item), "Scene thread assignments updated.")} /> {thread.name}</label>)}</div> : null}
        </section>

        <section className={styles.sceneDiagnostics} aria-labelledby="scene-health-title">
          <div className={styles.diagnosticLead}>
            <p className={styles.kicker}>Scene health</p>
            <h2 id="scene-health-title">{diagnostics.totalScenes} scenes · {diagnostics.totalPages.toFixed(1)} estimated pages</h2>
            <p>
              {diagnostics.targetRange === "within"
                ? "The current scene count is inside the common forty-to-sixty scene feature range."
                : diagnostics.targetRange === "below"
                  ? "The current scene count is below the common feature range. Add scenes only where the story needs a distinct objective or turn."
                  : "The current scene count is above the common feature range. Combine scenes only when their objectives and turns genuinely belong together."}
            </p>
          </div>
          <div className={styles.diagnosticGrid}>
            <article data-alert={diagnostics.unassignedSceneIds.length ? "true" : "false"}><span>Unassigned scenes</span><strong>{diagnostics.unassignedSceneIds.length}</strong><small>Scenes without a structural mini-block</small></article>
            <article data-alert={diagnostics.blocksWithMiniBlockErrors.length ? "true" : "false"}><span>Mini-block errors</span><strong>{diagnostics.blocksWithMiniBlockErrors.length}</strong><small>Blocks that do not contain one copy of mini-blocks 1–4</small></article>
            <article data-alert={diagnostics.continuityWarnings.length ? "true" : "false"}><span>Continuity notices</span><strong>{diagnostics.continuityWarnings.length}</strong><small>Entrances or departures that need review</small></article>
            <article><span>Planned runtime</span><strong>{secondsToTimecode(diagnostics.totalSeconds)}</strong><small>Calculated from current scene assignments</small></article>
          </div>
          {diagnostics.continuityWarnings.length ? (
            <details className={styles.continuityDetails}>
              <summary>Review character entrances and departures</summary>
              <ul>{diagnostics.continuityWarnings.slice(0, 12).map((warning, index) => {
                const character = project.characters.find((item) => item.id === warning.characterId);
                return <li key={`${warning.sceneId}-${warning.kind}-${warning.characterId}-${index}`}><strong>{character?.name ?? "Character"}</strong><span>{warning.message}</span></li>;
              })}</ul>
            </details>
          ) : null}
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
            <div className={styles.navigatorHeading}>
              <div><p className={styles.kicker}>Blocks and scenes</p><small>{allScenes.length} total scenes</small></div>
              <button type="button" className={styles.addSceneButton} onClick={addScene}>+ Scene</button>
            </div>
            {sequenceBlocks.map((item) => (
              <div key={item.id} className={styles.blockGroup}>
                <button type="button" onClick={() => selectBlock(item.number)} className={item.number === block.number ? styles.activeBlock : ""}>
                  <span>Block {item.number}</span>
                  <strong>{item.title}</strong>
                  <small>{item.scenes.length} scene{item.scenes.length === 1 ? "" : "s"} · {item.targetMinutes.toFixed(1)} minutes</small>
                </button>
                {item.number === block.number ? item.scenes.map((sceneItem) => {
                  const indexed = sceneIndex.find((entry) => entry.sceneId === sceneItem.id);
                  return (
                    <button type="button" key={sceneItem.id} className={sceneItem.id === scene.id ? styles.activeScene : styles.sceneButton} onClick={() => { setSceneId(sceneItem.id); setMiniId(sceneItem.miniBlocks[0]?.id ?? ""); setShortSceneId(""); }}>
                      <span>{sceneItem.sceneType}</span>
                      <strong>Scene {indexed?.globalNumber ?? sceneItem.number}</strong>
                      <small>Block {item.number}.{sceneItem.number} · {sceneItem.miniBlocks.length} mini · {sceneItem.pageEstimate.toFixed(1)} pages</small>
                    </button>
                  );
                }) : null}
              </div>
            ))}
          </aside>

          <div className={styles.sceneWorkspace}>
            <div className={styles.sceneHeader}>
              <div className={styles.sectionHeading}>
                <p className={styles.kicker}>Global Scene {globalSceneNumber} · Block {block.number}.{scene.number}</p>
                <h2>{scene.title}</h2>
                <p>{scene.purpose}</p>
              </div>
              <div className={styles.sceneActions}>
                <button type="button" onClick={() => reorderScene("up")} disabled={scene.number === 1}>Move up</button>
                <button type="button" onClick={() => reorderScene("down")} disabled={scene.number === block.scenes.length}>Move down</button>
                <button type="button" onClick={duplicateScene}>Duplicate</button>
                <button type="button" onClick={addScene}>Add after</button>
                <button type="button" className={styles.dangerButton} onClick={deleteScene} disabled={block.scenes.length <= 1}>Delete</button>
              </div>
            </div>

            <div className={styles.sceneMetrics}>
              <label className={styles.selectField}>
                <span>Scene type</span>
                <select value={scene.sceneType} onChange={(event) => updateSceneType(event.target.value as SceneType)}>
                  {sceneTypes.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
                </select>
              </label>
              <NumberField label="Duration seconds" value={scene.estimatedSeconds} min={0} step={5} onChange={(value) => updateSceneTiming("estimatedSeconds", value)} />
              <NumberField label="Page estimate" value={scene.pageEstimate} min={0} step={0.1} onChange={(value) => updateSceneTiming("pageEstimate", value)} />
              <div className={styles.assignmentSignal} data-alert={scene.miniBlocks.length === 0 ? "true" : "false"}>
                <span>Mini-block assignment</span>
                <strong>{scene.miniBlocks.length} of 4</strong>
                <small>{scene.miniBlocks.length ? "Assigned to this scene" : "Assign a mini-block or use a short scene"}</small>
              </div>
            </div>

            <div className={styles.twoColumns}>
              <Field label="Scene title" value={scene.title} onChange={(value) => updateScene("title", value)} />
              <Field label="Scene purpose" value={scene.purpose} onChange={(value) => updateScene("purpose", value)} />
              <Field label="Entry condition" help="What is true emotionally, physically, and informationally when the scene begins?" value={scene.entryCondition} onChange={(value) => updateScene("entryCondition", value)} />
              <Field label="Exit condition" help="What has changed by the cut?" value={scene.exitCondition} onChange={(value) => updateScene("exitCondition", value)} />
              <Field label="Objective" value={scene.objective} onChange={(value) => updateScene("objective", value)} />
              <Field label="Opposition" value={scene.opposition} onChange={(value) => updateScene("opposition", value)} />
              <Field label="Action" value={scene.action} onChange={(value) => updateScene("action", value)} />
              <Field label="Reversal or turn" value={scene.reversal} onChange={(value) => updateScene("reversal", value)} />
              <Field label="Resolution" value={scene.resolution} onChange={(value) => updateScene("resolution", value)} />
              <Field label="Outcome carried forward" value={scene.outcome} onChange={(value) => updateScene("outcome", value)} />
            </div>

            <div className={styles.characterMovement}>
              <CharacterChecklist label="Characters in scene" characterIds={scene.characterIds} project={project} onToggle={(id) => toggleSceneCharacter("characterIds", id)} />
              <CharacterChecklist label="Characters entering" characterIds={scene.charactersEntering} project={project} onToggle={(id) => toggleSceneCharacter("charactersEntering", id)} />
              <CharacterChecklist label="Characters leaving" characterIds={scene.charactersLeaving} project={project} onToggle={(id) => toggleSceneCharacter("charactersLeaving", id)} />
            </div>

            <section className={styles.moveScenePanel}>
              <div><span>Move between blocks</span><p>The scene moves as story content. Its original mini-blocks stay with the source block, and PlotPickle assigns a spare mini-block in the target when one is available.</p></div>
              <label className={styles.selectField}>
                <span>Target block</span>
                <select value={moveTargetBlock} onChange={(event) => setMoveTargetBlock(Number(event.target.value))}>
                  {project.blocks.filter((item) => item.number !== block.number).map((item) => <option key={item.id} value={item.number}>Block {item.number} · {item.title}</option>)}
                </select>
              </label>
              <button type="button" onClick={moveSceneToAnotherBlock}>Move scene</button>
            </section>

            <section className={styles.assignmentPanel}>
              <div className={styles.sectionHeading}>
                <p className={styles.kicker}>Four structural mini-blocks in Block {block.number}</p>
                <h2>Assign one to four mini-blocks to a scene.</h2>
                <p>Mini-blocks remain unique structural anchors. Reassigning one moves it from its current scene rather than duplicating it.</p>
              </div>
              <div className={styles.assignmentGrid}>
                {block.scenes.flatMap((owner) => owner.miniBlocks.map((assigned) => ({ owner, assigned }))).sort((left, right) => left.assigned.number - right.assigned.number).map(({ owner, assigned }) => (
                  <article key={assigned.id}>
                    <div><span>B{block.number}.{assigned.number}</span><strong>{assigned.label}</strong><small>Currently Scene {owner.number}</small></div>
                    <label className={styles.selectField}>
                      <span>Assign to</span>
                      <select value={owner.id} onChange={(event) => reassignMini(assigned.id, event.target.value)}>
                        {block.scenes.map((candidate) => <option key={candidate.id} value={candidate.id}>Scene {candidate.number} · {candidate.title}</option>)}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            </section>

            {scene.miniBlocks.length ? (
              <>
                <div className={styles.miniTabs}>
                  {scene.miniBlocks.map((item) => (
                    <button type="button" key={item.id} onClick={() => { setMiniId(item.id); setShortSceneId(item.shortScenes[0]?.id ?? ""); }} className={item.id === mini?.id ? styles.activeMini : ""}>
                      <span>B{block.number}.{item.number}</span>
                      <strong>{item.label}</strong>
                      <small>{Math.round(item.estimatedSeconds)}s · {item.beatTarget} beats · {item.shortScenes.length} short scenes</small>
                    </button>
                  ))}
                </div>

                {mini ? (
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

                    <section className={styles.shortScenePanel}>
                      <div className={styles.shortSceneHeading}>
                        <div><p className={styles.kicker}>Rapid scenes inside this mini-block</p><h3>Use short scenes for montage, intercutting, transitions, or several brief locations.</h3></div>
                        <button type="button" onClick={addShortScene}>+ Add short scene</button>
                      </div>
                      {mini.shortScenes.length ? (
                        <div className={styles.shortSceneWorkspace}>
                          <div className={styles.shortSceneTabs}>
                            {mini.shortScenes.map((item, index) => (
                              <button type="button" key={item.id} className={item.id === shortScene?.id ? styles.activeShortScene : ""} onClick={() => setShortSceneId(item.id)}>
                                <span>{index + 1}</span><strong>{item.title}</strong><small>{item.sceneType} · {item.estimatedSeconds}s</small>
                              </button>
                            ))}
                          </div>
                          {shortScene ? (
                            <div className={styles.shortSceneEditor}>
                              <div className={styles.shortSceneMetrics}>
                                <label className={styles.selectField}><span>Type</span><select value={shortScene.sceneType} onChange={(event) => updateShortScene({ sceneType: event.target.value as SceneType })}>{sceneTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                                <NumberField label="Seconds" value={shortScene.estimatedSeconds} min={0} step={1} onChange={(value) => updateShortScene({ estimatedSeconds: value, pageEstimate: value / 60 })} />
                                <NumberField label="Pages" value={shortScene.pageEstimate} min={0} step={0.1} onChange={(value) => updateShortScene({ pageEstimate: value })} />
                                <button type="button" className={styles.dangerButton} onClick={deleteShortScene}>Delete short scene</button>
                              </div>
                              <div className={styles.twoColumns}>
                                <Field label="Short scene title" value={shortScene.title} onChange={(value) => updateShortScene({ title: value })} />
                                <Field label="Entry condition" value={shortScene.entryCondition} onChange={(value) => updateShortScene({ entryCondition: value })} />
                                <Field label="Objective" value={shortScene.objective} onChange={(value) => updateShortScene({ objective: value })} />
                                <Field label="Opposition" value={shortScene.opposition} onChange={(value) => updateShortScene({ opposition: value })} />
                                <Field label="Action" value={shortScene.action} onChange={(value) => updateShortScene({ action: value })} />
                                <Field label="Reversal" value={shortScene.reversal} onChange={(value) => updateShortScene({ reversal: value })} />
                                <Field label="Outcome" value={shortScene.outcome} onChange={(value) => updateShortScene({ outcome: value })} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : <p className={styles.emptyShortScene}>No short scenes are required. The mini-block may remain one continuous scene.</p>}
                    </section>
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.unassignedScene}>
                <strong>This scene is not assigned to a mini-block.</strong>
                <p>Move one of Block {block.number}&apos;s four mini-blocks to this scene, or represent the material as a short scene inside the appropriate mini-block.</p>
              </div>
            )}
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
