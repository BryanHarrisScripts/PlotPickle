"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  normalizePlotPickleProject,
  type ArcCheckpointKind,
  type Character,
  type PlotPickleProject,
  type Relationship,
} from "@/lib/project";
import {
  characterArcShapes,
  characterQuestionsForContext,
  type CharacterArcShape,
} from "../learning-characters-in-motion";
import styles from "./characters-in-motion.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const checkpointKinds: ArcCheckpointKind[] = ["opening", "catalyst", "threshold", "midpoint", "crisis", "climax", "ending", "custom"];

const fieldGuides = [
  { term: "Conscious want", differs: "The visible result pursued now, not the deeper truth required for change.", question: "What objective would make the want observable in the selected scene?", evidence: "Block goal, scene objective, mini-block objective or pursued screenplay action." },
  { term: "Underlying need", differs: "An internal truth or capacity, not a second external goal.", question: "Which costly choice would require this truth rather than merely state it?", evidence: "Crisis, climax, ending behaviour or repeated changed strategy." },
  { term: "Ghost", differs: "A formative condition that still acts in the present, not biography for its own sake.", question: "What does the character notice, fear, withhold or control because of it?", evidence: "Triggered behaviour, access, refusal, skill, relationship tactic or consequence." },
  { term: "Protective lie", differs: "The belief that makes the current strategy feel necessary, not a moral insult.", question: "What evidence makes the lie reasonable to this character?", evidence: "Opening strategy, repeated tactic and the pressure that eventually exposes its limits." },
  { term: "Emerging truth", differs: "A tested understanding, not a lesson delivered by another character.", question: "Which event makes the truth actionable rather than merely understandable?", evidence: "Midpoint reinterpretation, crisis options, climax proof and ending state." },
  { term: "Strength and liability", differs: "The same capacity under different conditions, not separate praise and criticism lists.", question: "Where does a useful strength begin creating cost?", evidence: "A successful tactic that later damages an objective, relationship or value." },
  { term: "Choice evidence", differs: "A decision among live options, not an emotion or a plot event that happens to the character.", question: "What could they genuinely do instead, and what would each option cost?", evidence: "Block choice, scene action or refusal, reversal, outcome and consequence." },
  { term: "Relationship impact", differs: "How one person's change forces adaptation in another, not a shared relationship summary.", question: "What changes in trust, status, debt, access or dependence?", evidence: "Reciprocal relationship records, shared scenes and linked checkpoints." },
  { term: "Voiceprint", differs: "A responsive language and behaviour system, not accent or demographic shorthand.", question: "How does rhythm, vocabulary or silence change under this relationship pressure?", evidence: "Character cues, dialogue elements, interruptions, silence, status shifts and action." },
] as const;

