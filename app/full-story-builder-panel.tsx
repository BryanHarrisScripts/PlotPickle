"use client";

import { useEffect, useMemo, useState } from "react";
import { requestPlotPickleConfirmation } from "./common-overlay-layer";
import styles from "./full-story-builder-panel.module.css";

const ACTIVE_JOB_KEY = "plotpickle.full-story-builder.job.v1";
const PROJECT_KEY = "plotpickle.project.v1";

type VisualMode = "prompts-only" | "local-if-available" | "paid-cloud";
type PublicJob = { id: string; status: "queued" | "running" | "completed" | "failed"; title: string; stage: string; progress: number; warnings: string[]; error: string; fileName: string; result: null | { targetPages?: number; estimatedPages?: number; blockCount?: number; miniBlockCount?: number; screenplayWordCount?: number; visualCount?: number; archived?: boolean; continuedProjectId?: string } };
type BuilderStatus = { available: boolean; worker: null | { id: string; lastSeenAt: string }; jobs: PublicJob[] };

const initialBrief = {
  title: "", premise: "", genre: "Character-driven speculative mystery", tone: "Tense, intimate and visually tactile, with earned warmth", protagonist: "", protagonistGoal: "", opposition: "", theme: "", setting: "", visualLanguage: "Matte charcoal interiors, weathered brass, hard window light, handmade maps and restrained amber accents", audience: "Adult and crossover audiences", contentRating: "PG-13", language: "English", projectOwner: "",
};

async function requestJson(pathname: string, init?: RequestInit) {
  const response = await fetch(pathname, init);
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message || "The Full Story Builder request could not be completed.");
  return body as Record<string, unknown>;
}

