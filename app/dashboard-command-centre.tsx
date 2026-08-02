"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlotPickleSettings } from "@/lib/ai/settings";
import { AFTERGLOW_PROJECT_ID } from "@/lib/afterglow-persistence";
import type { ConnectionStatusSnapshot } from "@/lib/connection-status";
import { createDashboardCommandCentreModel, type DashboardTarget, type DashboardTone } from "@/lib/dashboard-command-centre";
import type { PlotPickleProject } from "@/lib/project";
import type { ProductNavigationId } from "@/lib/product-direction";
import RefreshAction from "./refresh-action";
import SetupConnectionsDashboard from "./setup-connections-dashboard";
import styles from "./dashboard-command-centre.module.css";
import sourceStyles from "./dashboard-afterglow.module.css";

const SETTINGS_SECTION_KEY = "plotpickle.settings.section";

const toneMeta: Record<DashboardTone, { icon: string; label: string }> = {
  green: { icon: "✓", label: "Ready or healthy" },
  yellow: { icon: "!", label: "Needs attention or review" },
  red: { icon: "×", label: "Missing, blocked or critical" },
};

type Props = {
  project: PlotPickleProject;
  saveState: string;
  settings: PlotPickleSettings;
  connectionStatus: ConnectionStatusSnapshot;
  afterglowCopyWorking: boolean;
  onNavigate: (workspace: ProductNavigationId, section?: string) => void;
  onOpenBlock: (blockNumber: number) => void;
  onLoadAfterglow: () => void;
  onMakeAfterglowCopy: () => void;
  onResetAfterglow: () => void;
  onOpenAfterglowGraphicNovel: () => void;
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

function currentProjectSource(
  project: PlotPickleProject,
  saveState: string,
  connectionStatus: ConnectionStatusSnapshot,
) {
  const isBundledExample = project.id === AFTERGLOW_PROJECT_ID;
  const collaboration = project.collaboration;
  const repositoryConnected = collaboration.provider === "github" && Boolean(collaboration.owner && collaboration.repo);
  const repository = repositoryConnected ? `${collaboration.owner}/${collaboration.repo}` : "No repository connected";
  const branch = collaboration.branch || "main";
  const localHealthy = connectionStatus.items.storage.state === "connected";
  const repositoryHealthy = connectionStatus.items.github.state === "connected";
  const approvedCommit = collaboration.lastPulledCommit;
  const proposedCommit = collaboration.lastPushedCommit;

  if (isBundledExample) {
    return {
      isBundledExample,
      tone: "green" as const,
      label: "Afterglow — PlotPickle Example Story",
      detail: "This bundled project is read-only. Explore how its blocks, screenplay, characters and visuals connect, then choose Make My Own Copy before editing.",
      repository: "Example source only — never a user destination",
      branch: "",
      local: "Read-only bundled example",
      approved: "Bundled canonical example",
      changes: "No edits, autosaves, pulls or publishes are allowed",
    };
  }

  if (repositoryConnected && approvedCommit) {
    return {
      isBundledExample,
      tone: repositoryHealthy && localHealthy ? "green" as const : "red" as const,
      label: "GitHub repository working copy",
      detail: repositoryHealthy && localHealthy
        ? `The current project is the local working copy linked to ${repository} on ${branch}.`
        : "This project expects a GitHub-backed working copy, but the repository or local project service is unavailable.",
      repository,
      branch,
      local: saveState,
      approved: `Approved commit ${approvedCommit.slice(0, 10)}`,
      changes: proposedCommit && proposedCommit !== approvedCommit ? "Local changes have a recorded proposal state" : "Local approved state matches the recorded commit",
    };
  }

  if (repositoryConnected) {
    return {
      isBundledExample,
      tone: localHealthy ? "yellow" as const : "red" as const,
      label: "Repository configured; local project still loaded",
      detail: localHealthy
        ? `GitHub is connected to ${repository}, but the current story remains the local project until an approved story is explicitly refreshed or pulled.`
        : "A repository is configured, but the local project service is unavailable.",
      repository,
      branch,
      local: saveState,
      approved: "Approved story refresh required",
      changes: "Local edits have not been replaced by GitHub content",
    };
  }

  return {
    isBundledExample,
    tone: localHealthy ? "green" as const : "red" as const,
    label: localHealthy ? "Local project on this device" : "Local project disconnected",
    detail: localHealthy
      ? "The displayed story is the current local project. No GitHub story has replaced it."
      : "The active story cannot confirm its local project storage. Repair local storage before continuing.",
    repository,
    branch,
    local: saveState,
    approved: "No GitHub approved story selected",
    changes: "Current edits remain local",
  };
}

export default function DashboardCommandCentre({
  project,
  saveState,
  settings,
  connectionStatus,
  afterglowCopyWorking,
  onNavigate,
  onOpenBlock,
  onLoadAfterglow,
  onMakeAfterglowCopy,
  onResetAfterglow,
  onOpenAfterglowGraphicNovel,
}: Props) {
  const [learningCompleted, setLearningCompleted] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
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

  const model = useMemo(() => createDashboardCommandCentreModel(project, {
    saveState,
    learningCompleted,
    settings,
    connectionStatus,
  }), [project, saveState, learningCompleted, settings, connectionStatus]);
  const source = useMemo(
    () => currentProjectSource(project, saveState, connectionStatus),
    [project, saveState, connectionStatus],
  );
  const afterglowMessage = source.isBundledExample
    ? "The original Afterglow project ID, bundled assets and source repository remain protected. Your copy receives a new ID and starts with no GitHub destination."
    : "";

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
        <a href="#dashboard-project-source">Project source</a>
        <a href="#dashboard-setup">Setup &amp; connections</a>
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

        <section id="dashboard-project-source" className={styles.section} aria-labelledby="project-source-title">
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>Current project source</p>
              <h2 id="project-source-title">Know exactly which story is loaded</h2>
              <p>Local storage, repository configuration and the loaded story are separate states. A GitHub connection never replaces the current project without an explicit load or refresh.</p>
            </div>
          </div>
          <article className={`${sourceStyles.card} ${styles[`tone-${source.tone}`]}`}>
            <div className={sourceStyles.status} role="status" aria-live="polite">
              <i aria-hidden="true">{toneMeta[source.tone].icon}</i>
              <div>
                <span>Loaded story</span>
                <strong>{source.label}</strong>
                <p>{source.detail}</p>
              </div>
            </div>
            <dl className={styles.projectDetails}>
              <div><dt>Project</dt><dd>{project.metadata.title || "Untitled project"}</dd></div>
              <div><dt>Local storage</dt><dd>{source.local}</dd></div>
              <div><dt>GitHub repository</dt><dd>{source.repository}{source.branch ? ` · ${source.branch}` : ""}</dd></div>
              <div><dt>Approved story</dt><dd>{source.approved}</dd></div>
              <div><dt>Working changes</dt><dd>{source.changes}</dd></div>
            </dl>
            {source.isBundledExample ? (
              <div className={sourceStyles.actions}>
                <button type="button" onClick={onMakeAfterglowCopy} disabled={afterglowCopyWorking}>
                  {afterglowCopyWorking ? "Creating local copy…" : "Make My Own Copy"}
                </button>
                <button type="button" onClick={onOpenAfterglowGraphicNovel}>Open Sample Graphic Novel</button>
                <button type="button" onClick={onResetAfterglow}>Reset Example</button>
                <RefreshAction label="Reload bundled example" working={afterglowCopyWorking} onClick={onLoadAfterglow} />
              </div>
            ) : null}
            {source.isBundledExample && afterglowMessage ? <p className={sourceStyles.notice}>{afterglowMessage}</p> : null}
          </article>
        </section>

        <SetupConnectionsDashboard
          connectionStatus={connectionStatus}
          onOpenSettings={(section) => openTarget({ workspace: "settings", section })}
        />

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
