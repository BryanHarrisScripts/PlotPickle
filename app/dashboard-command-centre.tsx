"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultPlotPickleSettings, normalizePlotPickleSettings, type PlotPickleSettings } from "@/lib/ai/settings";
import { createDashboardCommandCentreModel, type DashboardTarget, type DashboardTone } from "@/lib/dashboard-command-centre";
import type { PlotPickleProject } from "@/lib/project";
import type { ProductNavigationId } from "@/lib/product-direction";
import styles from "./dashboard-command-centre.module.css";

const SETTINGS_STORAGE_KEY = "plotpickle.settings.v1";
const SETTINGS_SECTION_KEY = "plotpickle.settings.section";
const CONNECTION_API = "/api/local-ai/connection";

const toneMeta: Record<DashboardTone, { icon: string; label: string }> = {
  green: { icon: "✓", label: "Ready or healthy" },
  yellow: { icon: "!", label: "Needs attention or review" },
  red: { icon: "×", label: "Missing, blocked or critical" },
};

type AiConnection = "disabled" | "configured" | "connected" | "error" | "unavailable";

type Props = {
  project: PlotPickleProject;
  saveState: string;
  onNavigate: (workspace: ProductNavigationId, section?: string) => void;
  onOpenBlock: (blockNumber: number) => void;
};

