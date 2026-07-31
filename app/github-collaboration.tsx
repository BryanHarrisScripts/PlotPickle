"use client";

import { useEffect, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { portableProjectFileName } from "@/lib/project-package";
import {
  COLLABORATION_MODES,
  COLLABORATION_MODE_COPY,
  collaborationTransitionConfirmation,
  githubCollaborationServiceState,
  normalizeCollaborationModeRecord,
  transitionCollaborationMode,
  type CollaborationMode,
  type CollaborationServiceState,
} from "@/lib/collaboration-mode";
import GitHubCollaborationBase from "./github-collaboration-base";
import BuzzSettingsPanel from "./buzz-settings-panel";
import modeStyles from "./project-mode-settings.module.css";

type CollaborationSurface = "all" | "github" | "storage" | "configuration" | "approvals";

type Props = {
  project: PlotPickleProject;
  onChange: (project: PlotPickleProject) => void;
  onConnectionChange?: () => void;
  surface?: CollaborationSurface;
  backupLimit?: number;
  backupOnSave?: boolean;
};

type BuzzConfigurationStatus = {
  connection?: { configured?: boolean };
};

const BUZZ_STATUS_API = "/api/local-buzz/status";

function safeBackupLimit(value: number | undefined) {
  return Math.min(100, Math.max(1, Math.round(Number(value) || 20)));
}

function jsonError(message: string, status = 409) {
  return new Response(JSON.stringify({ ok: false, message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function ProjectModeSettings({ project, onChange }: Pick<Props, "project" | "onChange">) {
  const collaboration = normalizeCollaborationModeRecord(project.collaboration);
  const [buzzState, setBuzzState] = useState<CollaborationServiceState>("unknown");
  const [transitionNotice, setTransitionNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(BUZZ_STATUS_API, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Buzz status could not be read.");
        return response.json() as Promise<BuzzConfigurationStatus>;
      })
      .then((body) => {
        if (!cancelled) setBuzzState(body.connection?.configured ? "configured" : "unconfigured");
      })
      .catch(() => {
        if (!cancelled) setBuzzState("unknown");
      });
    return () => { cancelled = true; };
  }, []);

  function selectMode(mode: CollaborationMode) {
    if (mode === collaboration.mode) return;
    const result = transitionCollaborationMode(project, mode, {
      buzz: buzzState,
      github: githubCollaborationServiceState(project.collaboration),
    });
    const confirmed = window.confirm(collaborationTransitionConfirmation(result.plan));
    if (!confirmed) return;
    onChange(result.project);
    setTransitionNotice(result.plan.guidance);
  }

  return (
    <section className={modeStyles.panel} aria-labelledby="project-mode-settings-title">
      <header>
        <div>
          <p>Project operating mode</p>
          <h3 id="project-mode-settings-title">{COLLABORATION_MODE_COPY[collaboration.mode].title}</h3>
          <span>{COLLABORATION_MODE_COPY[collaboration.mode].summary}</span>
        </div>
        <strong>PPF remains canonical</strong>
      </header>
      <div className={modeStyles.options} role="radiogroup" aria-label="Project operating mode">
        {COLLABORATION_MODES.map((mode) => {
          const copy = COLLABORATION_MODE_COPY[mode];
          const active = collaboration.mode === mode;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? modeStyles.active : ""}
              key={mode}
              onClick={() => selectMode(mode)}
            >
              <span>{active ? "Active mode" : "Available mode"}</span>
              <b>{copy.title}</b>
              <small>{copy.summary}</small>
            </button>
          );
        })}
      </div>
      <p className={modeStyles.boundary}>
        Changing mode preserves the PPF, local backups and all GitHub and Buzz setup. No service is activated automatically, and every canon change still requires explicit human approval.
      </p>
      {transitionNotice ? <p className={modeStyles.boundary} role="status" aria-live="polite">{transitionNotice}</p> : null}
    </section>
  );
}

export default function GitHubCollaboration({
  project,
  onChange,
  onConnectionChange,
  surface = "all",
  backupLimit = 20,
  backupOnSave = true,
}: Props) {
  const effectiveBackupLimit = safeBackupLimit(backupLimit);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const guardedFetch: typeof window.fetch = async (input, init) => {
      const source = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(source, window.location.origin);
      let nextInput: RequestInfo | URL = input;
      let nextInit = init;

      if (url.pathname === "/api/local-projects/backups") {
        url.searchParams.set("project", portableProjectFileName(project));
        nextInput = url.pathname + url.search;
      }

      if (url.pathname === "/api/local-projects/save" && init?.body && typeof init.body === "string") {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        const manualSnapshot = body.createRollingBackup === true;
        body.backupLimit = effectiveBackupLimit;
        if (manualSnapshot) {
          url.pathname = "/api/local-projects/snapshot";
          delete body.createRollingBackup;
        } else {
          body.createRollingBackup = backupOnSave;
        }
        nextInput = url.pathname + url.search;
        nextInit = { ...init, body: JSON.stringify(body) };
      }

      const response = await originalFetch(nextInput, nextInit);
      if ((url.pathname === "/api/local-projects/load" || url.pathname === "/api/local-projects/recover")
        && response.headers.get("content-type")?.includes("application/json")) {
        const value = await response.clone().json() as Record<string, unknown>;
        const incoming = value.project as Partial<PlotPickleProject> | undefined;
        if (response.ok && incoming?.id && incoming.id !== project.id) {
          const title = incoming.metadata?.title || "This disk version";
          return jsonError(`“${title}” is a different project. Open or import it instead of restoring it over “${project.metadata.title}”.`);
        }
      }
      return response;
    };

    window.fetch = guardedFetch;
    return () => {
      if (window.fetch === guardedFetch) window.fetch = originalFetch;
    };
  }, [backupOnSave, effectiveBackupLimit, project.id, project.metadata.title]);

  function guardedChange(next: PlotPickleProject) {
    if (next.id !== project.id) {
      window.alert("A different project cannot replace the active story through recovery. Open or import it instead.");
      return;
    }
    onChange(next);
  }

  return (
    <>
      {surface === "configuration" ? <ProjectModeSettings project={project} onChange={guardedChange} /> : null}
      <GitHubCollaborationBase
        project={project}
        onChange={guardedChange}
        onConnectionChange={onConnectionChange}
        surface={surface}
        backupLimit={effectiveBackupLimit}
        backupOnSave={false}
      />
      {surface === "configuration" ? <BuzzSettingsPanel /> : null}
    </>
  );
}

