"use client";

import Link from "next/link";
import RefineReturnNav from "../refine-return-nav";
import { useEffect, useMemo, useState } from "react";
import { diagnoseScenePulse } from "@/lib/craft-diagnostics";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type PlotPickleProject,
  type ReviewThread,
} from "@/lib/project";
import {
  advancedFormattingTemplates,
  essentialTechniqueLibrary,
  scenePulseLearningOverlay,
  storyCraftAuditSteps,
  storyCraftContextRecommendations,
} from "../learning-story-craft-essentials";
import styles from "./story-craft-essentials.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
const MARKER = "PLOTPICKLE_STORY_CRAFT_RECORD\n";
type StoryCraftScope = "learn" | "plan" | "refine";

type StoryExperienceRecord = {
  id: string;
  kind: "story-experience";
  anchorExperience: string;
  audiencePromise: string;
  emotionalMovement: string;
  dominantGenre: string;
  secondaryGenre: string;
  tonalPromise: string;
  tonalRange: string;
  centralQuestion: string;
  expectedAnswer: string;
  alternativeAnswer: string;
  signatureImageSoundMovement: string;
  endingAfterEffect: string;
  createdAt: string;
};

type ThemeArgumentRecord = {
  id: string;
  kind: "theme-argument";
  centralQuestion: string;
  expectedAnswer: string;
  competingAnswer: string;
  characterTests: string;
  storyThreads: string;
  keyChoices: string;
  consequences: string;
  climaxProof: string;
  endingReflection: string;
  createdAt: string;
};

type MotifRecord = {
  id: string;
  kind: "motif-ledger";
  name: string;
  medium: string;
  literalIntroduction: string;
  repetitions: string;
  meaningShifts: string;
  associations: string;
  appearances: string;
  intendedEnding: string;
  continuity: string;
  createdAt: string;
};

type ScreenEvidenceRecord = {
  id: string;
  kind: "screen-evidence";
  abstractClaim: string;
  actionOrRefusal: string;
  objectiveOrTactic: string;
  objectOrSpace: string;
  soundOrSilence: string;
  dialogueOrSubtext: string;
  repetitionWithVariation: string;
  narrationReason: string;
  createdAt: string;
};

type CraftAuditRecord = {
  id: string;
  kind: "craft-audit";
  evidenceQuestions: string;
  rootCause: string;
  revisionPriority: string;
  selectedSteps: string[];
  createdAt: string;
};

