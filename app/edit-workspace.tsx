"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlotPickleProject, ScreenplayDraftElement } from "@/lib/project";
import { createBlankProject, normalizePlotPickleProject } from "@/lib/project";
import { buildGlobalSceneIndex } from "@/lib/scene-management";
import { reconcileProductionDraft } from "@/lib/production-draft";
import { isAfterglowExampleProject } from "@/lib/afterglow-example";
import ApplicationShellHeader from "./application-shell-header";
import styles from "./edit-workspace.module.css";

const STORAGE_KEY = "plotpickle.project.v1";
type EditLens = "scene" | "dialogue" | "action" | "pacing" | "continuity";

const LENSES: { id: EditLens; label: string; description: string }[] = [
  { id: "scene", label: "Scene", description: "Objective, conflict, turn and outcome" },
  { id: "dialogue", label: "Dialogue", description: "Voice, subtext, exposition and distinction" },
  { id: "action", label: "Action", description: "Visual specificity, economy and playable action" },
  { id: "pacing", label: "Pacing", description: "Rhythm, repetition, escalation and scene length" },
  { id: "continuity", label: "Continuity", description: "Characters, places, threads and visual canon" },
];

function requestedNumber(name: string, fallback: number, minimum: number, maximum: number) {
  if (typeof window === "undefined") return fallback;
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function workspaceHref(id: string) {
  if (id === "edit") return "/edit";
  const workspace = id === "planner" ? "plan"
    : id === "visuals" ? "storyboard"
      : id === "script" ? "write"
        : id === "pitch" ? "pitch"
          : id === "engines" ? "refine"
            : id;
  return `/?workspace=${encodeURIComponent(workspace)}`;
}

function loadStoredProject() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return createBlankProject();
    return normalizePlotPickleProject(JSON.parse(stored)) ?? createBlankProject();
  } catch {
    return createBlankProject();
  }
}

function elementLabel(element: ScreenplayDraftElement) {
  return element.type.replace(/-/g, " ");
}