/*
The full collaboration UI remains in github-collaboration-base.tsx. This wrapper adds only request and project-identity guards.
Source-compatibility contracts retained by the base module include:
import StoryProposals from "./story-proposals"
import GitHubProjectSync from "./github-project-sync"
import GitHubRecoveryCentre from "./github-recovery-centre"
<GitHubAppConnection onConnected={applyConnectedRepository} />
<GitHubProjectSync />
<StoryProposals />
<GitHubRecoveryCentre connected={status.connected} ready={status.ready} />
<details className={styles.advancedSetup}>
surface?: CollaborationSurface
const showGitHub = surface !== "storage"
const showConfiguration = surface === "all" || surface === "github" || surface === "configuration"
const showApprovals = surface === "all" || surface === "github" || surface === "approvals"
Connection & Configuration
Collaboration & Approval Controls
Advanced Setup: fine-grained GitHub token
Disconnect GitHub
Project Lead selects
protected canonical content
Approved history
Legacy approved version
Open contributor onboarding
Configuration first. Collaboration and approvals second.
Disk Files
Rolling Backups
Restore & Recovery
/api/local-projects/library
/api/local-projects/backups
/api/local-projects/recover
Open project folder
Open backup folder
Restore entire project
Restore selected areas
next.collaboration = cloneProject(project).collaboration
window.confirm
working-together
Get approved story
Edit locally
Submit story proposal
Project Lead decides
requires a new pull before submission
The approved main version is unchanged until the Project Lead accepts it.
Not connected
Checking
Ready
Needs attention
Create a fine-grained token in GitHub
https://github.com/settings/personal-access-tokens/new
Contents and Pull requests to Read and write
The green Ready light still requires all five live collaboration checks
role="status" aria-live="polite"
disabled={working || !status.ready}
*/