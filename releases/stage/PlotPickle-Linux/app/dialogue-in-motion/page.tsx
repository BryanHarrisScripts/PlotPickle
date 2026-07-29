"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type Character,
  type PlotPickleProject,
  type ReviewThread,
  type ScreenplayDraftElement,
} from "@/lib/project";
import {
  dialogueBlueprintFields,
  dialogueGuidedPasses,
  dialoguePurposeLabels,
  dialogueQuestionsForContext,
} from "../learning-dialogue-in-motion";
import styles from "./dialogue-in-motion.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const MARKER = "PLOTPICKLE_DIALOGUE_RECORD\n";

type Blueprint = {
  id: string;
  kind: "dialogue-blueprint";
  blockNumber: number;
  miniBlockNumber: number;
  sceneId: string;
  sceneLabel: string;
  participants: string[];
  relationshipState: string;
  objectiveA: string;
  objectiveB: string;
  beliefA: string;
  beliefB: string;
  tacticA: string;
  tacticB: string;
  publicTopic: string;
  privateSubject: string;
  informationHeldA: string;
  informationHeldB: string;
  statusAtEntry: string;
  riskA: string;
  riskB: string;
  intendedTurn: string;
  exitCondition: string;
  continuityFacts: string;
  lockedLinesFacts: string;
  createdAt: string;
};

type LinePurpose = {
  id: string;
  kind: "dialogue-purpose";
  elementId: string;
  label: string;
  note: string;
  createdAt: string;
};

type DialogueRecord = Blueprint | LinePurpose;