function formatDate(value: string) {
  if (!value) return "Not recorded";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function progressTone(completion: number): DashboardTone {
  if (completion >= 70) return "green";
  if (completion > 0) return "yellow";
  return "red";
}

export default function DashboardCommandCentre({ project, saveState, onNavigate, onOpenBlock }: Props) {
  const [settings, setSettings] = useState<PlotPickleSettings>(() => structuredClone(defaultPlotPickleSettings));
  const [learningCompleted, setLearningCompleted] = useState(0);
  const [aiConnection, setAiConnection] = useState<AiConnection>("disabled");
  const [aiMessage, setAiMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        const nextSettings = storedSettings ? normalizePlotPickleSettings(JSON.parse(storedSettings)) : structuredClone(defaultPlotPickleSettings);
        setSettings(nextSettings);
        setAiConnection(nextSettings.ai.provider === "disabled" ? "disabled" : "configured");
      } catch {
        setSettings(structuredClone(defaultPlotPickleSettings));
        setAiConnection("disabled");
      }

      try {
        const savedLearning = window.localStorage.getItem(`plotpickle-learning-progress:${project.id}`);
        const completed = savedLearning ? JSON.parse(savedLearning) as unknown : [];
        setLearningCompleted(Array.isArray(completed) ? completed.filter((item) => typeof item === "string").length : 0);
      } catch {
        setLearningCompleted(0);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [project.id]);

  useEffect(() => {
    if (settings.ai.provider === "disabled") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(CONNECTION_API, { signal: controller.signal });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) throw new Error("local-gateway-unavailable");
        const payload = await response.json() as { saved?: boolean; checkedAt?: string; message?: string };
        if (!response.ok) throw new Error(payload.message || "The saved AI provider could not be read.");
        if (!payload.saved) {
          setAiConnection("configured");
          setAiMessage("A provider is selected, but no private local credential has been saved.");
        } else if (payload.checkedAt) {
          setAiConnection("connected");
          setAiMessage(`Last verified ${formatDate(payload.checkedAt)}.`);
        } else {
          setAiConnection("configured");
          setAiMessage("Private credentials are saved; verify the provider in Settings.");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "The AI connection could not be checked.";
        if (message === "local-gateway-unavailable") {
          setAiConnection("unavailable");
          setAiMessage("Connection status is available in the downloaded local PlotPickle app.");
        } else {
          setAiConnection("error");
          setAiMessage(message);
        }
      }
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [settings.ai.provider]);

  const resolvedAiConnection: AiConnection = settings.ai.provider === "disabled" ? "disabled" : aiConnection;
  const resolvedAiMessage = settings.ai.provider === "disabled" ? "PlotPickle remains fully usable without AI." : aiMessage;
  const model = useMemo(() => createDashboardCommandCentreModel(project, {
    saveState,
    learningCompleted,
    settings,
    aiConnection: resolvedAiConnection,
    aiMessage: resolvedAiMessage,
  }), [project, saveState, learningCompleted, settings, resolvedAiConnection, resolvedAiMessage]);

  function openTarget(target: DashboardTarget) {
    if (target.blockNumber) {
      onOpenBlock(target.blockNumber);
      return;
    }
    if (target.workspace === "settings" && target.section) {
      window.sessionStorage.setItem(SETTINGS_SECTION_KEY, target.section);
      window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: target.section }));
    }
    onNavigate(target.workspace, target.section);
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.subnav} aria-label="Dashboard sections">
        <p className={styles.eyebrow}>Dashboard</p>
        <strong>Command centre</strong>
        <a href="#dashboard-readiness">Readiness</a>
        <a href="#dashboard-connections">Connections</a>
        <a href="#dashboard-workflow">Workflow progress</a>
        <a href="#dashboard-attention">Attention required <span>{model.attention.length}</span></a>
        <a href="#dashboard-snapshot">Project snapshot</a>
        <div className={styles.legend} aria-label="Dashboard status meaning">
          {(Object.keys(toneMeta) as DashboardTone[]).map((tone) => (
            <span key={tone} className={styles[`tone-${tone}`]}><i aria-hidden="true">{toneMeta[tone].icon}</i>{toneMeta[tone].label}</span>
          ))}
        </div>
      </aside>

      <div className={styles.main}>
        <section id="dashboard-readiness" className={`${styles.readiness} ${styles[`tone-${model.readiness}`]}`}>
          <div className={styles.readinessIcon} aria-hidden="true">{toneMeta[model.readiness].icon}</div>
          <div>
            <p className={styles.eyebrow}>Five-second readiness check</p>
            <h1>{model.readinessLabel}</h1>
            <p>{model.recommendedAction ? model.recommendedAction.detail : "No tracked blocker or review item currently needs attention."}</p>
          </div>
          {model.recommendedAction ? <button type="button" onClick={() => openTarget(model.recommendedAction!.target)}>Recommended: {model.recommendedAction.title}</button> : <button type="button" onClick={() => onNavigate("planner", "overview")}>Continue project</button>}
        </section>

        <section id="dashboard-connections" className={styles.section} aria-labelledby="connections-title">
          <div className={styles.heading}>
            <div><p className={styles.eyebrow}>Connections</p><h2 id="connections-title">Installation, project and collaboration status</h2><p>These cards reuse the same local settings, project collaboration metadata and storage rules used elsewhere.</p></div>
          </div>
          <div className={styles.connectionGrid}>
            {model.connections.map((connection) => (
              <button type="button" className={`${styles.connectionCard} ${styles[`tone-${connection.tone}`]}`} key={connection.id} onClick={() => openTarget(connection.target)}>
                <span>{connection.label}</span>
                <strong><i aria-hidden="true">{toneMeta[connection.tone].icon}</i>{connection.status}</strong>
                <p>{connection.detail}</p>
                <small>Open details →</small>
              </button>
            ))}
          </div>
        </section>

        <section id="dashboard-workflow" className={styles.section} aria-labelledby="workflow-title">
          <div className={styles.heading}>
            <div><p className={styles.eyebrow}>Workflow progress</p><h2 id="workflow-title">Continue the film without hunting for the next screen</h2><p>Completion and unresolved work are calculated from the active canonical project.</p></div>
          </div>
          <div className={styles.workflowGrid}>
            {model.workflow.map((workflow) => {
              const tone = progressTone(workflow.completion);
              return (
                <article className={styles.workflowCard} key={workflow.id}>
                  <header><span>{workflow.label}</span><strong className={styles[`tone-${tone}`]}>{workflow.completion}%</strong></header>
                  <div className={styles.progressTrack} aria-label={`${workflow.label}: ${workflow.completion}% complete`}><i style={{ width: `${workflow.completion}%` }} /></div>
                  <dl><div><dt>Unresolved</dt><dd>{workflow.unresolved}</dd></div><div><dt>Last activity</dt><dd>{formatDate(workflow.lastActivity)}</dd></div></dl>
                  <p>{workflow.nextStep}</p>
                  <button type="button" onClick={() => openTarget(workflow.target)}>Continue {workflow.label}</button>
                </article>
              );
            })}
          </div>
        </section>

        <section id="dashboard-attention" className={styles.section} aria-labelledby="attention-title">
          <div className={styles.heading}>
            <div><p className={styles.eyebrow}>Attention required</p><h2 id="attention-title">Warnings point to the exact place that can resolve them</h2><p>Colour is always paired with an icon, status text and a direct action.</p></div>
          </div>
          {model.attention.length ? (
            <div className={styles.attentionList}>
              {model.attention.map((item) => (
                <button type="button" className={`${styles.attentionItem} ${styles[`tone-${item.tone}`]}`} key={item.id} onClick={() => openTarget(item.target)}>
                  <i aria-hidden="true">{toneMeta[item.tone].icon}</i>
                  <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                  {typeof item.count === "number" ? <b>{item.count}</b> : null}
                  <em>Resolve →</em>
                </button>
              ))}
            </div>
          ) : <div className={styles.emptyState}><strong>✓ No tracked warning requires action.</strong><p>Continue the current workflow or review the project snapshot below.</p></div>}
        </section>

        <section id="dashboard-snapshot" className={styles.section} aria-labelledby="snapshot-title">
          <div className={styles.heading}>
            <div><p className={styles.eyebrow}>Project snapshot</p><h2 id="snapshot-title">{model.snapshot.title}</h2><p>{model.snapshot.draft} · {model.snapshot.format} · approximately {model.snapshot.runtimeMinutes} minutes</p></div>
            <button type="button" onClick={() => onNavigate("planner", "overview")}>Open Project Overview</button>
          </div>
          <div className={styles.snapshotGrid}>
            <article><strong>{model.snapshot.pageEstimate}</strong><span>Estimated pages</span></article>
            <article><strong>{model.snapshot.scenes}</strong><span>Scenes</span></article>
            <article><strong>{model.snapshot.characters}</strong><span>Characters</span></article>
            <article><strong>{model.snapshot.locations}</strong><span>Locations</span></article>
          </div>
          <dl className={styles.projectDetails}>
            <div><dt>Project path</dt><dd>{model.snapshot.projectPath}</dd></div>
            <div><dt>Last saved</dt><dd>{formatDate(model.snapshot.lastSaved)}</dd></div>
            <div><dt>Canonical / branch state</dt><dd>{model.snapshot.canonicalState}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
