"use client";

import ApplicationShellHeader from "../../application-shell-header";
import styles from "../../buzz-settings.module.css";
import {
  BUZZ_RUNTIME_BOUNDARIES,
  BUZZ_RUNTIME_COMPONENTS,
  DORMANT_BUZZ_RUNTIME,
} from "@/lib/buzz-runtime";
import type { ProductNavigationId } from "@/lib/product-direction";

const WORKSPACE_QUERY: Partial<Record<ProductNavigationId, string>> = {
  dashboard: "dashboard",
  learn: "learn",
  planner: "plan",
  visuals: "storyboard",
  script: "write",
  pitch: "pitch",
  build: "build",
  feedback: "feedback",
  engines: "refine",
  reports: "reports",
  collab: "collab",
  settings: "settings",
};

export default function BuzzSettingsPage() {
  const runtime = DORMANT_BUZZ_RUNTIME;

  function navigate(tab: ProductNavigationId) {
    if (tab === "buzz") {
      window.location.assign("/buzz");
      return;
    }
    const workspace = WORKSPACE_QUERY[tab] ?? "dashboard";
    window.location.assign(`/?workspace=${encodeURIComponent(workspace)}`);
  }

  return (
    <div className="app-shell">
      <ApplicationShellHeader
        activeTab="settings"
        onNavigate={navigate}
        onProjectAction={(action) => window.location.assign(`/?workspace=dashboard&action=${encodeURIComponent(action)}`)}
        onOpenLanding={() => window.location.assign("/")}
      />
      <main className="workspace-main">
        <div className={styles.page}>
          <header className={styles.heading}>
            <p>Settings · Integrations · Buzz</p>
            <h1>Configure the PlotPickle-managed Buzz runtime.</h1>
            <span>Buzz is optional. PlotPickle remains fully usable when it is unconfigured, stopped or unavailable.</span>
          </header>

          <section className={styles.statusCard} aria-labelledby="buzz-settings-status-title">
            <div>
              <p>Current runtime status</p>
              <h2 id="buzz-settings-status-title">Not configured</h2>
              <p>{runtime.message}</p>
            </div>
            <div className={styles.statusBadge} role="status"><i aria-hidden="true" /><b>Red · disconnected</b></div>
          </section>

          <section className={styles.choiceGrid} aria-label="Buzz installation choices">
            <article>
              <span>Recommended</span>
              <h2>Use bundled local Buzz</h2>
              <p>PlotPickle will initialize, start, stop, repair, update, back up and remove its included native Buzz runtime.</p>
              <button type="button" disabled>Configure bundled Buzz</button>
              <small>Unavailable until platform-native artifacts and manifests pass clean-machine validation.</small>
            </article>
            <article>
              <span>Advanced</span>
              <h2>Connect an existing relay</h2>
              <p>A future advanced option may connect PlotPickle to a separately managed Buzz relay without changing the PPF authority boundary.</p>
              <button type="button" disabled>Connect relay</button>
              <small>No relay credential or identity is created in this architecture phase.</small>
            </article>
          </section>

          <section className={styles.boundary}>
            <span>Dormant-by-default guarantee</span>
            <h2>Installing PlotPickle does not activate Buzz.</h2>
            <p>{BUZZ_RUNTIME_BOUNDARIES.dormantRule}</p>
            <ul>
              <li>No background process or operating-system service.</li>
              <li>No listening relay port.</li>
              <li>No Buzz identity, private key or credential file.</li>
              <li>No database, project room, media store or coding worktree.</li>
              <li>No story content leaves the local PPF project.</li>
            </ul>
          </section>

          <section className={styles.boundary}>
            <span>Managed component plan</span>
            <h2>PlotPickle includes only the native Buzz pieces it needs.</h2>
            <p>{BUZZ_RUNTIME_COMPONENTS.join(" · ")}</p>
            <p>{BUZZ_RUNTIME_BOUNDARIES.packagingRule}</p>
          </section>

          <section className={styles.actions}>
            <a href="/buzz">Open Buzz workspace</a>
            <button type="button" onClick={() => window.location.assign("/?workspace=settings")}>Return to all Settings</button>
          </section>
        </div>
      </main>
    </div>
  );
}
