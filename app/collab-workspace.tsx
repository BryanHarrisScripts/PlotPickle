"use client";

import { useEffect, useState } from "react";
import type { ConnectionId, ConnectionStatusSnapshot, PublicConnectionStatus } from "@/lib/connection-status";
import type { PlotPickleProject } from "@/lib/project";
import GitHubCollaboration from "./github-collaboration";
import GoogleCalendarWorkspace from "./google-calendar-workspace";
import GoogleMeetWorkspace from "./google-meet-workspace";
import RefreshAction from "./refresh-action";
import BuzzCollabPanel from "./buzz-collab-panel";
import styles from "./collab-workspace.module.css";

type CollabSection = "overview" | "buzz" | "approvals" | "meetings" | "calendar" | "connections";
type SettingsConnection = "github" | "google" | "buzz";

const COLLAB_SECTION_KEY = "plotpickle.collab.section";

const SECTIONS: Array<{ id: CollabSection; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Project collaboration status and the next shared action" },
  { id: "buzz", label: "Buzz", description: "Project Story Rooms, discussion and human-reviewed PPF proposals" },
  { id: "approvals", label: "Approvals", description: "GitHub Story Proposals and Project Lead decisions" },
  { id: "meetings", label: "Meetings", description: "Project meetings and Google Meet links" },
  { id: "calendar", label: "Calendar", description: "Project-focused dates and meeting events" },
  { id: "connections", label: "Connections", description: "Provider status with setup routed to Settings" },
];

function statusLabel(status: PublicConnectionStatus) {
  if (status.state === "connected") return "Connected";
  if (status.state === "configured") return "Configured";
  if (status.state === "checking") return "Checking";
  if (status.state === "error") return "Needs attention";
  if (status.state === "unavailable") return "Unavailable";
  if (status.state === "disabled") return "Disabled";
  return "Not connected";
}

function statusTone(status: PublicConnectionStatus) {
  if (status.state === "connected") return styles.ready;
  if (status.state === "configured" || status.state === "checking") return styles.waiting;
  if (status.state === "error" || status.state === "unavailable") return styles.attention;
  return styles.disconnected;
}

function ProviderCard({
  status,
  purpose,
  onOpenSettings,
}: {
  status: PublicConnectionStatus;
  purpose: string;
  onOpenSettings: () => void;
}) {
  return (
    <article className={`${styles.providerCard} ${statusTone(status)}`}>
      <header>
        <div><span>{status.label}</span><h3>{status.identity || purpose}</h3></div>
        <strong><i aria-hidden="true" />{statusLabel(status)}</strong>
      </header>
      <p>{status.detail}</p>
      <small>{purpose}</small>
      <button type="button" onClick={onOpenSettings}>Open {status.label} settings</button>
    </article>
  );
}