function clean(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fallbackCheckpoint(blockNumber: number): ArcCheckpointKind {
  if (blockNumber <= 2) return "opening";
  if (blockNumber <= 4) return "catalyst";
  if (blockNumber <= 7) return "threshold";
  if (blockNumber <= 13) return "midpoint";
  if (blockNumber <= 19) return "crisis";
  if (blockNumber <= 22) return "climax";
  return "ending";
}

function relationshipFor(character: Character, otherId: string): Relationship | undefined {
  return character.relationships.find((relationship) => relationship.characterId === otherId);
}

function filled(values: string[]) {
  return values.filter((value) => value.trim()).length;
}

export default function CharactersInMotionPage() {
  const [project, setProject] = useState<PlotPickleProject | null>(null);
  const [characterId, setCharacterId] = useState("");
  const [blockNumber, setBlockNumber] = useState(1);
  const [sceneId, setSceneId] = useState("");
  const [checkpointKind, setCheckpointKind] = useState<ArcCheckpointKind>("opening");
  const [arcShape, setArcShape] = useState<CharacterArcShape>("custom");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setNotice("No saved PlotPickle project was found on this device. Open the main workspace and save or import a project first.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) throw new Error("invalid-project");
        const params = new URLSearchParams(window.location.search);
        const requestedBlock = Math.min(24, Math.max(1, Number(params.get("block") || 1)));
        const requestedCharacter = params.get("character");
        const initialCharacter = normalized.characters.find((item) => item.id === requestedCharacter) ?? normalized.characters[0];
        setProject(normalized);
        setCharacterId(initialCharacter?.id ?? "");
        setBlockNumber(requestedBlock);
        setCheckpointKind(fallbackCheckpoint(requestedBlock));
        if (window.location.hash) window.setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      } catch {
        setNotice("The saved project could not be read. Return to PlotPickle and open a valid project.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const character = project?.characters.find((item) => item.id === characterId) ?? project?.characters[0];
  const block = project?.blocks.find((item) => item.number === blockNumber) ?? project?.blocks[0];
  const scenes = useMemo(() => block?.scenes ?? [], [block]);
  const selectedScene = scenes.find((scene) => scene.id === sceneId) ?? scenes[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSceneId(scenes[0]?.id ?? "");
      setCheckpointKind(fallbackCheckpoint(blockNumber));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [blockNumber, scenes]);

  useEffect(() => {
    if (!project || !character) return;
    const timer = window.setTimeout(() => {
      const key = `plotpickle-character-arc-shape:${project.id}:${character.id}`;
      const saved = window.localStorage.getItem(key) as CharacterArcShape | null;
      setArcShape(saved && characterArcShapes.some((shape) => shape.id === saved) ? saved : "custom");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [project, character]);

  function chooseArcShape(value: CharacterArcShape) {
    setArcShape(value);
    if (project && character) window.localStorage.setItem(`plotpickle-character-arc-shape:${project.id}:${character.id}`, value);
  }

  if (!project || !character || !block) {
    return <main className={styles.empty}><h1>Characters in Motion</h1><p>{notice || "Loading the active PlotPickle project…"}</p><Link href="/">Return to PlotPickle</Link></main>;
  }

  const act = block.act;
  const matrix = character.arcMatrix;
  const linkedBlocks = project.blocks.filter((item) => item.characterIds.includes(character.id));
  const linkedScenes = project.blocks.flatMap((item) => item.scenes.map((scene) => ({ ...scene, blockNumber: item.number, blockTitle: item.title }))).filter((scene) => scene.characterIds.includes(character.id) || scene.charactersEntering.includes(character.id) || scene.charactersLeaving.includes(character.id));
  const assignedMinis = project.blocks.flatMap((item) => item.scenes.flatMap((scene) => scene.miniBlocks.map((mini) => ({ ...mini, blockNumber: item.number, sceneId: scene.id })))).filter((mini) => mini.characterId === character.id);
  const cueCount = project.screenplay.draftElements.filter((element) => element.type === "character" && clean(element.text) === clean(character.name)).length;
  const dialogueCount = project.screenplay.draftElements.filter((element) => element.type === "dialogue" && linkedScenes.some((scene) => scene.id === element.sceneId)).length;
  const checkpointEvidence = matrix.checkpoints.filter((checkpoint) => checkpoint.evidence.trim() && (checkpoint.blockNumber || checkpoint.sceneId)).length;
  const voiceFields = [character.originEnvironment ?? "", character.socialContext ?? "", character.educationExpertise ?? "", character.worldviewBoundaries ?? "", character.rhythmSentenceShape ?? "", character.vocabularyMetaphors ?? "", character.verbalFingerprints ?? "", character.emotionalAccess ?? "", character.statusShift ?? "", character.persuasionStrategy ?? ""];
  const reciprocalRelationships = project.characters.filter((other) => other.id !== character.id && relationshipFor(character, other.id) && relationshipFor(other, character.id)).length;
  const claimFields = [character.want, character.need, character.ghost, character.fatalFlaw, character.strengths, character.arc, matrix.startingState, matrix.protectiveLie, matrix.emergingTruth, matrix.crisisChoice, matrix.climaxChoice, matrix.endingState, matrix.relationshipImpact];

  const gaps = [
    !character.want.trim() ? "Conscious want is not defined." : "",
    !character.need.trim() ? "Underlying need is not defined." : "",
    !matrix.protectiveLie.trim() ? "Protective lie is not defined in the Arc Matrix." : "",
    !matrix.climaxChoice.trim() ? "Climax choice is not planned." : "",
    !linkedBlocks.length ? "No Blocks currently link this character." : "",
    !linkedScenes.length ? "No scenes currently link this character." : "",
    !checkpointEvidence ? "No Arc Matrix checkpoint contains linked evidence." : "",
    cueCount === 0 ? "No screenplay character cue exactly matches this character's name." : "",
    filled(voiceFields) < 3 ? "Voiceprint has fewer than three developed dimensions." : "",
    character.relationships.length > reciprocalRelationships ? "At least one relationship is defined from only one character's perspective." : "",
  ].filter(Boolean);

  const contextualQuestions = characterQuestionsForContext({
    act,
    blockNumber,
    checkpoint: checkpointKind,
    arcShape,
    characterName: character.name,
    hasRelationshipEvidence: reciprocalRelationships > 0,
    hasDialogueEvidence: cueCount > 0 || dialogueCount > 0,
  });

  const castRows = project.characters.map((item) => {
    const blocks = project.blocks.filter((candidate) => candidate.characterIds.includes(item.id)).length;
    const sceneCoverage = project.blocks.flatMap((candidate) => candidate.scenes).filter((scene) => scene.characterIds.includes(item.id)).length;
    const threads = project.storyThreads.filter((thread) => thread.characterIds.includes(item.id)).map((thread) => thread.name);
    const functions = [item.role, threads.length ? `${threads.length} Story Thread${threads.length === 1 ? "" : "s"}` : "", item.relationships.length ? `${item.relationships.length} relationship${item.relationships.length === 1 ? "" : "s"}` : ""].filter(Boolean);
    return { character: item, blocks, scenes: sceneCoverage, threads, functions };
  });

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span>Characters in Motion</span><h1>Compare planned character claims with story evidence.</h1><p>Learn through behaviour, pressure, relationships and proof. This workspace reports gaps and contradictions; it never rewrites, merges or applies changes automatically.</p></div>
      <div className={styles.heroActions}><Link href="/">Open Story Planner</Link><Link href="/voiceprint">Voiceprint</Link><Link href="/draftlens">DraftLens</Link><Link href="/resonance">Resonance</Link></div>
    </header>

    <section className={styles.controls} aria-label="Character evidence context">
      <label>Character<select value={character.id} onChange={(event) => setCharacterId(event.target.value)}>{project.characters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Block<select value={blockNumber} onChange={(event) => setBlockNumber(Number(event.target.value))}>{project.blocks.map((item) => <option key={item.id} value={item.number}>Block {item.number} · {item.title}</option>)}</select></label>
      <label>Scene<select value={selectedScene?.id ?? ""} onChange={(event) => setSceneId(event.target.value)}><option value="">No scene selected</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>Scene {scene.number} · {scene.title}</option>)}</select></label>
      <label>Checkpoint<select value={checkpointKind} onChange={(event) => setCheckpointKind(event.target.value as ArcCheckpointKind)}>{checkpointKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
      <label>Intended arc shape<select value={arcShape} onChange={(event) => chooseArcShape(event.target.value as CharacterArcShape)}>{characterArcShapes.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}</select></label>
    </section>

    <section className={styles.context} id="journey">
      <div><span>Act {act} · Block {block.number} · {checkpointKind}</span><h2>Questions for {character.name} here</h2><p>{characterArcShapes.find((shape) => shape.id === arcShape)?.description}</p></div>
      <ol>{contextualQuestions.map((question) => <li key={question}>{question}</li>)}</ol>
    </section>

    <section className={styles.section} id="engine">
      <header><span>Character engine</span><h2>Planned claims</h2><p>Backstory matters when it changes present behaviour, access, fear, skill, relationship or choice.</p></header>
      <div className={styles.claimGrid}>
        {[
          ["Conscious want", character.want], ["Underlying need", character.need], ["Ghost", character.ghost], ["Protective lie", matrix.protectiveLie], ["Emerging truth", matrix.emergingTruth], ["Strengths", character.strengths], ["Flaw or liability", character.fatalFlaw], ["Intended arc", character.arc || characterArcShapes.find((shape) => shape.id === arcShape)?.label || ""],
        ].map(([label, value]) => <article key={label}><span>{label}</span><p>{value || "Not yet defined."}</p></article>)}
      </div>
    </section>

    <section className={styles.section} id="proof">
      <header><span>Character proof dashboard</span><h2>Plan versus evidence</h2><p>Counts indicate where evidence exists, not whether the writing is good. Review the underlying scenes before changing the story.</p></header>
      <div className={styles.metrics}>
        <article><strong>{filled(claimFields)}</strong><span>planned claims</span></article>
        <article><strong>{linkedBlocks.length}</strong><span>linked Blocks</span></article>
        <article><strong>{linkedScenes.length}</strong><span>linked scenes</span></article>
        <article><strong>{assignedMinis.length}</strong><span>assigned mini-blocks</span></article>
        <article><strong>{checkpointEvidence}/{matrix.checkpoints.length}</strong><span>checkpoints with linked evidence</span></article>
        <article><strong>{cueCount}</strong><span>screenplay character cues</span></article>
        <article><strong>{dialogueCount}</strong><span>dialogue elements in linked scenes</span></article>
        <article><strong>{filled(voiceFields)}/10</strong><span>Voiceprint dimensions</span></article>
      </div>
      <div className={styles.proofColumns}>
        <article><h3>Selected Block evidence</h3><dl><div><dt>Goal</dt><dd>{block.goal || "Not defined."}</dd></div><div><dt>Conflict</dt><dd>{block.conflict || "Not defined."}</dd></div><div><dt>Choice</dt><dd>{block.choice || "Not defined."}</dd></div><div><dt>Consequence</dt><dd>{block.consequence || "Not defined."}</dd></div><div><dt>Emotional turn</dt><dd>{block.emotionalTurn || "Not defined."}</dd></div></dl></article>
        <article><h3>Selected scene evidence</h3>{selectedScene ? <dl><div><dt>Objective</dt><dd>{selectedScene.objective || "Not defined."}</dd></div><div><dt>Opposition</dt><dd>{selectedScene.opposition || selectedScene.conflict || "Not defined."}</dd></div><div><dt>Action</dt><dd>{selectedScene.action || "Not defined."}</dd></div><div><dt>Turn</dt><dd>{selectedScene.turn || selectedScene.reversal || "Not defined."}</dd></div><div><dt>Outcome</dt><dd>{selectedScene.outcome || selectedScene.resolution || "Not defined."}</dd></div></dl> : <p>No scene selected.</p>}</article>
        <article className={styles.gaps}><h3>Questions and gaps</h3>{gaps.length ? <ul>{gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul> : <p>The major profile, evidence, relationship and Voiceprint connections are present. Review quality and contradiction manually.</p>}</article>
      </div>
      <p className={styles.safety}>Diagnostics and AI-assisted passes remain proposals. Preserve the original, inspect project evidence and approve every story change explicitly.</p>
    </section>

    <section className={styles.section} id="relationships">
      <header><span>Relationship matrix</span><h2>Both directions, shared evidence</h2><p>Each character can describe the same relationship differently. Shared scenes and checkpoints reveal where trust, status, debt, access or dependence changes.</p></header>
      <div className={styles.relationshipGrid}>{project.characters.filter((other) => other.id !== character.id).map((other) => {
        const outward = relationshipFor(character, other.id);
        const inward = relationshipFor(other, character.id);
        const sharedScenes = project.blocks.flatMap((item) => item.scenes.map((scene) => ({ ...scene, blockNumber: item.number }))).filter((scene) => scene.characterIds.includes(character.id) && scene.characterIds.includes(other.id));
        const selectedPoints = matrix.checkpoints.filter((point) => point.sceneId && sharedScenes.some((scene) => scene.id === point.sceneId));
        const otherPoints = other.arcMatrix.checkpoints.filter((point) => point.sceneId && sharedScenes.some((scene) => scene.id === point.sceneId));
        return <article key={other.id}><h3>{character.name} ↔ {other.name}</h3><div><span>{character.name}&apos;s perspective</span><strong>{outward?.label || "Not defined"}</strong><p>{outward?.description || "Add a relationship record from this character's point of view."}</p></div><div><span>{other.name}&apos;s perspective</span><strong>{inward?.label || "Not defined"}</strong><p>{inward?.description || "Add the reciprocal relationship record from the other point of view."}</p></div><footer><span>{sharedScenes.length} shared scene{sharedScenes.length === 1 ? "" : "s"}</span><span>{selectedPoints.length + otherPoints.length} linked change point{selectedPoints.length + otherPoints.length === 1 ? "" : "s"}</span></footer></article>;
      })}</div>
    </section>

    <section className={styles.section} id="conflict">
      <header><span>Inner and outer conflict</span><h2>Make pressure character-specific</h2><p>Internal conflict becomes playable when it changes what the character notices, withholds, chooses, risks, says, refuses or does.</p></header>
      <div className={styles.conflictGrid}><article><span>External pressure</span><p>{selectedScene?.opposition || selectedScene?.conflict || block.conflict || "Define the concrete resistance in the selected scene or Block."}</p></article><article><span>Current strategy</span><p>{matrix.checkpoints.find((point) => point.kind === checkpointKind)?.strategy || matrix.startingState || character.arc || "Record the strategy used under this pressure."}</p></article><article><span>Playable choice</span><p>{selectedScene?.action || block.choice || matrix.checkpoints.find((point) => point.kind === checkpointKind)?.choice || "Name the action or refusal selected from live options."}</p></article><article><span>Consequence</span><p>{selectedScene?.outcome || block.consequence || matrix.checkpoints.find((point) => point.kind === checkpointKind)?.consequence || "Show how the decision changes the next available choice."}</p></article></div>
    </section>

    <section className={styles.section} id="cast">
      <header><span>Cast system audit</span><h2>Functions, coverage and redundancy questions</h2><p>Archetypes are optional lenses, not identities. Thin or overlapping roles are questions for the writer; this audit never merges characters automatically.</p></header>
      <div className={styles.castTable}><div className={styles.castHead}><span>Character</span><span>Functions and threads</span><span>Blocks</span><span>Scenes</span><span>Question</span></div>{castRows.map((row) => <div className={styles.castRow} key={row.character.id}><strong>{row.character.name}</strong><span>{row.functions.join(" · ") || "No function recorded"}</span><span>{row.blocks}</span><span>{row.scenes}</span><span>{row.scenes === 0 ? "What consequential action belongs to this character?" : row.blocks > 0 && row.threads.length === 0 ? "Should this character carry or challenge a Story Thread?" : "Which unique pressure or relationship would disappear without them?"}</span></div>)}</div>
      <p className={styles.correction}>No character pattern guarantees profitability, recognition or production. Replace dated rescue labels with analysis of agency, vulnerability, who creates the plan, who pays the cost and how the event changes relationships.</p>
    </section>

    <section className={styles.section}>
      <header><span>Learn this field</span><h2>Plain-language field guide</h2><p>Use these distinctions beside the Character workspace and Arc Matrix. Each field should point toward evidence in the screenplay.</p></header>
      <div className={styles.guideGrid}>{fieldGuides.map((guide) => <article key={guide.term}><h3>{guide.term}</h3><p><strong>Difference:</strong> {guide.differs}</p><p><strong>Active-story question:</strong> {guide.question}</p><p><strong>Evidence:</strong> {guide.evidence}</p></article>)}</div>
    </section>

    <footer className={styles.footer}><Link href="/">Story Planner</Link><Link href="/voiceprint">Voiceprint Engine</Link><Link href="/labs">Dialogue Lab and AI Prompt Lab</Link><Link href="/draftlens">DraftLens</Link><Link href="/resonance">Resonance</Link></footer>
  </main>;
}