type StoryCraftRecord = StoryExperienceRecord | ThemeArgumentRecord | MotifRecord | ScreenEvidenceRecord | CraftAuditRecord;

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${globalThis.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function encode(record: StoryCraftRecord) {
  return `${MARKER}${JSON.stringify(record)}`;
}

function decode(thread: ReviewThread): StoryCraftRecord | null {
  const body = thread.comments[0]?.body ?? "";
  if (!body.startsWith(MARKER)) return null;
  try { return JSON.parse(body.slice(MARKER.length)) as StoryCraftRecord; } catch { return null; }
}

function recordTitle(record: StoryCraftRecord) {
  if (record.kind === "story-experience") return "[Story Experience Card] Audience promise and after-effect";
  if (record.kind === "theme-argument") return "[Theme Argument Map] Competing answers and proof";
  if (record.kind === "motif-ledger") return `[Motif and Echo] ${record.name || "Untitled motif"}`;
  if (record.kind === "screen-evidence") return `[Screen Evidence] ${record.abstractClaim.slice(0, 72) || "Abstract claim"}`;
  return "[Essential Craft Audit] Evidence and revision priority";
}

function saveProject(project: PlotPickleProject, setProject: (value: PlotPickleProject) => void, setNotice: (value: string) => void, notice: string) {
  const next = { ...project, metadata: { ...project.metadata, updatedAt: new Date().toISOString() } };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  setProject(next);
  setNotice(notice);
}

function textLength(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function toneFromScene(scene: PlotPickleProject["blocks"][number]["scenes"][number]) {
  const joined = [scene.sceneType, scene.purpose, scene.conflict, scene.reversal, scene.turn, scene.outcome].join(" ").toLowerCase();
  if (/fear|danger|threat|suspense|dread/.test(joined)) return "threat / suspense";
  if (/comic|humour|funny|awkward|playful/.test(joined)) return "comic / playful";
  if (/grief|loss|regret|mourning|sad/.test(joined)) return "grief / reflection";
  if (/wonder|awe|discovery|revelation/.test(joined)) return "wonder / discovery";
  if (/intimacy|love|trust|bond/.test(joined)) return "intimacy / connection";
  return scene.sceneType || "unclassified";
}

export default function StoryCraftEssentialsPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [notice, setNotice] = useState("Loading the active PlotPickle project…");
  const [scope, setScope] = useState<StoryCraftScope>("learn");
  const [returnWorkspace, setReturnWorkspace] = useState<StoryCraftScope>("learn");
  const [blockNumber, setBlockNumber] = useState(1);
  const [sceneId, setSceneId] = useState("");
  const [miniBlockNumber, setMiniBlockNumber] = useState(1);
  const [experience, setExperience] = useState<Omit<StoryExperienceRecord, "id" | "kind" | "createdAt">>({ anchorExperience: "", audiencePromise: "", emotionalMovement: "", dominantGenre: "", secondaryGenre: "", tonalPromise: "", tonalRange: "", centralQuestion: "", expectedAnswer: "", alternativeAnswer: "", signatureImageSoundMovement: "", endingAfterEffect: "" });
  const [themeMap, setThemeMap] = useState<Omit<ThemeArgumentRecord, "id" | "kind" | "createdAt">>({ centralQuestion: "", expectedAnswer: "", competingAnswer: "", characterTests: "", storyThreads: "", keyChoices: "", consequences: "", climaxProof: "", endingReflection: "" });
  const [motif, setMotif] = useState<Omit<MotifRecord, "id" | "kind" | "createdAt">>({ name: "", medium: "visual", literalIntroduction: "", repetitions: "", meaningShifts: "", associations: "", appearances: "", intendedEnding: "", continuity: "" });
  const [screenEvidence, setScreenEvidence] = useState<Omit<ScreenEvidenceRecord, "id" | "kind" | "createdAt">>({ abstractClaim: "", actionOrRefusal: "", objectiveOrTactic: "", objectOrSpace: "", soundOrSilence: "", dialogueOrSubtext: "", repetitionWithVariation: "", narrationReason: "" });
  const [auditQuestions, setAuditQuestions] = useState("");
  const [auditRootCause, setAuditRootCause] = useState("");
  const [auditPriority, setAuditPriority] = useState("");
  const [auditSteps, setAuditSteps] = useState<string[]>([]);
  const [formatTemplateId, setFormatTemplateId] = useState<string>(advancedFormattingTemplates[0].id);
  const [formatText, setFormatText] = useState<string>(advancedFormattingTemplates[0].form);
  const [formatStatus, setFormatStatus] = useState("Choose a technique and edit the preview before copying it manually.");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams(window.location.search);
      const requestedScope = parameters.get("scope");
      if (requestedScope === "plan" || requestedScope === "refine" || requestedScope === "learn") setScope(requestedScope);
      const requestedReturn = parameters.get("return");
      if (requestedReturn === "plan" || requestedReturn === "refine" || requestedReturn === "learn") setReturnWorkspace(requestedReturn);
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) { setNotice("No saved project was found. A blank project is ready for craft planning."); return; }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) { setNotice("The saved project could not be upgraded. A blank project is shown instead."); return; }
        setProject(normalized);
        setSceneId(normalized.blocks[0]?.scenes[0]?.id ?? "");
        setExperience((current) => ({ ...current, audiencePromise: normalized.development.pitch.audiencePromise, emotionalMovement: normalized.development.pitch.emotionalExperience, dominantGenre: normalized.metadata.genre, tonalPromise: normalized.metadata.tone, centralQuestion: normalized.story.dramaticQuestion, expectedAnswer: normalized.story.theme, alternativeAnswer: normalized.story.antiTheme, signatureImageSoundMovement: normalized.development.pickle.signatureMove, endingAfterEffect: normalized.story.ending }));
        setThemeMap((current) => ({ ...current, centralQuestion: normalized.story.dramaticQuestion, expectedAnswer: normalized.story.theme, competingAnswer: normalized.story.antiTheme, storyThreads: normalized.storyThreads.map((thread) => `${thread.name}: ${thread.summary}`).join("\n"), climaxProof: normalized.development.foundations.endingProof, endingReflection: normalized.story.ending }));
        setNotice("Connected to the active local PlotPickle project. Maps and audits remain review records; no story or screenplay text changes automatically.");
      } catch { setNotice("The saved project could not be opened. A blank project is shown instead."); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const block = project.blocks[blockNumber - 1] ?? project.blocks[0];
  const scenes = block?.scenes ?? [];
  const scene = scenes.find((item) => item.id === sceneId) ?? scenes[0];
  const miniBlocks = scene?.miniBlocks ?? [];
  const mini = miniBlocks.find((item) => item.number === miniBlockNumber) ?? miniBlocks[0];
  const scenePulse = scene ? diagnoseScenePulse(project, scene.id) : null;
  const records = useMemo(() => project.review.threads.map((thread) => ({ thread, record: decode(thread) })).filter((item): item is { thread: ReviewThread; record: StoryCraftRecord } => Boolean(item.record)), [project.review.threads]);
  const experienceRecord = records.find((item) => item.record.kind === "story-experience")?.record as StoryExperienceRecord | undefined;
  const themeRecord = records.find((item) => item.record.kind === "theme-argument")?.record as ThemeArgumentRecord | undefined;
  const motifRecords = records.filter((item): item is { thread: ReviewThread; record: MotifRecord } => item.record.kind === "motif-ledger");
  const auditRecords = records.filter((item): item is { thread: ReviewThread; record: CraftAuditRecord } => item.record.kind === "craft-audit");
  const selectedFormat = advancedFormattingTemplates.find((item) => item.id === formatTemplateId) ?? advancedFormattingTemplates[0];
  const recommendations = storyCraftContextRecommendations({ blockNumber, miniBlockNumber, scenePurpose: scene?.purpose, theme: project.story.theme, tone: project.metadata.tone, screenplayCount: project.screenplay.draftElements.length });

  const pacingRows = useMemo(() => project.blocks.flatMap((currentBlock) => currentBlock.scenes.map((currentScene) => ({
    block: currentBlock.number,
    scene: currentScene.number,
    title: currentScene.title,
    type: currentScene.sceneType,
    seconds: currentScene.estimatedSeconds,
    pages: currentScene.pageEstimate,
    pressure: [currentScene.opposition, currentScene.conflict, currentBlock.conflict].filter(Boolean).length,
    informationChange: [currentScene.reversal, currentScene.turn, currentScene.outcome].filter(Boolean).length,
    tonalMode: toneFromScene(currentScene),
    pivot: currentScene.reversal || currentScene.turn,
    handoff: currentScene.outcome || currentScene.exitCondition,
  }))), [project.blocks]);

  const screenEvidenceCounts = useMemo(() => ({
    action: project.screenplay.draftElements.filter((item) => item.type === "action").length,
    dialogue: project.screenplay.draftElements.filter((item) => item.type === "dialogue" || item.type === "dual-dialogue").length,
    shots: project.screenplay.draftElements.filter((item) => item.type === "shot").length + project.production.shots.length,
    sound: project.production.cues.length,
    transitions: project.screenplay.draftElements.filter((item) => item.type === "transition").length,
    notes: project.screenplay.draftElements.filter((item) => item.type === "note" || item.type === "boneyard").length,
  }), [project.production.cues.length, project.production.shots.length, project.screenplay.draftElements]);

  function addRecord(record: StoryCraftRecord) {
    const now = new Date().toISOString();
    const thread: ReviewThread = {
      id: record.id,
      title: recordTitle(record),
      anchor: { kind: record.kind === "screen-evidence" ? "scene" : "project", targetId: record.kind === "screen-evidence" ? scene?.id ?? project.id : project.id, label: record.kind === "screen-evidence" && scene ? `Scene ${scene.number}: ${scene.title}` : "Whole project" },
      status: "open",
      priority: "normal",
      comments: [{ id: makeId("craft-comment"), author: "Writer", body: encode(record), createdAt: now }],
      createdAt: now,
      updatedAt: now,
      resolvedAt: "",
    };
    const next = { ...project, review: { ...project.review, threads: [...project.review.threads.filter((item) => item.id !== record.id), thread] } };
    saveProject(next, setProject, setNotice, `${recordTitle(record)} saved as a reviewable project record.`);
  }

  function saveExperience() {
    addRecord({ id: experienceRecord?.id ?? "story-experience-card", kind: "story-experience", ...experience, createdAt: experienceRecord?.createdAt ?? new Date().toISOString() });
  }

  function saveThemeMap() {
    addRecord({ id: themeRecord?.id ?? "theme-argument-map", kind: "theme-argument", ...themeMap, createdAt: themeRecord?.createdAt ?? new Date().toISOString() });
  }

  function saveMotif() {
    addRecord({ id: makeId("motif"), kind: "motif-ledger", ...motif, createdAt: new Date().toISOString() });
    setMotif({ name: "", medium: "visual", literalIntroduction: "", repetitions: "", meaningShifts: "", associations: "", appearances: "", intendedEnding: "", continuity: "" });
  }

  function saveScreenEvidence() {
    addRecord({ id: makeId("screen-evidence"), kind: "screen-evidence", ...screenEvidence, createdAt: new Date().toISOString() });
    setScreenEvidence({ abstractClaim: "", actionOrRefusal: "", objectiveOrTactic: "", objectOrSpace: "", soundOrSilence: "", dialogueOrSubtext: "", repetitionWithVariation: "", narrationReason: "" });
  }

  function saveAudit() {
    addRecord({ id: makeId("craft-audit"), kind: "craft-audit", evidenceQuestions: auditQuestions, rootCause: auditRootCause, revisionPriority: auditPriority, selectedSteps: auditSteps, createdAt: new Date().toISOString() });
    setAuditQuestions(""); setAuditRootCause(""); setAuditPriority(""); setAuditSteps([]);
  }

  function chooseFormatTemplate(nextId: string) {
    const template = advancedFormattingTemplates.find((item) => item.id === nextId) ?? advancedFormattingTemplates[0];
    setFormatTemplateId(template.id);
    setFormatText(template.form);
    setFormatStatus("Template loaded locally. Edit it before copying; nothing has been inserted into the screenplay.");
  }

  async function copyFormatText() {
    try {
      await navigator.clipboard.writeText(formatText);
      setFormatStatus("Edited template copied. Review and insert it manually in the screenplay editor.");
    } catch {
      setFormatStatus("Clipboard access was unavailable. Select and copy the preview manually.");
    }
  }

  return <main className={`${styles.page} standalone-studio-surface`}>
    <RefineReturnNav />
    <header className={styles.hero}><div><span>{scope === "plan" ? "Plan · story intent" : scope === "refine" ? "Refine · essential audit" : "Learn · craft lessons and practice"}</span><h1>{scope === "plan" ? "Story Experience, Theme & Motifs" : scope === "refine" ? "Essential Craft Audit" : "Story Craft Essentials"}</h1><p>{scope === "plan" ? "Plan the audience contract, competing thematic answers and motif continuity in the active canonical project." : scope === "refine" ? "Diagnose evidence, separate root cause from symptom and prepare one bounded revision priority." : "Study pacing, scene movement, screen evidence, advanced screenplay forms and audience-effect techniques without changing the story automatically."}</p></div><nav><Link href={`/?workspace=${returnWorkspace}`}>Back to {returnWorkspace[0].toUpperCase() + returnWorkspace.slice(1)}</Link><Link href="/read-learn">Read & Learn</Link>{scope === "refine" ? <Link href="/draftlens?return=refine">DraftLens</Link> : null}</nav></header>
    <p className={styles.notice} aria-live="polite">{notice}</p>

    <section className={styles.controls} aria-label="Active story context"><label>Block<select value={blockNumber} onChange={(event) => { const next = Number(event.target.value); setBlockNumber(next); setSceneId(project.blocks[next - 1]?.scenes[0]?.id ?? ""); setMiniBlockNumber(1); }}>{project.blocks.map((item) => <option value={item.number} key={item.id}>{item.number} · {item.title}</option>)}</select></label><label>Scene<select value={scene?.id ?? ""} onChange={(event) => { setSceneId(event.target.value); setMiniBlockNumber(1); }}>{scenes.map((item) => <option value={item.id} key={item.id}>{item.number} · {item.title}</option>)}</select></label><label>Mini-block<select value={miniBlockNumber} onChange={(event) => setMiniBlockNumber(Number(event.target.value))}>{miniBlocks.map((item) => <option value={item.number} key={item.id}>{blockNumber}.{item.number} · {item.label}</option>)}</select></label><div><span>Active purpose</span><strong>{scene?.purpose || mini?.purpose || "Not planned"}</strong></div></section>

    <section className={styles.panel} id="experience" hidden={scope !== "plan"}><header><span>Story Experience Card</span><h2>Define the audience contract and ending after-effect</h2><p>Use this compact summary as a reference—not a rigid constraint. Plot, story, structure, style and theme remain distinct layers.</p></header><div className={styles.formGrid}>{([ ["Whose experience anchors the story?", "anchorExperience"], ["Audience promise", "audiencePromise"], ["Intended emotional movement", "emotionalMovement"], ["Dominant genre", "dominantGenre"], ["Secondary genre", "secondaryGenre"], ["Tonal promise", "tonalPromise"], ["Tonal range", "tonalRange"], ["Central question", "centralQuestion"], ["Expected answer", "expectedAnswer"], ["Alternative answer", "alternativeAnswer"], ["Signature image, sound or movement", "signatureImageSoundMovement"], ["Ending after-effect", "endingAfterEffect"] ] as const).map(([label, key]) => <label key={key}>{label}<textarea value={experience[key]} onChange={(event) => setExperience({ ...experience, [key]: event.target.value })} /></label>)}</div><div className={styles.actions}><button type="button" onClick={saveExperience}>Save Story Experience Card</button>{experienceRecord ? <button type="button" onClick={() => { const { id: _id, kind: _kind, createdAt: _created, ...fields } = experienceRecord; void _id; void _kind; void _created; setExperience(fields); }}>Load saved card</button> : null}</div></section>

    <section className={styles.panel} id="pacing" hidden={scope !== "learn"}><header><span>Pacing and Tone Map</span><h2>Track meaningful change and deliberate release</h2><p>Duration, pressure and intensity are evidence—not goals. A quiet irreversible scene may move faster than repetitive action.</p></header><div className={styles.metrics}><article><strong>{pacingRows.length}</strong><span>planned scenes</span></article><article><strong>{pacingRows.reduce((sum, row) => sum + row.seconds, 0)}</strong><span>estimated seconds</span></article><article><strong>{pacingRows.filter((row) => row.pivot).length}</strong><span>scenes with pivot evidence</span></article><article><strong>{pacingRows.filter((row) => row.handoff).length}</strong><span>scenes with handoff evidence</span></article><article><strong>{new Set(pacingRows.map((row) => row.tonalMode)).size}</strong><span>observed tonal modes</span></article></div><div className={styles.mapTable}><table><thead><tr><th>Position</th><th>Scene</th><th>Duration</th><th>Pressure</th><th>Information change</th><th>Tonal mode</th><th>Pivot / handoff</th></tr></thead><tbody>{pacingRows.map((row) => <tr className={row.block === blockNumber && row.scene === scene?.number ? styles.activeRow : ""} key={`${row.block}-${row.scene}`}><td>{row.block}.{row.scene}</td><td>{row.title || row.type}</td><td>{row.seconds}s / {row.pages}p</td><td>{row.pressure ? `${row.pressure} evidence field${row.pressure === 1 ? "" : "s"}` : "Question"}</td><td>{row.informationChange ? `${row.informationChange} change field${row.informationChange === 1 ? "" : "s"}` : "Question"}</td><td>{row.tonalMode}</td><td>{row.pivot || row.handoff || "Question"}</td></tr>)}</tbody></table></div><p className={styles.safety}>Pacing is the rate and pattern of meaningful change, anticipation and processing time—not a genre speed rule or a demand for constant intensity.</p></section>

    <section className={styles.panel} id="theme" hidden={scope !== "plan"}><header><span>Theme Argument Map</span><h2>Keep competing answers dramatically alive</h2><p>Theme is a tested human question, not a moral every scene and line must repeat.</p></header><div className={styles.formGrid}>{([ ["Central question or contested proposition", "centralQuestion"], ["Expected or emerging answer", "expectedAnswer"], ["Credible competing answer / anti-theme", "competingAnswer"], ["Characters who embody or test each answer", "characterTests"], ["Story Threads and relationships as alternate experiments", "storyThreads"], ["Key choices", "keyChoices"], ["Consequences that refine or overturn the answers", "consequences"], ["Climax proof, refusal, compromise or tragic failure", "climaxProof"], ["Ending image or reflection", "endingReflection"] ] as const).map(([label, key]) => <label className={key === "storyThreads" || key === "consequences" ? styles.wide : ""} key={key}>{label}<textarea value={themeMap[key]} onChange={(event) => setThemeMap({ ...themeMap, [key]: event.target.value })} /></label>)}</div><div className={styles.actions}><button type="button" onClick={saveThemeMap}>Save Theme Argument Map</button>{themeRecord ? <button type="button" onClick={() => { const { id: _id, kind: _kind, createdAt: _created, ...fields } = themeRecord; void _id; void _kind; void _created; setThemeMap(fields); }}>Load saved map</button> : null}</div></section>

    <section className={styles.panel} id="scene-pulse" hidden={scope !== "learn"}><header><span>Scene Pulse learning overlay</span><h2>{scene ? `Scene ${scene.number}: ${scene.title}` : "Select a scene"}</h2><p>Each diagnostic term includes plain language, evidence, a worked interpretation, a revision experiment and a direct controlling field.</p></header><div className={styles.pulseSummary}><article><strong>{scenePulse?.score.score ?? 0}%</strong><span>{scenePulse?.score.complete ?? 0} of {scenePulse?.score.total ?? 7} evidence areas currently represented</span></article><div>{scenePulse?.findings.length ? scenePulse.findings.map((finding) => <p key={finding.id}><strong>{finding.title}</strong> — {finding.reason}</p>) : <p>No current Scene Pulse finding; verify the evidence remains playable.</p>}</div></div><div className={styles.overlayGrid}>{scenePulseLearningOverlay.map((item) => <article key={item.term}><span>{item.term}</span><h3>{item.meaning}</h3><p><strong>Why it matters:</strong> {item.why}</p><p><strong>Current evidence:</strong> {item.term === "Pressure Lock" ? scene?.opposition || scene?.conflict || "Not recorded" : item.term === "Cut Line" ? `${scene?.entryCondition || "No entry"} → ${scene?.exitCondition || scene?.outcome || "No exit"}` : item.term === "Pivot" ? scene?.reversal || scene?.turn || "Not recorded" : item.term === "Value flip" ? `${scene?.entryCondition || "No entry value"} → ${scene?.exitCondition || "No exit value"}` : `${scene?.outcome || scene?.exitCondition || "No handoff"}`}</p><p><strong>Revision experiment:</strong> {item.experiment}</p><Link href="/structure">Open {item.field}</Link></article>)}</div></section>

    <section className={styles.panel} id="evidence" hidden={scope !== "learn"}><header><span>Screen Evidence Translator</span><h2>Turn internal meaning into visible, audible or performable evidence</h2><p>Selected evidence directs attention. It does not inventory every object or routinely dictate camera coverage.</p></header><div className={styles.evidenceStats}><span>{screenEvidenceCounts.action} action elements</span><span>{screenEvidenceCounts.dialogue} dialogue elements</span><span>{screenEvidenceCounts.shots} shot records</span><span>{screenEvidenceCounts.sound} Sonic cues</span><span>{screenEvidenceCounts.transitions} transitions</span><span>{screenEvidenceCounts.notes} hidden/internal notes</span></div><div className={styles.formGrid}>{([ ["Abstract claim", "abstractClaim"], ["Action or refusal", "actionOrRefusal"], ["Objective or altered tactic", "objectiveOrTactic"], ["Object, spatial distance or blocking", "objectOrSpace"], ["Sound or silence", "soundOrSilence"], ["Dialogue or subtext", "dialogueOrSubtext"], ["Repeated behaviour with variation", "repetitionWithVariation"], ["Why narration creates otherwise unavailable meaning", "narrationReason"] ] as const).map(([label, key]) => <label key={key}>{label}<textarea value={screenEvidence[key]} onChange={(event) => setScreenEvidence({ ...screenEvidence, [key]: event.target.value })} /></label>)}</div><div className={styles.actions}><button type="button" disabled={!screenEvidence.abstractClaim.trim()} onClick={saveScreenEvidence}>Save screen-evidence experiment</button><Link href="/pageflow">Open PageFlow</Link></div></section>

    <section className={styles.panel} id="motif" hidden={scope !== "plan"}><header><span>Motif and Echo Ledger</span><h2>Track literal context, repetition, meaning change and payoff</h2><p>Symbols do not have fixed universal meanings. Context, culture, accessibility, production and variation establish the pattern.</p></header><div className={styles.formGrid}>{([ ["Motif name", "name"], ["Medium", "medium"], ["Literal introduction", "literalIntroduction"], ["Repetitions", "repetitions"], ["Meaning shifts", "meaningShifts"], ["Associated characters, locations or Story Threads", "associations"], ["Visual, dialogue, sound or music appearances", "appearances"], ["Payoff, reversal or deliberately unresolved ending", "intendedEnding"], ["Continuity requirements", "continuity"] ] as const).map(([label, key]) => <label className={key === "associations" || key === "appearances" ? styles.wide : ""} key={key}>{label}<textarea value={motif[key]} onChange={(event) => setMotif({ ...motif, [key]: event.target.value })} /></label>)}</div><div className={styles.actions}><button type="button" disabled={!motif.name.trim()} onClick={saveMotif}>Add motif ledger entry</button><Link href="/resonance">Open Resonance</Link></div><div className={styles.recordGrid}>{motifRecords.length ? motifRecords.map(({ record }) => <article key={record.id}><small>{record.medium}</small><h3>{record.name}</h3><p>{record.literalIntroduction}</p><p><strong>Meaning shift:</strong> {record.meaningShifts || "Not recorded"}</p><p><strong>Ending:</strong> {record.intendedEnding || "Not recorded"}</p></article>) : <p>No motif records yet.</p>}</div></section>

    <section className={styles.panel} id="formatting" hidden={scope !== "learn"}><header><span>Advanced formatting toolbox</span><h2>Preview the dramatic form before manual insertion</h2><p>Formatting is not decoration. Each technique includes purpose, export behaviour, common misuse and the appropriate drafting layer.</p></header><div className={styles.formatLayout}><aside>{advancedFormattingTemplates.map((item) => <button type="button" className={item.id === selectedFormat.id ? styles.selected : ""} onClick={() => chooseFormatTemplate(item.id)} key={item.id}>{item.label}</button>)}</aside><main><h3>{selectedFormat.label}</h3><p><strong>Dramatic purpose:</strong> {selectedFormat.purpose}</p><p><strong>Export:</strong> {selectedFormat.preserves}</p><p><strong>Common misuse:</strong> {selectedFormat.misuse}</p><p><strong>Layer:</strong> {selectedFormat.layer}</p><label>Editable Fountain-style preview<textarea rows={11} value={formatText} onChange={(event) => setFormatText(event.target.value)} /></label><div className={styles.actions}><button type="button" onClick={copyFormatText}>Copy edited preview</button><Link href="/pageflow">Open screenplay/PageFlow guidance</Link></div><p className={styles.safety} aria-live="polite">{formatStatus}</p></main></div></section>

    <section className={styles.panel} hidden={scope !== "learn"}><header><span>Essential technique library</span><h2>Searchable audience-effect lenses, not required fields</h2><p>Each lens identifies the intended audience effect, supporting evidence, likely failure and the most useful PlotPickle workspace.</p></header><div className={styles.techniqueGrid}>{essentialTechniqueLibrary.map((item) => <article key={item.id}><span>{item.label}</span><p><strong>Audience effect:</strong> {item.effect}</p><p><strong>Evidence:</strong> {item.evidence}</p><p><strong>Where it can fail:</strong> {item.failure}</p><p><strong>Apply in:</strong> {item.workspace}</p></article>)}</div></section>

    <section className={styles.panel} id="audit" hidden={scope !== "refine"}><header><span>Essential Craft Audit</span><h2>Diagnose evidence before rewriting</h2><p>The audit produces questions and priorities rather than a universal score or automatic rewrite.</p></header><div className={styles.auditSteps}>{storyCraftAuditSteps.map((item, index) => <label key={item}><input type="checkbox" checked={auditSteps.includes(item)} onChange={(event) => setAuditSteps((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} /><span>{index + 1}</span>{item}</label>)}</div><div className={styles.formGrid}><label className={styles.wide}>Three evidence-based questions<textarea value={auditQuestions} onChange={(event) => setAuditQuestions(event.target.value)} /></label><label>Root cause separated from symptom<textarea value={auditRootCause} onChange={(event) => setAuditRootCause(event.target.value)} /></label><label>Bounded next revision priority<textarea value={auditPriority} onChange={(event) => setAuditPriority(event.target.value)} /></label></div><div className={styles.actions}><button type="button" disabled={!auditQuestions.trim() || !auditRootCause.trim() || !auditPriority.trim()} onClick={saveAudit}>Save Essential Craft Audit</button><Link href="/draftlens">Open DraftLens</Link><Link href="/craftloop">Open CraftLoop</Link></div><div className={styles.recordGrid}>{auditRecords.map(({ record }) => <article key={record.id}><small>{record.selectedSteps.length} steps reviewed</small><h3>{record.revisionPriority}</h3><p><strong>Root cause:</strong> {record.rootCause}</p><p>{record.evidenceQuestions}</p></article>)}</div></section>

    <section className={styles.panel}><header><span>Contextual recommendations</span><h2>Recommended for Block {blockNumber}.{miniBlockNumber}</h2><p>Recommendations follow the active work and remain optional. Opening a lesson or engine does not run AI or change the story.</p></header><div className={styles.recommendations}>{recommendations.map((id) => <Link href={`/read-learn?lesson=${id}`} key={id}>{id.replace("essentials-", "").replaceAll("-", " ")}</Link>)}<Link href="/structure">Structure and Story Clock</Link><Link href="/resonance">Resonance</Link><Link href="/pageflow">PageFlow</Link><Link href="/draftlens">DraftLens</Link><Link href="/production">Storyboard and Production</Link><Link href="/pitch-review">Pitch & Vision</Link></div></section>

    <footer className={styles.footer}><strong>Approval boundary</strong><p>Manual and no-AI workflows are complete. Optional AI may help assemble or compare a bounded pass, but output remains non-canonical until the writer reviews and explicitly approves it. Revision improves purpose, evidence and execution; it does not create an objectively perfect final draft.</p></footer>
  </main>;
}