export default function CollabWorkspace({
  project,
  onProjectChange,
  connections,
  onConnectionChange,
  onOpenSettings,
}: {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  connections: ConnectionStatusSnapshot;
  onConnectionChange: () => void | Promise<void>;
  onOpenSettings: (section: SettingsConnection) => void;
}) {
  const [section, setSection] = useState<CollabSection>("overview");
  const github = connections.items.github;
  const google = connections.items.google;
  const approvedCommit = project.collaboration.lastPulledCommit;
  const proposedCommit = project.collaboration.lastPushedCommit;
  const repository = project.collaboration.owner && project.collaboration.repo
    ? `${project.collaboration.owner}/${project.collaboration.repo}`
    : "No repository selected";
  const branch = project.collaboration.branch || "main";
  const githubConnected = github.state === "connected";

  useEffect(() => {
    const requested = window.sessionStorage.getItem(COLLAB_SECTION_KEY);
    window.sessionStorage.removeItem(COLLAB_SECTION_KEY);
    if (!requested || !SECTIONS.some((item) => item.id === requested)) return;
    const timer = window.setTimeout(() => setSection(requested as CollabSection), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openSettings(id: ConnectionId) {
    if (id === "github" || id === "google") onOpenSettings(id);
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Collab</p>
          <h1>Shared work without mixing setup into the story.</h1>
          <span>Review GitHub Story Proposals, prepare project meetings and see connected-service status. Account, repository and permission setup remains in Settings.</span>
        </div>
        <div className={styles.projectCard}>
          <span>Active story</span>
          <strong>{project.metadata.title}</strong>
          <small>{repository}{repository !== "No repository selected" ? ` · ${branch}` : " · local project"}</small>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Collab sections" role="tablist">
        {SECTIONS.map((item) => (
          <button
            type="button"
            role="tab"
            key={item.id}
            aria-selected={section === item.id}
            aria-current={section === item.id ? "page" : undefined}
            className={section === item.id ? styles.active : ""}
            title={item.description}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {section === "overview" ? (
        <div className={styles.stack}>
          <section className={styles.summaryGrid}>
            <article>
              <span>Approved story</span>
              <strong>{approvedCommit ? approvedCommit.slice(0, 10) : "Approved story refresh required"}</strong>
              <p>{approvedCommit ? "This local project records the latest approved GitHub commit it reviewed." : githubConnected ? "The repository is connected, but its approved story has not been refreshed into this local project." : "Connect GitHub in Settings before using proposal and approval actions."}</p>
              <RefreshAction label={approvedCommit ? "Review approved story" : "Open refresh workflow"} onClick={() => setSection("approvals")} />
            </article>
            <article>
              <span>Latest proposal</span>
              <strong>{proposedCommit ? proposedCommit.slice(0, 10) : "No proposal recorded"}</strong>
              <p>Proposal creation and Project Lead decisions remain explicit. Local edits never become canonical automatically.</p>
              <button type="button" onClick={() => setSection("approvals")}>Review proposal workflow</button>
            </article>
            <article>
              <span>Project calendar</span>
              <strong>{google.state === "connected" ? "Google ready" : "Optional"}</strong>
              <p>Calendar events remain project-focused. No personal calendar is displayed by default.</p>
              <button type="button" onClick={() => setSection("calendar")}>Open calendar</button>
            </article>
            <article>
              <span>Buzz Story Room</span>
              <strong>Optional writers’ room</strong>
              <p>Discuss scenes and visuals, then turn selected discussion into a proposal that still requires human approval.</p>
              <button type="button" onClick={() => setSection("buzz")}>Open Buzz Story Room</button>
            </article>
          </section>

          <section className={styles.providerGrid} aria-label="Collaboration provider status">
            <ProviderCard status={github} purpose="Carries approved story revisions and Story Proposals. It does not decide which story is currently loaded." onOpenSettings={() => openSettings("github")} />
            <ProviderCard status={google} purpose="Carries project Calendar events and their explicitly created Meet links." onOpenSettings={() => openSettings("google")} />
          </section>

          <section className={styles.ruleCard}>
            <span>Workspace boundary</span>
            <h2>Settings configures services. Collab uses services.</h2>
            <p>Credentials, permission grants, repository selection and provider recovery stay in Settings. Collab contains only shared work, decisions, meetings and provider status.</p>
          </section>
        </div>
      ) : null}

      {section === "buzz" ? (
        <BuzzCollabPanel
          project={project}
          onProjectChange={onProjectChange}
          onOpenSettings={() => onOpenSettings("buzz")}
        />
      ) : null}

      {section === "approvals" ? (
        <div className={styles.stack}>
          <section className={styles.sectionHeading}>
            <div>
              <span>Approvals</span>
              <h2>GitHub Story Proposals and Project Lead decisions</h2>
              <p>This workflow is powered by the configured GitHub repository for proposals, approved history and canonical story refreshes. It is not the GitHub connection screen. Current provider: {repository} · {branch}. Repository {githubConnected ? "connected" : "not connected"}; approved story {approvedCommit ? "recorded" : "refresh required"}.</p>
            </div>
            <button type="button" className={styles.providerBadge} onClick={() => openSettings("github")} aria-label="View GitHub connection settings">
              <i aria-hidden="true" />Powered by GitHub · {statusLabel(github)}
            </button>
          </section>
          <GitHubCollaboration
            project={project}
            onChange={onProjectChange}
            onConnectionChange={() => void onConnectionChange()}
            surface="approvals"
          />
        </div>
      ) : null}

      {section === "meetings" ? (
        <GoogleMeetWorkspace project={project} google={google} onOpenSettings={() => openSettings("google")} />
      ) : null}

      {section === "calendar" ? (
        <GoogleCalendarWorkspace project={project} google={google} onOpenSettings={() => openSettings("google")} />
      ) : null}

      {section === "connections" ? (
        <div className={styles.stack}>
          <section className={styles.sectionHeading}>
            <div><span>Connections</span><h2>See status here; change access in Settings.</h2><p>Collab never asks for a password, token, repository or OAuth permission. Each provider card opens its single configuration home.</p></div>
          </section>
          <section className={styles.providerGrid}>
            <ProviderCard status={github} purpose="Account, repository and permission setup lives in Settings → Repository & Collab." onOpenSettings={() => openSettings("github")} />
            <ProviderCard status={google} purpose="Sign-in and Calendar permission live in Settings → Scheduling & Meetings." onOpenSettings={() => openSettings("google")} />
          </section>
          <section className={styles.privacyCard}>
            <strong>Local-first credential boundary</strong>
            <p>GitHub and Google credentials remain in PlotPickle&apos;s protected local credential storage. They are never written to the canonical project, a .ppf package, an export, a report, a log or a GitHub commit.</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
