"use client";

import { useEffect, useMemo, useState } from "react";
import { requestPlotPickleConfirmation } from "./common-overlay-layer";
import styles from "./full-story-builder-panel.module.css";

const ACTIVE_JOB_KEY = "plotpickle.full-story-builder.job.v1";
const PROJECT_KEY = "plotpickle.project.v1";

type VisualMode = "prompts-only" | "local-if-available" | "paid-cloud";

type PublicJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  title: string;
  stage: string;
  progress: number;
  warnings: string[];
  error: string;
  fileName: string;
  result: null | { targetPages?: number; estimatedPages?: number; blockCount?: number; miniBlockCount?: number; screenplayWordCount?: number; visualCount?: number };
};

type BuilderStatus = {
  available: boolean;
  worker: null | { id: string; lastSeenAt: string };
  jobs: PublicJob[];
};

const initialBrief = {
  title: "",
  premise: "",
  genre: "Character-driven speculative mystery",
  tone: "Tense, intimate and visually tactile, with earned warmth",
  protagonist: "",
  protagonistGoal: "",
  opposition: "",
  theme: "",
  setting: "",
  visualLanguage: "Matte charcoal interiors, weathered brass, hard window light, handmade maps and restrained amber accents",
  audience: "Adult and crossover audiences",
  contentRating: "PG-13",
  language: "English",
  projectOwner: "",
};

async function requestJson(pathname: string, init?: RequestInit) {
  const response = await fetch(pathname, init);
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message || "The Full Story Builder request could not be completed.");
  return body as Record<string, unknown>;
}

