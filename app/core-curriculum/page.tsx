"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type PlotPickleProject,
  type ReviewThread,
} from "@/lib/project";
import {
  coreGuideFor,
  coreModule,
  coreModuleGuides,
  coreRecommendations,
  coreRoutes,
  coreSourceMap,
  coreStages,
  type CoreRouteId,
} from "../learning-core-curriculum";
import styles from "./core-curriculum.module.css";

const PROJECT_STORAGE_KEY = "plotpickle.project.v1";
const READING_STORAGE_KEY = "plotpickle-core-reading.v1";
const ROUTE_STORAGE_PREFIX = "plotpickle-core-route:";
const MARKER = "PLOTPICKLE_CORE_LEARNING_RECORD\n";

type CoreLearningRecord = {
  id: string;
  kind: "core-learning-evidence";
  moduleId: string;
  exerciseAttempted: boolean;
  exerciseNote: string;
  appliedToProject: boolean;
  appliedEvidence: string;
  revisit: boolean;
  projectUpdatedAt: string;
  updatedAt: string;
};

const focusAreas = [
  { id: "character", label: "Character", moduleId: "character-bible", href: "/characters-in-motion" },
  { id: "dialogue", label: "Dialogue", moduleId: "formatting", href: "/dialogue-in-motion" },
  { id: "scene", label: "Scene", moduleId: "challenges", href: "/story-craft-essentials#scene-pulse" },
  { id: "structure", label: "Structure", moduleId: "structures", href: "/structure" },
  { id: "pacing", label: "Pacing", moduleId: "challenges", href: "/story-craft-essentials#pacing" },
  { id: "theme", label: "Theme", moduleId: "concept-to-draft", href: "/story-craft-essentials#theme" },
  { id: "world", label: "World", moduleId: "world-building", href: "/story-craft-essentials#evidence" },
  { id: "collaboration", label: "Collaboration", moduleId: "story-bible", href: "/working-together" },
  { id: "formatting", label: "Formatting", moduleId: "formatting", href: "/story-craft-essentials#formatting" },
  { id: "ai", label: "AI", moduleId: "responsible-ai", href: "/labs" },
] as const;

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.()
    ? `${prefix}-${globalThis.crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function encode(record: CoreLearningRecord) {
  return `${MARKER}${JSON.stringify(record)}`;
}

function decode(thread: ReviewThread): CoreLearningRecord | null {
  const body = thread.comments[0]?.body ?? "";
  if (!body.startsWith(MARKER)) return null;
  try {
    const record = JSON.parse(body.slice(MARKER.length)) as CoreLearningRecord;
    return record.kind === "core-learning-evidence" ? record : null;
  } catch {
    return null;
  }
}

function moduleTitle(moduleId: string) {
  return coreModule(moduleId)?.title ?? moduleId;
}

function saveLocalProject(project: PlotPickleProject) {
  window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
}

export default function CoreCurriculumPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [routeId, setRouteId] = useState<CoreRouteId>("idea");
  const [focusAreaId, setFocusAreaId] = useState<(typeof focusAreas)[number]["id"]>("character");
  const [readModules, setReadModules] = useState<Set<string>>(new Set());
  const [selectedModuleId, setSelectedModuleId] = useState("pitch");
  const [exerciseNote, setExerciseNote] = useState("");
  const [appliedEvidence, setAppliedEvidence] = useState("");
  const [notice, setNotice] = useState("Loading the active project and local learning preferences…");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
        const normalized = stored ? normalizePlotPickleProject(JSON.parse(stored)) : null;
        const active = normalized ?? createBlankProject();
        setProject(active);
        const savedRoute = window.localStorage.getItem(`${ROUTE_STORAGE_PREFIX}${active.id}`) as CoreRouteId | null;
        if (savedRoute && coreRoutes.some((route) => route.id === savedRoute)) setRouteId(savedRoute);
        const savedReading = window.localStorage.getItem(READING_STORAGE_KEY);
        setReadModules(new Set(savedReading ? JSON.parse(savedReading) as string[] : []));
        setNotice(normalized
          ? "Connected to the active local PlotPickle project. The route is advisory and does not lock workspaces or alter story canon."
          : "No saved project was found. A blank project is ready, and generic reading progress remains local to this browser.");
      } catch {
        setNotice("The saved project or learning preferences could not be read. A blank local curriculum is available.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const projectRecords = useMemo(() => project.review.threads
    .map((thread) => ({ thread, record: decode(thread) }))
    .filter((item): item is { thread: ReviewThread; record: CoreLearningRecord } => Boolean(item.record)), [project.review.threads]);
  const recordByModule = useMemo(() => new Map(projectRecords.map((item) => [item.record.moduleId, item.record])), [projectRecords]);
  const recommendations = useMemo(() => coreRecommendations(project, routeId), [project, routeId]);
  const selectedModule = coreModule(selectedModuleId) ?? coreModule("pitch");
  const selectedGuide = selectedModule ? coreGuideFor(selectedModule.id) : undefined;
  const selectedRecord = selectedModule ? recordByModule.get(selectedModule.id) : undefined;
  const selectedRecommendation = selectedModule ? recommendations.find((item) => item.moduleId === selectedModule.id) : undefined;
  const route = coreRoutes.find((item) => item.id === routeId) ?? coreRoutes[0];
  const focusArea = focusAreas.find((item) => item.id === focusAreaId) ?? focusAreas[0];

  useEffect(() => {
    if (!recommendations.length) return;
    const focusModuleId = routeId === "focused-problem" ? focusArea.moduleId : "";
    const preferred = recommendations.find((item) => item.moduleId === focusModuleId) ?? recommendations[0];
    if (preferred && !coreModule(selectedModuleId)) setSelectedModuleId(preferred.moduleId);
  }, [focusArea.moduleId, recommendations, routeId, selectedModuleId]);

  useEffect(() => {
    setExerciseNote(selectedRecord?.exerciseNote ?? "");
    setAppliedEvidence(selectedRecord?.appliedEvidence ?? "");
  }, [selectedModuleId, selectedRecord?.appliedEvidence, selectedRecord?.exerciseNote]);

  const readCount = coreModuleGuides.filter((guide) => readModules.has(guide.moduleId)).length;
  const exerciseCount = coreModuleGuides.filter((guide) => recordByModule.get(guide.moduleId)?.exerciseAttempted).length;
  const appliedCount = coreModuleGuides.filter((guide) => recordByModule.get(guide.moduleId)?.appliedToProject).length;
  const revisitCount = coreModuleGuides.filter((guide) => recordByModule.get(guide.moduleId)?.revisit).length;

  function chooseRoute(nextRouteId: CoreRouteId) {
    setRouteId(nextRouteId);
    try {
      window.localStorage.setItem(`${ROUTE_STORAGE_PREFIX}${project.id}`, nextRouteId);
    } catch {
      // The route remains usable during the session when storage is unavailable.
    }
    const nextRoute = coreRoutes.find((item) => item.id === nextRouteId);
    if (nextRoute?.moduleIds[0]) setSelectedModuleId(nextRoute.moduleIds[0]);
    setNotice("Learning route updated. It is a local recommendation only and every lesson and workspace remains available.");
  }

  function markRead(moduleId: string) {
    setReadModules((current) => {
      const next = new Set(current);
      next.add(moduleId);
      try {
        window.localStorage.setItem(READING_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Generic reading progress remains usable without persistence.
      }
      return next;
    });
    setNotice(`${moduleTitle(moduleId)} marked Read in local browser preferences.`);
  }

  function saveProjectRecord(moduleId: string, changes: Partial<Pick<CoreLearningRecord, "exerciseAttempted" | "exerciseNote" | "appliedToProject" | "appliedEvidence" | "revisit">>, message: string) {
    const existing = recordByModule.get(moduleId);
    const now = new Date().toISOString();
    const record: CoreLearningRecord = {
      id: existing?.id ?? makeId("core-learning"),
      kind: "core-learning-evidence",
      moduleId,
      exerciseAttempted: existing?.exerciseAttempted ?? false,
      exerciseNote: existing?.exerciseNote ?? "",
      appliedToProject: existing?.appliedToProject ?? false,
      appliedEvidence: existing?.appliedEvidence ?? "",
      revisit: existing?.revisit ?? false,
      ...changes,
      projectUpdatedAt: now,
      updatedAt: now,
    };
    const thread: ReviewThread = {
      id: record.id,
      title: `[Core Curriculum] ${moduleTitle(moduleId)}`,
      anchor: { kind: "project", targetId: project.id, label: `${project.metadata.title || "Untitled project"} · ${moduleTitle(moduleId)}` },
      status: record.revisit ? "deferred" : record.appliedToProject ? "resolved" : "in-review",
      priority: "normal",
      comments: [{ id: makeId("core-learning-comment"), author: "Writer", body: encode(record), createdAt: now }],
      createdAt: projectRecords.find((item) => item.record.id === record.id)?.thread.createdAt ?? now,
      updatedAt: now,
      resolvedAt: record.appliedToProject && !record.revisit ? now : "",
    };
    const next: PlotPickleProject = {
      ...project,
      metadata: { ...project.metadata, updatedAt: now },
      review: { ...project.review, threads: [...project.review.threads.filter((item) => item.id !== record.id), thread] },
    };
    saveLocalProject(next);
    setProject(next);
    setNotice(message);
  }

  function selectModule(moduleId: string) {
    setSelectedModuleId(moduleId);
    window.setTimeout(() => document.getElementById("core-module-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <span>PlotPickle learning-router spine</span>
        <h1>Core Curriculum</h1>
        <p>The existing fourteen General modules now form a five-stage map into every PlotPickle workspace and deeper craft collection. Start anywhere, skip anything that is not useful and return when the project evidence changes.</p>
      </div>
      <nav>
        <Link className={styles.primaryLink} href="/read-learn">Complete Learning Library</Link>
        <Link href="/">Back to PlotPickle</Link>
      </nav>
    </header>

    <section className={styles.orientation}>
      <Link href="/read-learn"><strong>Browse the Complete Learning Library</strong><span>All modules and specialized collections remain immediately available.</span></Link>
      <div><strong>Use the Core Curriculum</strong><span>Choose a route and receive project-evidence explanations without onboarding locks.</span></div>
    </section>

    <p className={styles.notice} aria-live="polite">{notice}</p>

    <section className={styles.progress} aria-label="Core curriculum progress">
      <article><strong>{readCount}/14</strong><span>Read · browser preference</span></article>
      <article><strong>{exerciseCount}/14</strong><span>Exercise attempted · project record</span></article>
      <article><strong>{appliedCount}/14</strong><span>Applied to project</span></article>
      <article><strong>{revisitCount}/14</strong><span>Marked Revisit</span></article>
    </section>

    <section className={styles.panel} id="route-selector">
      <header><span>Where are you starting?</span><h2>Choose an editable recommendation route</h2><p>The selection stays local to this project and browser. It does not become story canon or prevent access to any lesson, engine or workspace.</p></header>
      <div className={styles.routeGrid}>{coreRoutes.map((item) => <button type="button" className={routeId === item.id ? styles.activeRoute : ""} onClick={() => chooseRoute(item.id)} key={item.id}><strong>{item.label}</strong><span>{item.summary}</span><small>{item.destination}</small></button>)}</div>
      {routeId === "focused-problem" ? <div className={styles.focusPicker}><label>Focused area<select value={focusAreaId} onChange={(event) => { const next = event.target.value as (typeof focusAreas)[number]["id"]; setFocusAreaId(next); const area = focusAreas.find((item) => item.id === next); if (area) setSelectedModuleId(area.moduleId); }}>{focusAreas.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><Link href={focusArea.href}>Open {focusArea.label} workspace</Link></div> : null}
    </section>

    <section className={styles.recommendation}>
      <div><span>Why this lesson now</span><h2>{moduleTitle(recommendations[0]?.moduleId ?? route.moduleIds[0])}</h2><p>{recommendations[0]?.reason ?? `This module begins the selected “${route.label}” route.`}</p><ul>{recommendations[0]?.evidence.map((item) => <li key={item}>{item}</li>)}</ul><strong>{recommendations[0]?.question}</strong></div>
      <button type="button" onClick={() => selectModule(recommendations[0]?.moduleId ?? route.moduleIds[0])}>Review recommendation</button>
    </section>

    <section className={styles.panel}>
      <header><span>Five-stage learning spine</span><h2>Orientation without a mandatory order</h2><p>Stages explain how the broad modules connect. “Recommended before” and “Useful after” are advisory relationships, never prerequisites.</p></header>
      <div className={styles.stageList}>{coreStages.map((stage) => <section key={stage.id}><header><b>Stage {stage.number}</b><div><h3>{stage.title}</h3><p>{stage.outcome}</p></div></header><div className={styles.moduleGrid}>{stage.moduleIds.map((moduleId) => {
        const module = coreModule(moduleId);
        const guide = coreGuideFor(moduleId);
        const record = recordByModule.get(moduleId);
        const recommendation = recommendations.find((item) => item.moduleId === moduleId);
        if (!module || !guide) return null;
        return <article className={selectedModuleId === moduleId ? styles.selectedCard : ""} key={moduleId}>
          <div className={styles.cardMeta}><span>Module {module.number}</span>{recommendation ? <strong>Recommended</strong> : null}</div>
          <h4>{module.title}</h4>
          <p>{module.overview}</p>
          {recommendation ? <small>{recommendation.reason}</small> : null}
          <div className={styles.statuses}><span className={readModules.has(moduleId) ? styles.done : ""}>Read</span><span className={record?.exerciseAttempted ? styles.done : ""}>Exercise</span><span className={record?.appliedToProject ? styles.done : ""}>Applied</span><span className={record?.revisit ? styles.revisit : ""}>Revisit</span></div>
          <button type="button" onClick={() => selectModule(moduleId)}>Open core lesson panel</button>
        </article>;
      })}</div><div className={styles.stageLinks}>{stage.primaryLinks.map((item) => <span key={item}>{item}</span>)}</div></section>)}</div>
    </section>

    {selectedModule && selectedGuide ? <section className={styles.detail} id="core-module-detail">
      <header><span>Core module {selectedModule.number} · Stage {coreStages.find((stage) => stage.id === selectedGuide.stageId)?.number}</span><h2>{selectedModule.title}</h2><p>{selectedModule.overview}</p></header>
      {selectedRecommendation ? <section className={styles.why}><strong>Why this lesson now</strong><p>{selectedRecommendation.reason}</p><ul>{selectedRecommendation.evidence.map((item) => <li key={item}>{item}</li>)}</ul><b>{selectedRecommendation.question}</b></section> : null}
      <div className={styles.applicationGrid}>
        <article><span>Understand</span><p>{selectedGuide.understand}</p></article>
        <article><span>See it</span><p>{selectedGuide.seeIt}</p><small>{selectedModule.example.title}: {selectedModule.example.text}</small></article>
        <article><span>Try it</span><p>{selectedGuide.tryIt}</p><small>{selectedModule.exercise}</small></article>
        <article><span>Apply it</span><p>Open the relevant PlotPickle workspace without automatically changing story material.</p><Link href={selectedGuide.applyHref}>{selectedGuide.applyLabel}</Link></article>
        <article><span>Check it</span><p>Use project evidence and diagnostics to see what changed.</p><Link href={selectedGuide.checkHref}>{selectedGuide.checkLabel}</Link></article>
        <article><span>Go deeper</span><p>Branch into the specialized collection when the foundational orientation is not enough.</p><Link href={selectedGuide.deeperHref}>{selectedGuide.deeperLabel}</Link></article>
      </div>
      <section className={styles.relationships}><div><strong>Recommended before</strong>{selectedGuide.recommendedBefore.length ? selectedGuide.recommendedBefore.map((item) => <button type="button" onClick={() => selectModule(item)} key={item}>{moduleTitle(item)}</button>) : <span>No prerequisite</span>}</div><div><strong>Useful after</strong>{selectedGuide.usefulAfter.map((item) => <button type="button" onClick={() => selectModule(item)} key={item}>{moduleTitle(item)}</button>)}</div><p><b>Common next problem:</b> {selectedGuide.commonNextProblem}</p></section>
      <section className={styles.adaptation}><span>Source and adaptation</span><p><strong>{selectedGuide.sourceTitle}</strong> → {selectedModule.title}</p><p>{selectedGuide.adaptation}</p><small>Adapted from the original 24 Blocks General learning archive and rewritten for PlotPickle’s current local-first workflow. The legacy source is not required to understand this lesson.</small></section>
      <section className={styles.evidenceEditor}>
        <header><span>Private project learning evidence</span><h3>Record the exercise and application separately from generic reading</h3><p>These notes use an existing project review record and travel with the `.ppf` project. They are not shared unless the writer intentionally shares the project or proposal.</p></header>
        <label>Exercise note or decision<textarea value={exerciseNote} onChange={(event) => setExerciseNote(event.target.value)} placeholder="What did you try, observe or decide in the active project?" /></label>
        <label>Applied-to-project evidence<textarea value={appliedEvidence} onChange={(event) => setAppliedEvidence(event.target.value)} placeholder="Which field, Block, scene, screenplay element, report or decision now shows the application?" /></label>
        <div className={styles.evidenceActions}>
          <button type="button" className={readModules.has(selectedModule.id) ? styles.doneButton : ""} onClick={() => markRead(selectedModule.id)}>{readModules.has(selectedModule.id) ? "Read" : "Mark Read"}</button>
          <button type="button" onClick={() => saveProjectRecord(selectedModule.id, { exerciseAttempted: true, exerciseNote, revisit: false }, `${selectedModule.title} exercise evidence saved with the project.`)}>Save exercise attempted</button>
          <button type="button" onClick={() => saveProjectRecord(selectedModule.id, { exerciseAttempted: true, exerciseNote, appliedToProject: true, appliedEvidence, revisit: false }, `${selectedModule.title} marked Applied to project with evidence.`)}>Mark Applied to project</button>
          <button type="button" onClick={() => saveProjectRecord(selectedModule.id, { exerciseNote, appliedEvidence, revisit: true }, `${selectedModule.title} marked Revisit. This is an invitation, not a warning or lock.`)}>Mark Revisit</button>
        </div>
        {selectedRecord ? <p className={styles.recordStatus}>Saved: exercise {selectedRecord.exerciseAttempted ? "attempted" : "not recorded"} · application {selectedRecord.appliedToProject ? "recorded" : "not recorded"} · revisit {selectedRecord.revisit ? "yes" : "no"} · updated {new Date(selectedRecord.updatedAt).toLocaleString()}</p> : null}
      </section>
    </section> : null}

    <section className={styles.panel}>
      <header><span>Legacy General source map</span><h2>Fourteen sources, fourteen existing modules, no duplicate collection</h2><p>The current lessons are the curriculum. This map documents how the original archive was PlotPickled and preserves legacy phrases for search.</p></header>
      <div className={styles.sourceMap}>{coreSourceMap.map((item) => <article key={item.legacy}><strong>{item.legacy}</strong><span>→ {moduleTitle(item.moduleId)}</span><p>{item.change}</p></article>)}</div>
    </section>

    <footer className={styles.footer}><Link className={styles.primaryLink} href="/read-learn">Complete Learning Library</Link><Link href="/story-craft-essentials">Story Craft Essentials</Link><Link href="/working-together">Working Together</Link><Link href="/dialogue-in-motion">Dialogue in Motion</Link></footer>
  </main>;
}