const blankBlueprint = {
  relationshipState: "",
  objectiveA: "",
  objectiveB: "",
  beliefA: "",
  beliefB: "",
  tacticA: "",
  tacticB: "",
  publicTopic: "",
  privateSubject: "",
  informationHeldA: "",
  informationHeldB: "",
  statusAtEntry: "",
  riskA: "",
  riskB: "",
  intendedTurn: "",
  exitCondition: "",
  continuityFacts: "",
  lockedLinesFacts: "",
};

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${globalThis.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function encode(record: DialogueRecord) {
  return `${MARKER}${JSON.stringify(record)}`;
}

function decode(thread: ReviewThread): DialogueRecord | null {
  const body = thread.comments[0]?.body ?? "";
  if (!body.startsWith(MARKER)) return null;
  try { return JSON.parse(body.slice(MARKER.length)) as DialogueRecord; } catch { return null; }
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function normalizedPhrase(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
}

function voiceFields(character: Character | undefined) {
  return [
    ["Rhythm", character?.rhythmSentenceShape || character?.voice || "Not planned"],
    ["Vocabulary and metaphor", character?.vocabularyMetaphors || "Not planned"],
    ["Directness and worldview", character?.worldviewBoundaries || "Not planned"],
    ["Verbal fingerprints", character?.verbalFingerprints || "Not planned"],
    ["Emotional access", character?.emotionalAccess || "Not planned"],
    ["Status behaviour", character?.statusShift || "Not planned"],
    ["Persuasion strategy", character?.persuasionStrategy || "Not planned"],
  ] as const;
}

function screenplaySpeakerMap(elements: ScreenplayDraftElement[]) {
  let speaker = "";
  const map = new Map<string, string>();
  for (const element of elements) {
    if (element.type === "character") speaker = element.text.trim().replace(/\s*\(.*\)$/, "");
    if (element.type === "dialogue" || element.type === "dual-dialogue") map.set(element.id, speaker || "Unassigned speaker");
  }
  return map;
}

function saveProject(project: PlotPickleProject, setProject: (value: PlotPickleProject) => void, setNotice: (value: string) => void, notice: string) {
  const next = { ...project, metadata: { ...project.metadata, updatedAt: new Date().toISOString() } };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  setProject(next);
  setNotice(notice);
}

export default function DialogueInMotionPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [notice, setNotice] = useState("Loading the active PlotPickle project…");
  const [blockNumber, setBlockNumber] = useState(1);
  const [miniBlockNumber, setMiniBlockNumber] = useState(1);
  const [sceneId, setSceneId] = useState("");
  const [characterAId, setCharacterAId] = useState("");
  const [characterBId, setCharacterBId] = useState("");
  const [blueprint, setBlueprint] = useState(blankBlueprint);
  const [selectedElementId, setSelectedElementId] = useState("");
  const [purposeLabel, setPurposeLabel] = useState<(typeof dialoguePurposeLabels)[number]>("pressure");
  const [purposeNote, setPurposeNote] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) { setNotice("No saved project was found. A blank project is ready for dialogue planning."); return; }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) { setNotice("The saved project could not be upgraded. A blank project is shown instead."); return; }
        setProject(normalized);
        setCharacterAId(normalized.characters[0]?.id ?? "");
        setCharacterBId(normalized.characters[1]?.id ?? normalized.characters[0]?.id ?? "");
        const firstScene = normalized.blocks[0]?.scenes[0];
        setSceneId(firstScene?.id ?? "");
        setNotice("Connected to the active local PlotPickle project. Dialogue diagnostics do not rewrite or apply material automatically.");
      } catch { setNotice("The saved project could not be opened. A blank project is shown instead."); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const block = project.blocks[blockNumber - 1] ?? project.blocks[0];
  const scenes = block?.scenes ?? [];
  const scene = scenes.find((item) => item.id === sceneId) ?? scenes[0];
  const minis = scene?.miniBlocks ?? [];
  const mini = minis.find((item) => item.number === miniBlockNumber) ?? minis[0];
  const characterA = project.characters.find((item) => item.id === characterAId);
  const characterB = project.characters.find((item) => item.id === characterBId);
  const relationshipA = characterA?.relationships.find((item) => item.characterId === characterBId);
  const relationshipB = characterB?.relationships.find((item) => item.characterId === characterAId);

  const sceneElements = useMemo(() => project.screenplay.draftElements.filter((element) => element.sceneId === scene?.id || (!element.sceneId && element.sceneNumber === scene?.number && element.blockNumber === block?.number)), [block?.number, project.screenplay.draftElements, scene?.id, scene?.number]);
  const speakerMap = useMemo(() => screenplaySpeakerMap(project.screenplay.draftElements), [project.screenplay.draftElements]);
  const dialogueElements = sceneElements.filter((element) => element.type === "dialogue" || element.type === "dual-dialogue");
  const selectedElement = dialogueElements.find((element) => element.id === selectedElementId) ?? dialogueElements[0];
  const records = useMemo(() => project.review.threads.map((thread) => ({ thread, record: decode(thread) })).filter((item): item is { thread: ReviewThread; record: DialogueRecord } => Boolean(item.record)), [project.review.threads]);
  const blueprints = records.filter((item): item is { thread: ReviewThread; record: Blueprint } => item.record.kind === "dialogue-blueprint");
  const purposeRecords = records.filter((item): item is { thread: ReviewThread; record: LinePurpose } => item.record.kind === "dialogue-purpose");
  const activeBlueprint = blueprints.find((item) => item.record.sceneId === scene?.id && item.record.miniBlockNumber === miniBlockNumber)?.record;

  const dialogueBySpeaker = useMemo(() => {
    const map = new Map<string, ScreenplayDraftElement[]>();
    for (const element of project.screenplay.draftElements.filter((item) => item.type === "dialogue" || item.type === "dual-dialogue")) {
      const speaker = speakerMap.get(element.id) || "Unassigned speaker";
      map.set(speaker, [...(map.get(speaker) ?? []), element]);
    }
    return [...map.entries()].sort((left, right) => right[1].length - left[1].length);
  }, [project.screenplay.draftElements, speakerMap]);

  const repeatedPhrases = useMemo(() => {
    const counts = new Map<string, number>();
    for (const element of project.screenplay.draftElements.filter((item) => item.type === "dialogue" || item.type === "dual-dialogue")) {
      const phrase = normalizedPhrase(element.text);
      if (phrase.split(" ").length >= 3) counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [project.screenplay.draftElements]);

  const longSpeeches = project.screenplay.draftElements.filter((item) => (item.type === "dialogue" || item.type === "dual-dialogue") && wordCount(item.text) >= 70);
  const dialogueWords = project.screenplay.draftElements.filter((item) => item.type === "dialogue" || item.type === "dual-dialogue").reduce((sum, item) => sum + wordCount(item.text), 0);
  const actionWords = project.screenplay.draftElements.filter((item) => item.type === "action").reduce((sum, item) => sum + wordCount(item.text), 0);
  const voiceCoverage = project.characters.map((character) => ({ character, planned: voiceFields(character).filter(([, value]) => value !== "Not planned").length, lines: dialogueBySpeaker.find(([speaker]) => speaker.toUpperCase() === character.name.toUpperCase())?.[1] ?? [] }));
  const questions = dialogueQuestionsForContext({ blockNumber, miniBlockNumber, characterName: characterA?.name, relationshipLabel: relationshipA?.label || relationshipB?.label, sceneObjective: scene?.objective, sceneOpposition: scene?.opposition, sceneTurn: scene?.turn, genre: project.metadata.genre, worldRules: project.world.rules });

  function addRecord(record: DialogueRecord, title: string, anchorLabel: string, author: string) {
    const now = new Date().toISOString();
    const thread: ReviewThread = {
      id: record.id,
      title,
      anchor: { kind: record.kind === "dialogue-purpose" ? "screenplay-element" : "scene", targetId: record.kind === "dialogue-purpose" ? record.elementId : record.sceneId, label: anchorLabel },
      status: "open",
      priority: "normal",
      comments: [{ id: makeId("dialogue-comment"), author: author || "Writer", body: encode(record), createdAt: now }],
      createdAt: now,
      updatedAt: now,
      resolvedAt: "",
    };
    const next = { ...project, review: { ...project.review, threads: [...project.review.threads.filter((item) => item.id !== record.id), thread] } };
    saveProject(next, setProject, setNotice, `${title} saved as an anchored project record.`);
  }

  function saveBlueprint() {
    if (!scene) return;
    const record: Blueprint = { id: activeBlueprint?.id ?? makeId("dialogue-blueprint"), kind: "dialogue-blueprint", blockNumber, miniBlockNumber, sceneId: scene.id, sceneLabel: `Block ${blockNumber} · Scene ${scene.number}: ${scene.title}`, participants: [characterAId, characterBId].filter(Boolean), ...blueprint, createdAt: activeBlueprint?.createdAt ?? new Date().toISOString() };
    addRecord(record, `[Dialogue Blueprint] ${scene.title} · ${blockNumber}.${miniBlockNumber}`, record.sceneLabel, characterA?.name || "Writer");
  }

  function labelPurpose() {
    if (!selectedElement) return;
    const existing = purposeRecords.find((item) => item.record.elementId === selectedElement.id)?.record;
    const record: LinePurpose = { id: existing?.id ?? makeId("dialogue-purpose"), kind: "dialogue-purpose", elementId: selectedElement.id, label: purposeLabel, note: purposeNote, createdAt: existing?.createdAt ?? new Date().toISOString() };
    addRecord(record, `[Dialogue purpose: ${purposeLabel}] ${selectedElement.text.slice(0, 60)}`, `Scene ${selectedElement.sceneNumber} · ${selectedElement.type}`, characterA?.name || "Writer");
    setPurposeNote("");
  }

  function chooseScene(nextSceneId: string) {
    setSceneId(nextSceneId);
    setMiniBlockNumber(1);
    setSelectedElementId("");
    setBlueprint(blankBlueprint);
  }

  function useExistingBlueprint() {
    if (!activeBlueprint) return;
    const { id: _id, kind: _kind, blockNumber: _block, miniBlockNumber: _mini, sceneId: _scene, sceneLabel: _label, participants: _participants, createdAt: _created, ...fields } = activeBlueprint;
    void _id; void _kind; void _block; void _mini; void _scene; void _label; void _participants; void _created;
    setBlueprint(fields);
  }

  return <main className={styles.page}>
    <header className={styles.hero}><div><span>Playable dialogue learning and practice system</span><h1>Dialogue in Motion</h1><p>Plan objectives, tactics, subtext, status, speech, silence and action; compare Voiceprints with screenplay evidence; read exchanges aloud; and route bounded passes into Dialogue Lab without changing the script automatically.</p></div><nav><Link href="/">Back to PlotPickle</Link><Link href="/read-learn">Read & Learn</Link><Link href="/labs">Dialogue Lab</Link></nav></header>
    <p className={styles.notice} aria-live="polite">{notice}</p>

    <section className={styles.controls} aria-label="Dialogue context">
      <label>Block<select value={blockNumber} onChange={(event) => { const next = Number(event.target.value); setBlockNumber(next); setMiniBlockNumber(1); chooseScene(project.blocks[next - 1]?.scenes[0]?.id ?? ""); }}>{project.blocks.map((item) => <option value={item.number} key={item.id}>{item.number} · {item.title}</option>)}</select></label>
      <label>Scene<select value={scene?.id ?? ""} onChange={(event) => chooseScene(event.target.value)}>{scenes.map((item) => <option value={item.id} key={item.id}>{item.number} · {item.title}</option>)}</select></label>
      <label>Mini-block<select value={miniBlockNumber} onChange={(event) => setMiniBlockNumber(Number(event.target.value))}>{minis.map((item) => <option value={item.number} key={item.id}>{blockNumber}.{item.number} · {item.label}</option>)}</select></label>
      <label>Character A<select value={characterAId} onChange={(event) => setCharacterAId(event.target.value)}>{project.characters.map((item) => <option value={item.id} key={item.id}>{item.name || "Unnamed character"}</option>)}</select></label>
      <label>Character B<select value={characterBId} onChange={(event) => setCharacterBId(event.target.value)}>{project.characters.map((item) => <option value={item.id} key={item.id}>{item.name || "Unnamed character"}</option>)}</select></label>
    </section>

    <section className={styles.context}><div><span>Active exchange</span><h2>{scene ? `Scene ${scene.number}: ${scene.title}` : "No scene selected"}</h2><p>{scene?.objective || mini?.objective || "Add a scene objective to clarify what must move."}</p></div><dl><div><dt>Opposition</dt><dd>{scene?.opposition || mini?.resistance || "Not planned"}</dd></div><div><dt>Turn</dt><dd>{scene?.turn || mini?.turn || "Not planned"}</dd></div><div><dt>Exit</dt><dd>{scene?.exitCondition || mini?.exitState || "Not planned"}</dd></div></dl></section>

    <section className={styles.panel} id="blueprint"><header><span>Dialogue Blueprint</span><h2>Design the exchange before polishing lines</h2><p>The blueprint is optional and stored as an anchored review record linked to the selected scene and mini-block.</p></header>
      <div className={styles.participants}><article><h3>{characterA?.name || "Character A"}</h3><p>{relationshipA?.label || "Relationship not recorded"}</p></article><article><h3>{characterB?.name || "Character B"}</h3><p>{relationshipB?.label || "Reciprocal relationship not recorded"}</p></article></div>
      <div className={styles.formGrid}>
        <label className={styles.wide}>Relationship state<textarea value={blueprint.relationshipState} onChange={(event) => setBlueprint({ ...blueprint, relationshipState: event.target.value })} /></label>
        <label>{characterA?.name || "A"} objective<textarea value={blueprint.objectiveA} onChange={(event) => setBlueprint({ ...blueprint, objectiveA: event.target.value })} /></label>
        <label>{characterB?.name || "B"} objective<textarea value={blueprint.objectiveB} onChange={(event) => setBlueprint({ ...blueprint, objectiveB: event.target.value })} /></label>
        <label>What A believes B wants<textarea value={blueprint.beliefA} onChange={(event) => setBlueprint({ ...blueprint, beliefA: event.target.value })} /></label>
        <label>What B believes A wants<textarea value={blueprint.beliefB} onChange={(event) => setBlueprint({ ...blueprint, beliefB: event.target.value })} /></label>
        <label>A tactic / persuasion strategy<textarea value={blueprint.tacticA} onChange={(event) => setBlueprint({ ...blueprint, tacticA: event.target.value })} /></label>
        <label>B tactic / persuasion strategy<textarea value={blueprint.tacticB} onChange={(event) => setBlueprint({ ...blueprint, tacticB: event.target.value })} /></label>
        <label>Information held or withheld by A<textarea value={blueprint.informationHeldA} onChange={(event) => setBlueprint({ ...blueprint, informationHeldA: event.target.value })} /></label>
        <label>Information held or withheld by B<textarea value={blueprint.informationHeldB} onChange={(event) => setBlueprint({ ...blueprint, informationHeldB: event.target.value })} /></label>
        <label>A risk / cost of direct speech<textarea value={blueprint.riskA} onChange={(event) => setBlueprint({ ...blueprint, riskA: event.target.value })} /></label>
        <label>B risk / cost of direct speech<textarea value={blueprint.riskB} onChange={(event) => setBlueprint({ ...blueprint, riskB: event.target.value })} /></label>
        {([ ["Public topic", "publicTopic"], ["Private subject", "privateSubject"], ["Status and leverage at entry", "statusAtEntry"], ["Intended turn", "intendedTurn"], ["Changed exit condition", "exitCondition"], ["Required continuity facts", "continuityFacts"], ["Locked lines or facts", "lockedLinesFacts"] ] as const).map(([label, key]) => <label className={styles.wide} key={key}>{label}<textarea value={blueprint[key]} onChange={(event) => setBlueprint({ ...blueprint, [key]: event.target.value })} /></label>)}
      </div><div className={styles.actions}><button type="button" onClick={saveBlueprint}>Save Dialogue Blueprint</button>{activeBlueprint ? <button type="button" onClick={useExistingBlueprint}>Load saved blueprint</button> : null}</div><div className={styles.chips}>{dialogueBlueprintFields.map((item) => <span key={item}>{item}</span>)}</div>
    </section>

    <section className={styles.panel} id="voice"><header><span>Two-sided intention and voice comparison</span><h2>Different understanding, different strategy</h2><p>Voice is a flexible pattern of perception and persuasion. Variation under pressure, intimacy, deception, status or growth is not automatically inconsistency.</p></header><div className={styles.voiceGrid}>{[characterA, characterB].map((character) => <article key={character?.id || "missing"}><h3>{character?.name || "Select a character"}</h3><dl>{voiceFields(character).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p><strong>Current relationship perspective:</strong> {character?.id === characterAId ? relationshipA?.description : relationshipB?.description || "Not recorded"}</p></article>)}</div><p className={styles.safety}>Accents, dialects and cultural language require research, restraint and informed human review. Do not use phonetic spelling or demographic shorthand as a substitute for character.</p></section>

    <section className={styles.panel} id="proof"><header><span>Dialogue proof dashboard</span><h2>Compare planned claims with screenplay evidence</h2><p>Counts and comparisons surface questions; they are not grades or universal failure rules.</p></header>
      <div className={styles.metrics}><article><strong>{dialogueElements.length}</strong><span>selected-scene speeches</span></article><article><strong>{sceneElements.filter((item) => item.type === "action").length}</strong><span>selected-scene action elements</span></article><article><strong>{dialogueWords}</strong><span>project dialogue words</span></article><article><strong>{actionWords}</strong><span>project action words</span></article><article><strong>{longSpeeches.length}</strong><span>speeches of 70+ words</span></article><article><strong>{repeatedPhrases.length}</strong><span>repeated 3+ word speeches</span></article></div>
      <div className={styles.proofGrid}><article><h3>Voiceprint versus actual lines</h3>{voiceCoverage.map((item) => <p key={item.character.id}><strong>{item.character.name || "Unnamed"}</strong>: {item.planned}/7 comparison fields planned · {item.lines.length} dialogue elements.</p>)}</article><article><h3>Relationship and objective evidence</h3><p>Planned relationship: {relationshipA?.description || relationshipB?.description || "Not recorded"}</p><p>Scene objective: {scene?.objective || "Not recorded"}</p><p>Scene opposition: {scene?.opposition || "Not recorded"}</p><p>Dialogue Blueprint: {activeBlueprint ? "Recorded for this scene and mini-block" : "Not recorded"}</p></article><article><h3>Exposition and repetition questions</h3>{repeatedPhrases.length ? repeatedPhrases.map(([phrase, count]) => <p key={phrase}><strong>{count}×</strong> {phrase.slice(0, 100)}</p>) : <p>No exact repeated speeches of three or more words were found.</p>}{longSpeeches.length ? <p>{longSpeeches.length} long speech{longSpeeches.length === 1 ? "" : "es"} may merit read-aloud review; length alone is not a defect.</p> : null}</article></div>
    </section>

    <section className={styles.panel}><header><span>Dialogue purpose labels</span><h2>Label selected evidence only when useful</h2><p>Purpose labels aid analysis; writers do not need to classify every line.</p></header>{dialogueElements.length ? <><div className={styles.formGrid}><label className={styles.wide}>Selected speech<select value={selectedElement?.id || ""} onChange={(event) => setSelectedElementId(event.target.value)}>{dialogueElements.map((item) => <option value={item.id} key={item.id}>{speakerMap.get(item.id)} · {item.text.slice(0, 90)}</option>)}</select></label><label>Purpose<select value={purposeLabel} onChange={(event) => setPurposeLabel(event.target.value as (typeof dialoguePurposeLabels)[number])}>{dialoguePurposeLabels.map((item) => <option key={item}>{item}</option>)}</select></label><label>Evidence note<input value={purposeNote} onChange={(event) => setPurposeNote(event.target.value)} /></label></div><div className={styles.actions}><button type="button" onClick={labelPurpose}>Save purpose label</button></div></> : <p>No dialogue elements are assigned to this scene.</p>}<div className={styles.chips}>{dialoguePurposeLabels.map((item) => <span key={item}>{item}</span>)}</div></section>

    <section className={styles.panel} id="table-read"><header><span>Read-aloud and table-read mode moved to Feedback</span><h2>Continue rehearsal in Feedback</h2><p>Dialogue in Motion keeps voice, purpose and screenplay-evidence analysis. Feedback now owns browser playback, actor sides, timing and the “Save anchored table-read observation” workflow, so PlotPickle does not maintain a second Table Read engine. It does not imitate a real performer.</p></header><div className={styles.actions}><Link href="/">Open Table Read in Feedback</Link></div></section>

    <section className={styles.panel} id="diagnostics"><header><span>Contextual guidance and diagnostics</span><h2>Questions for Block {blockNumber}.{miniBlockNumber}</h2><p>Evidence prompts diagnose before rewriting and remain useful with manual, no-AI workflows.</p></header><ol className={styles.questions}>{questions.map((item) => <li key={item}>{item}</li>)}</ol><div className={styles.passGrid}>{dialogueGuidedPasses.map((pass) => <article key={pass.id}><strong>{pass.label}</strong><p>{pass.instruction}</p><Link href="/labs">Open Dialogue Lab</Link></article>)}</div><p className={styles.safety}>A revision is never applied automatically. Preserve the original, proposed version, explanation, affected continuity and explicit approve/discard controls.</p></section>

    <footer className={styles.footer}><Link href="/read-learn">Open all Dialogue in Motion lessons</Link><Link href="/labs">Open guided Dialogue Lab passes</Link><Link href="/characters-in-motion">Open Character Proof</Link></footer>
  </main>;
}