function object(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
function text(value: unknown, fallback = "") { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function activeProjectBrief(projectInput: unknown, fallback: typeof initialBrief) {
  const project = object(projectInput); const story = object(project.story); const world = object(project.world); const metadata = object(project.metadata); const rights = object(project.rights);
  const characters = Array.isArray(project.characters) ? project.characters : []; const protagonist = characters.find((item) => /protagonist/i.test(String(item?.role || ""))) || characters[0] || {};
  const locations = Array.isArray(world.locations) ? world.locations : []; const location = locations[0] || {};
  return {
    title: text(metadata.title || project.title || story.title, fallback.title), premise: text(story.premise || story.logline, fallback.premise), genre: text(metadata.genre || story.genre, fallback.genre), tone: text(story.tone || world.tone, fallback.tone), protagonist: text(protagonist.name, fallback.protagonist), protagonistGoal: text(protagonist.want || story.protagonistGoal, fallback.protagonistGoal), opposition: text(story.opposition || story.antagonist, fallback.opposition), theme: text(story.theme, fallback.theme), setting: text(location.name || world.ordinaryWorld || world.newWorld, fallback.setting), visualLanguage: text(world.visualLanguage, fallback.visualLanguage), audience: text(metadata.audience || story.audience, fallback.audience), contentRating: text(metadata.contentRating, fallback.contentRating), language: text(metadata.language, fallback.language), projectOwner: text(rights.projectOwner, fallback.projectOwner),
  };
}

export default function FullStoryBuilderPanel() {
  const [expanded, setExpanded] = useState(false); const [brief, setBrief] = useState(initialBrief); const [visualMode, setVisualMode] = useState<VisualMode>("local-if-available"); const [maximumVisuals, setMaximumVisuals] = useState(4); const [paidConsent, setPaidConsent] = useState(false); const [status, setStatus] = useState<BuilderStatus | null>(null); const [job, setJob] = useState<PublicJob | null>(null); const [working, setWorking] = useState(false); const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false; const savedJobId = window.localStorage.getItem(ACTIVE_JOB_KEY) || "";
    const refresh = async () => {
      try {
        const result = await requestJson("/api/full-story-builder/status") as unknown as BuilderStatus & { ok?: boolean }; if (cancelled) return; setStatus(result);
        const relevant = result.jobs.find((item) => item.id === (job?.id || savedJobId)) || result.jobs.find((item) => item.status === "queued" || item.status === "running") || null;
        if (relevant) { setJob(relevant); window.localStorage.setItem(ACTIVE_JOB_KEY, relevant.id); }
      } catch { if (!cancelled) setStatus(null); }
    };
    void refresh(); const timer = window.setInterval(refresh, job?.status === "queued" || job?.status === "running" ? 2_500 : 10_000); return () => { cancelled = true; window.clearInterval(timer); };
  }, [job?.id, job?.status]);

  const consentStatement = useMemo(() => `I authorize up to ${maximumVisuals} paid image requests for this Full Story Builder job.`, [maximumVisuals]);
  const active = job?.status === "queued" || job?.status === "running";
  function updateBrief(field: keyof typeof initialBrief, value: string) { setBrief((current) => ({ ...current, [field]: value })); }

  async function startJob() {
    if (active || working) return;
    if (visualMode === "paid-cloud" && !paidConsent) { setNotice("Confirm the exact paid-image limit before starting this cloud visual option."); return; }
    setWorking(true); setNotice("");
    try {
      let sourceFileName = ""; let sourceProjectId = ""; let resolvedBrief = brief;
      const stored = window.localStorage.getItem(PROJECT_KEY);
      if (stored) {
        const activeProject = JSON.parse(stored) as Record<string, unknown>;
        sourceProjectId = typeof activeProject.id === "string" ? activeProject.id : "";
        resolvedBrief = activeProjectBrief(activeProject, brief);
        const saved = await requestJson("/api/local-projects/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: activeProject, createRollingBackup: true }) });
        sourceFileName = typeof saved.fileName === "string" ? saved.fileName : "";
        if (!sourceFileName) throw new Error("The active Learn story could not be saved before the full build started.");
      }
      const response = await requestJson("/api/full-story-builder/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: { ...resolvedBrief, sourceFileName, sourceProjectId }, options: { visualMode, maximumVisuals: visualMode === "prompts-only" ? 0 : maximumVisuals, paidVisualConsent: visualMode === "paid-cloud" ? { acknowledged: true, maximumRequests: maximumVisuals, confirmedAt: new Date().toISOString(), statement: consentStatement } : null } }),
      });
      const next = response.job as PublicJob; setJob(next); window.localStorage.setItem(ACTIVE_JOB_KEY, next.id);
      setNotice(sourceFileName ? "Your active Learn story is saved in the Story Archive and queued for completion. Existing story material will be preserved while missing structure, screenplay and visuals are added." : "A new story is queued and will be saved into the Story Archive when complete.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The Full Story Builder job could not be started."); }
    finally { setWorking(false); }
  }

  async function openCompletedProject() {
    if (!job?.fileName || working) return;
    const confirmed = await requestPlotPickleConfirmation({ title: "Open the completed Full Story Builder project?", description: "This is the same Learn story, now completed and saved in your local Story Archive.", confirmLabel: "Open completed story", cancelLabel: "Keep current view" });
    if (!confirmed) return; setWorking(true); setNotice("");
    try {
      const result = await requestJson(`/api/local-projects/load?file=${encodeURIComponent(job.fileName)}`); if (!result.project) throw new Error("The completed project file could not be loaded.");
      window.localStorage.setItem(PROJECT_KEY, JSON.stringify(result.project)); window.localStorage.removeItem(ACTIVE_JOB_KEY); window.location.assign("/?workspace=dashboard");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The completed project could not be opened."); setWorking(false); }
  }

  return <section className={styles.panel} aria-label="Full Story Builder agent">
    <header><div><span>Learn Workspace · Independent local agent</span><h2>Full Story Builder</h2><p>Continue the story you are developing in Learn into a complete feature: preserve your premise, world and characters, then fill the 24 Blocks, 96 mini-blocks, screenplay, visual direction, production fields and persistent local archive.</p></div><div className={styles.agentState} data-ready={Boolean(status?.worker)}><i /><strong>{status?.worker ? "Agent ready" : "Agent starting"}</strong><small>Launched beside PlotPickle</small></div><button type="button" className={styles.expand} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Close setup" : "Complete this story"}</button></header>
    <div className={styles.promise}><span><b>Same story</b> retained from Learn</span><span><b>24 / 96</b> canonical structure</span><span><b>Story Archive</b> + rolling backup</span><span><b>No silent cost</b> or automatic publishing</span></div>
    {job ? <section className={styles.job} aria-live="polite"><div><span>{job.status === "completed" ? "Complete" : job.status === "failed" ? "Needs attention" : "Building locally"}</span><strong>{job.title}</strong><small>{job.stage}</small></div><div className={styles.progress}><i style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }} /></div><b>{job.progress}%</b>{job.status === "completed" ? <button type="button" onClick={() => void openCompletedProject()} disabled={working}>Open completed story</button> : null}{job.error ? <p className={styles.error}>{job.error}</p> : null}{job.result ? <p className={styles.result}>{job.result.estimatedPages || job.result.targetPages} pages · {job.result.blockCount} Blocks · {job.result.miniBlockCount} mini-blocks · {job.result.visualCount || 0} generated visual candidates{job.result.archived ? " · saved in Story Archive" : ""}</p> : null}{job.warnings?.length ? <details><summary>{job.warnings.length} build or visual note{job.warnings.length === 1 ? "" : "s"}</summary>{job.warnings.map((warning) => <p key={warning}>{warning}</p>)}</details> : null}</section> : null}
    {expanded ? <div className={styles.setup}>
      <div className={styles.explainer}><span>Continue your active story</span><h3>Your Learn work is the source of truth.</h3><p>PlotPickle first saves the active story into the local Story Archive. Existing story, character and world material is retained; these fields are used only to fill gaps and guide completion.</p></div>
      <div className={styles.fields}>
        <label>Working title<input value={brief.title} onChange={(event) => updateBrief("title", event.target.value)} placeholder="Uses the active story title when available" /></label><label>Genre<input value={brief.genre} onChange={(event) => updateBrief("genre", event.target.value)} /></label><label className={styles.wide}>Premise<textarea value={brief.premise} onChange={(event) => updateBrief("premise", event.target.value)} placeholder="Uses the active Learn premise when available" /></label><label>Protagonist<input value={brief.protagonist} onChange={(event) => updateBrief("protagonist", event.target.value)} placeholder="Uses the active story protagonist" /></label><label>Story world / setting<input value={brief.setting} onChange={(event) => updateBrief("setting", event.target.value)} placeholder="Uses the active story world" /></label><label className={styles.wide}>{"Protagonist's goal"}<textarea value={brief.protagonistGoal} onChange={(event) => updateBrief("protagonistGoal", event.target.value)} /></label><label className={styles.wide}>Opposition<textarea value={brief.opposition} onChange={(event) => updateBrief("opposition", event.target.value)} /></label><label className={styles.wide}>Theme / human question<textarea value={brief.theme} onChange={(event) => updateBrief("theme", event.target.value)} /></label><label>Tone<input value={brief.tone} onChange={(event) => updateBrief("tone", event.target.value)} /></label><label>Audience<input value={brief.audience} onChange={(event) => updateBrief("audience", event.target.value)} /></label><label className={styles.wide}>Visual language<textarea value={brief.visualLanguage} onChange={(event) => updateBrief("visualLanguage", event.target.value)} /></label><label>Content rating<input value={brief.contentRating} onChange={(event) => updateBrief("contentRating", event.target.value)} /></label><label>Project owner<input value={brief.projectOwner} onChange={(event) => updateBrief("projectOwner", event.target.value)} placeholder="For rights metadata" /></label>
      </div>
      <section className={styles.visualChoice}><div><span>Visual route</span><h3>Choose the cost boundary before the job begins.</h3><p>All choices create detailed visual prompts. Generated images remain unapproved candidates attached to this same story.</p></div><label>Visual handling<select value={visualMode} onChange={(event) => { setVisualMode(event.target.value as VisualMode); setPaidConsent(false); }}><option value="local-if-available">Use local ComfyUI if it is ready; otherwise keep prompts</option><option value="prompts-only">Prompts only — manual or later generation</option><option value="paid-cloud">Use the configured paid cloud image route with exact consent</option></select></label>{visualMode !== "prompts-only" ? <label>Maximum generated images<select value={maximumVisuals} onChange={(event) => { setMaximumVisuals(Number(event.target.value)); setPaidConsent(false); }}>{[1, 2, 3, 4].map((count) => <option value={count} key={count}>{count}</option>)}</select></label> : null}{visualMode === "paid-cloud" ? <label className={styles.consent}><input type="checkbox" checked={paidConsent} onChange={(event) => setPaidConsent(event.target.checked)} /><span><strong>Paid-provider confirmation</strong>{consentStatement} Charges, if any, go directly to the provider account configured in Settings.</span></label> : <p className={styles.localNote}>Cloud text is never used by this agent. Local/manual story creation remains available even when no AI provider is connected.</p>}</section>
      <footer><p>The active Learn story is saved first, then the same project is completed and saved back into the Story Archive with a rolling backup. PlotPickle does not publish, send mail or approve generated material.</p><button type="button" disabled={working || active || (visualMode === "paid-cloud" && !paidConsent)} onClick={() => void startJob()}>{active ? "Story is building" : working ? "Saving and queuing…" : "Complete and archive this story"}</button></footer>
    </div> : null}
    {notice ? <p className={styles.notice}>{notice}</p> : null}
  </section>;
}