export default function EditWorkspace() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [hydrated, setHydrated] = useState(false);
  const [lens, setLens] = useState<EditLens>("scene");
  const [blockNumber, setBlockNumber] = useState(1);
  const [miniBlockNumber, setMiniBlockNumber] = useState(1);
  const [message, setMessage] = useState("Edit reads the same canonical screenplay saved by Write.");

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setProject(loadStoredProject());
      setBlockNumber(requestedNumber("block", 1, 1, 24));
      setMiniBlockNumber(requestedNumber("mini", 1, 1, 4));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  const block = project.blocks[blockNumber - 1] ?? project.blocks[0];
  const minis = block?.scenes.flatMap((scene) => scene.miniBlocks) ?? [];
  const mini = minis.find((item) => item.number === miniBlockNumber) ?? minis[0];
  const sceneIndex = useMemo(() => buildGlobalSceneIndex(project.blocks), [project.blocks]);
  const sceneEntry = sceneIndex.find((entry) => entry.blockNumber === blockNumber && entry.miniBlockNumbers.includes(miniBlockNumber))
    ?? sceneIndex.find((entry) => entry.blockNumber === blockNumber);
  const scene = block?.scenes.find((item) => item.id === sceneEntry?.sceneId) ?? block?.scenes[0];
  const elements = project.screenplay.draftElements.filter((element) => (
    element.blockNumber === blockNumber
    && element.miniBlockNumber === miniBlockNumber
  ));
  const dialogue = elements.filter((element) => element.type === "dialogue");
  const action = elements.filter((element) => element.type === "action");
  const characters = (scene?.characterIds ?? [])
    .map((id) => project.characters.find((character) => character.id === id)?.name)
    .filter(Boolean);
  const locations = (scene?.locationIds ?? block?.locationIds ?? [])
    .map((id) => project.world.locations.find((location) => location.id === id)?.name)
    .filter(Boolean);
  const readOnly = isAfterglowExampleProject(project);

  function persist(next: PlotPickleProject) {
    if (readOnly) {
      setMessage("Afterglow is a read-only example. Make your own copy before changing screenplay text.");
      return;
    }
    const stamped: PlotPickleProject = {
      ...next,
      metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
    setProject(stamped);
    setMessage("Saved to the same canonical screenplay used by Write.");
  }

  function updateElement(id: string, text: string) {
    const nextElements = project.screenplay.draftElements.map((element) => element.id === id
      ? { ...element, text, updatedAt: new Date().toISOString() }
      : element);
    persist({
      ...project,
      screenplay: reconcileProductionDraft(project.screenplay, nextElements),
    });
  }

  function selectMoment(nextBlock: number, nextMini: number) {
    setBlockNumber(nextBlock);
    setMiniBlockNumber(nextMini);
    const url = new URL(window.location.href);
    url.searchParams.set("block", String(nextBlock));
    url.searchParams.set("mini", String(nextMini));
    window.history.replaceState({}, "", url);
    setMessage(`Reviewing Block ${nextBlock}.${nextMini} from the canonical screenplay.`);
  }

  const findings = lens === "scene" ? [
    scene?.purpose ? `Scene purpose: ${scene.purpose}` : "Scene purpose has not been defined in Plan yet.",
    scene?.conflict ? `Conflict: ${scene.conflict}` : "Conflict is not yet explicit for this scene.",
    scene?.turn ? `Turn: ${scene.turn}` : mini?.turn ? `Mini-block turn: ${mini.turn}` : "The turn is not yet explicit.",
    scene?.outcome ? `Outcome: ${scene.outcome}` : "Outcome is not yet explicit.",
  ] : lens === "dialogue" ? [
    `${dialogue.length} dialogue element${dialogue.length === 1 ? "" : "s"} in this story moment.`,
    dialogue.some((element) => element.text.length > 180) ? "At least one dialogue passage is long enough to merit a pace/subtext review." : "Dialogue passages are relatively compact.",
    characters.length ? `Scene characters: ${characters.join(", ")}.` : "No scene character assignments are recorded yet.",
  ] : lens === "action" ? [
    `${action.length} action element${action.length === 1 ? "" : "s"} in this story moment.`,
    action.some((element) => element.text.length > 320) ? "At least one action passage is dense; check for playable visual beats." : "Action passages are relatively compact.",
    mini?.visualBeat ? `Planned visual beat: ${mini.visualBeat}` : "No explicit visual beat is recorded for this mini-block.",
  ] : lens === "pacing" ? [
    `${elements.length} screenplay element${elements.length === 1 ? "" : "s"} attached to Block ${blockNumber}.${miniBlockNumber}.`,
    `${elements.reduce((total, element) => total + element.text.length, 0)} characters of screenplay text in this moment.`,
    mini?.entryState && mini?.exitState ? `Story movement: ${mini.entryState} → ${mini.exitState}.` : "Entry/exit state is not fully recorded yet.",
  ] : [
    characters.length ? `Characters: ${characters.join(", ")}.` : "No character continuity assignments are recorded for this scene.",
    locations.length ? `Locations: ${locations.join(", ")}.` : "No location continuity assignment is recorded for this scene.",
    scene?.threadIds?.length ? `${scene.threadIds.length} story thread${scene.threadIds.length === 1 ? "" : "s"} attached to this scene.` : "No story threads are attached to this scene.",
    "Approved Storyboard visual decisions remain attached to the same Block/mini-block; this Edit slice does not duplicate or replace them.",
  ];

  const writeHref = `/?workspace=write&block=${blockNumber}&mini=${miniBlockNumber}`;

  if (!hydrated) return <main className={styles.loading}>Opening the canonical screenplay…</main>;

  return (
    <div className={styles.shell}>
      <ApplicationShellHeader
        activeTab="edit"
        onNavigate={(id) => window.location.assign(workspaceHref(id))}
        onProjectAction={() => window.location.assign("/?workspace=dashboard")}
        onOpenLanding={() => window.location.assign("/")}
      />

      <div className={styles.projectStrip}>
        <div><strong>{project.metadata.title || "Untitled Story"}</strong><span>{readOnly ? "Read-only example" : "Canonical local screenplay"}</span></div>
        <span>Act {block?.act ?? 1} · Block {blockNumber} · Mini {blockNumber}.{miniBlockNumber} · Scene {sceneEntry?.globalNumber ?? scene?.number ?? "—"}</span>
      </div>

      <main className={styles.workspace}>
        <aside className={styles.lensRail}>
          <header><span>Edit</span><h1>Review the writing.</h1><p>One screenplay. Five review lenses.</p></header>
          <nav aria-label="Edit review lenses">
            {LENSES.map((item) => <button type="button" className={lens === item.id ? styles.activeLens : ""} aria-current={lens === item.id ? "page" : undefined} key={item.id} onClick={() => setLens(item.id)}><strong>{item.label}</strong><small>{item.description}</small></button>)}
          </nav>
          <footer><span>4 Acts</span><span>24 Blocks</span><span>96 mini-blocks</span></footer>
        </aside>

        <section className={styles.editorColumn}>
          <header className={styles.storyHeader}>
            <div><span>Review this story moment</span><h2>{block?.title || `Block ${blockNumber}`} · {mini?.label || `Mini ${miniBlockNumber}`}</h2><p>{mini?.function || mini?.purpose || scene?.purpose || "Review the screenplay material attached to this canonical story position."}</p></div>
            <a href={writeHref}>Back to Write {blockNumber}.{miniBlockNumber}</a>
          </header>

          <nav className={styles.momentNavigator} aria-label="Edit story position">
            {project.blocks.map((item) => <button type="button" className={item.number === blockNumber ? styles.activeBlock : ""} key={item.id} onClick={() => selectMoment(item.number, 1)}>{String(item.number).padStart(2, "0")}</button>)}
          </nav>
          <div className={styles.miniNavigator}>{[1, 2, 3, 4].map((number) => <button type="button" className={number === miniBlockNumber ? styles.activeMini : ""} key={number} onClick={() => selectMoment(blockNumber, number)}><span>{blockNumber}.{number}</span><strong>{minis.find((item) => item.number === number)?.label || `Mini ${number}`}</strong></button>)}</div>

          <section className={styles.scriptPanel} aria-label={`Canonical screenplay elements for Block ${blockNumber}.${miniBlockNumber}`}>
            <div className={styles.scriptPanelHead}><span>Canonical screenplay</span><strong>{elements.length} element{elements.length === 1 ? "" : "s"}</strong></div>
            {!elements.length ? <div className={styles.empty}><strong>No screenplay text is attached here yet.</strong><p>Return to Write to create the scene. Edit never creates a shadow draft.</p><a href={writeHref}>Write this moment</a></div> : null}
            {elements.map((element) => <article className={styles.element} key={element.id}>
              <div><span>{elementLabel(element)}</span><small>S{element.sceneNumber} · B{element.blockNumber}.{element.miniBlockNumber}</small></div>
              <textarea aria-label={`Edit ${elementLabel(element)} ${element.id}`} value={element.text} rows={Math.max(2, Math.ceil(element.text.length / 70))} readOnly={readOnly || element.locked} onChange={(event) => updateElement(element.id, event.target.value)} />
              {element.locked ? <small>Locked in the production draft. Return to Write/Production controls to unlock.</small> : null}
            </article>)}
          </section>
        </section>

        <aside className={styles.reviewPanel}>
          <header><span>{LENSES.find((item) => item.id === lens)?.label} review</span><h2>What deserves attention?</h2><p>This slice diagnoses existing material only. It does not generate or apply replacement wording.</p></header>
          <div className={styles.findings}>{findings.map((finding) => <p key={finding}>{finding}</p>)}</div>
          <section className={styles.contextCard}><span>Story context</span><dl><div><dt>Objective</dt><dd>{mini?.objective || scene?.objective || "Not recorded yet."}</dd></div><div><dt>Resistance</dt><dd>{mini?.resistance || scene?.conflict || block?.conflict || "Not recorded yet."}</dd></div><div><dt>Turn</dt><dd>{mini?.turn || scene?.turn || block?.choice || "Not recorded yet."}</dd></div><div><dt>Outcome</dt><dd>{scene?.outcome || block?.consequence || "Not recorded yet."}</dd></div></dl></section>
          <p className={styles.status} role="status">{message}</p>
          <small>Manual edits save to the same local screenplay. AI suggestions and Accept / Rewrite / Ignore / Compare arrive in the next #461 slice.</small>
        </aside>
      </main>
    </div>
  );
}