export default function FullStoryBuilderPanel() {
  const [expanded, setExpanded] = useState(false);
  const [brief, setBrief] = useState(initialBrief);
  const [visualMode, setVisualMode] = useState<VisualMode>("local-if-available");
  const [maximumVisuals, setMaximumVisuals] = useState(4);
  const [paidConsent, setPaidConsent] = useState(false);
  const [status, setStatus] = useState<BuilderStatus | null>(null);
  const [job, setJob] = useState<PublicJob | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    const savedJobId = window.localStorage.getItem(ACTIVE_JOB_KEY) || "";
    const refresh = async () => {
      try {
        const result = await requestJson("/api/full-story-builder/status") as unknown as BuilderStatus & { ok?: boolean };
        if (cancelled) return;
        setStatus(result);
        const relevant = result.jobs.find((item) => item.id === (job?.id || savedJobId)) || result.jobs.find((item) => item.status === "queued" || item.status === "running") || null;
        if (relevant) {
          setJob(relevant);
          window.localStorage.setItem(ACTIVE_JOB_KEY, relevant.id);
        }
      } catch {
        if (!cancelled) setStatus(null);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, job?.status === "queued" || job?.status === "running" ? 2_500 : 10_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [job?.id, job?.status]);

  const consentStatement = useMemo(() => `I authorize up to ${maximumVisuals} paid image requests for this Full Story Builder job.`, [maximumVisuals]);
  const active = job?.status === "queued" || job?.status === "running";

  function updateBrief(field: keyof typeof initialBrief, value: string) {
    setBrief((current) => ({ ...current, [field]: value }));
  }

  async function startJob() {
    if (active || working) return;
    if (visualMode === "paid-cloud" && !paidConsent) {
      setNotice("Confirm the exact paid-image limit before starting this cloud visual option.");
      return;
    }
    setWorking(true);
    setNotice("");
    try {
      const response = await requestJson("/api/full-story-builder/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          options: {
            visualMode,
            maximumVisuals: visualMode === "prompts-only" ? 0 : maximumVisuals,
            paidVisualConsent: visualMode === "paid-cloud" ? {
              acknowledged: true,
              maximumRequests: maximumVisuals,
              confirmedAt: new Date().toISOString(),
              statement: consentStatement,
            } : null,
          },
        }),
      });
      const next = response.job as PublicJob;
      setJob(next);
      window.localStorage.setItem(ACTIVE_JOB_KEY, next.id);
      setNotice("The story brief is queued. The independent local agent will save the finished PPF without replacing your active project.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Full Story Builder job could not be started.");
    } finally {
      setWorking(false);
    }
  }

  async function openCompletedProject() {
    if (!job?.fileName || working) return;
    const confirmed = await requestPlotPickleConfirmation({
      title: "Open the completed Full Story Builder project?",
      description: "Your current project remains saved separately in the local library.",
      confirmLabel: "Open completed story",
      cancelLabel: "Keep current story open",
    });
    if (!confirmed) return;
    setWorking(true);
    setNotice("");
    try {
      const result = await requestJson(`/api/local-projects/load?file=${encodeURIComponent(job.fileName)}`);
      if (!result.project) throw new Error("The completed project file could not be loaded.");
      window.localStorage.setItem(PROJECT_KEY, JSON.stringify(result.project));
      window.localStorage.removeItem(ACTIVE_JOB_KEY);
      window.location.assign("/?workspace=dashboard");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The completed project could not be opened.");
      setWorking(false);
    }
  }

  return <section className={styles.panel} aria-label="Full Story Builder agent">
    <header>
      <div><span>Learn Workspace · Independent local agent</span><h2>Full Story Builder</h2><p>Build a new original feature through the same human story path: premise, world, characters, 24 Blocks, 96 mini-blocks, screenplay, visual direction, production fields and local save.</p></div>
      <div className={styles.agentState} data-ready={Boolean(status?.worker)}><i /><strong>{status?.worker ? "Agent ready" : "Agent starting"}</strong><small>Launched beside PlotPickle</small></div>
      <button type="button" className={styles.expand} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Close setup" : "Set up a story"}</button>
    </header>

    <div className={styles.promise}>
      <span><b>120</b> screenplay-page target</span>
      <span><b>24 / 96</b> canonical structure</span>
      <span><b>Local project</b> with rolling backup</span>
      <span><b>No silent cost</b> or automatic publishing</span>
    </div>

    {job ? <section className={styles.job} aria-live="polite">
      <div><span>{job.status === "completed" ? "Complete" : job.status === "failed" ? "Needs attention" : "Building locally"}</span><strong>{job.title}</strong><small>{job.stage}</small></div>
      <div className={styles.progress}><i style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }} /></div>
      <b>{job.progress}%</b>
      {job.status === "completed" ? <button type="button" onClick={() => void openCompletedProject()} disabled={working}>Open completed story</button> : null}
      {job.error ? <p className={styles.error}>{job.error}</p> : null}
      {job.result ? <p className={styles.result}>{job.result.estimatedPages || job.result.targetPages} pages · {job.result.blockCount} Blocks · {job.result.miniBlockCount} mini-blocks · {job.result.visualCount || 0} generated visual candidates</p> : null}
      {job.warnings?.length ? <details><summary>{job.warnings.length} visual or fallback note{job.warnings.length === 1 ? "" : "s"}</summary>{job.warnings.map((warning) => <p key={warning}>{warning}</p>)}</details> : null}
    </section> : null}

    {expanded ? <div className={styles.setup}>
      <div className={styles.explainer}><span>Human-style brief</span><h3>Give the agent your intention, not technical provider settings.</h3><p>Every field is optional. Empty fields receive an original local starting point and remain editable. The result is a substantial first draft, never final canon.</p></div>
      <div className={styles.fields}>
        <label>Working title<input value={brief.title} onChange={(event) => updateBrief("title", event.target.value)} placeholder="Leave blank for an original title" /></label>
        <label>Genre<input value={brief.genre} onChange={(event) => updateBrief("genre", event.target.value)} /></label>
        <label className={styles.wide}>Premise<textarea value={brief.premise} onChange={(event) => updateBrief("premise", event.target.value)} placeholder="What is the story about? Leave blank for an original premise." /></label>
        <label>Protagonist<input value={brief.protagonist} onChange={(event) => updateBrief("protagonist", event.target.value)} placeholder="Name or short description" /></label>
        <label>Story world / setting<input value={brief.setting} onChange={(event) => updateBrief("setting", event.target.value)} placeholder="Place, period and defining condition" /></label>
        <label className={styles.wide}>{"Protagonist's goal"}<textarea value={brief.protagonistGoal} onChange={(event) => updateBrief("protagonistGoal", event.target.value)} /></label>
        <label className={styles.wide}>Opposition<textarea value={brief.opposition} onChange={(event) => updateBrief("opposition", event.target.value)} /></label>
        <label className={styles.wide}>Theme / human question<textarea value={brief.theme} onChange={(event) => updateBrief("theme", event.target.value)} /></label>
        <label>Tone<input value={brief.tone} onChange={(event) => updateBrief("tone", event.target.value)} /></label>
        <label>Audience<input value={brief.audience} onChange={(event) => updateBrief("audience", event.target.value)} /></label>
        <label className={styles.wide}>Visual language<textarea value={brief.visualLanguage} onChange={(event) => updateBrief("visualLanguage", event.target.value)} /></label>
        <label>Content rating<input value={brief.contentRating} onChange={(event) => updateBrief("contentRating", event.target.value)} /></label>
        <label>Project owner<input value={brief.projectOwner} onChange={(event) => updateBrief("projectOwner", event.target.value)} placeholder="For rights metadata" /></label>
      </div>

      <section className={styles.visualChoice}>
        <div><span>Visual route</span><h3>Choose the cost boundary before the job begins.</h3><p>All choices create 96 detailed visual prompts. Generated images are limited to four story anchors and remain unapproved candidates.</p></div>
        <label>Visual handling<select value={visualMode} onChange={(event) => { setVisualMode(event.target.value as VisualMode); setPaidConsent(false); }}>
          <option value="local-if-available">Use local ComfyUI if it is ready; otherwise keep prompts</option>
          <option value="prompts-only">Prompts only — manual or later generation</option>
          <option value="paid-cloud">Use the configured paid cloud image route with exact consent</option>
        </select></label>
        {visualMode !== "prompts-only" ? <label>Maximum generated images<select value={maximumVisuals} onChange={(event) => { setMaximumVisuals(Number(event.target.value)); setPaidConsent(false); }}>{[1, 2, 3, 4].map((count) => <option value={count} key={count}>{count}</option>)}</select></label> : null}
        {visualMode === "paid-cloud" ? <label className={styles.consent}><input type="checkbox" checked={paidConsent} onChange={(event) => setPaidConsent(event.target.checked)} /><span><strong>Paid-provider confirmation</strong>{consentStatement} Charges, if any, go directly to the provider account configured in Settings.</span></label> : <p className={styles.localNote}>Cloud text is never used by this agent. Local/manual story creation remains available even when no AI provider is connected.</p>}
      </section>

      <footer><p>The agent saves a separate canonical local project and rolling backup. It does not replace the active story, connect GitHub, publish, send mail or approve generated material.</p><button type="button" disabled={working || active || (visualMode === "paid-cloud" && !paidConsent)} onClick={() => void startJob()}>{active ? "Story is building" : working ? "Queuing…" : "Build the complete story"}</button></footer>
    </div> : null}
    {notice ? <p className={styles.notice}>{notice}</p> : null}
  </section>;
}
