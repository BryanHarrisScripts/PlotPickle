"use client";

import { useMemo, useState } from "react";
import ApplicationShellHeader from "../../application-shell-header";
import styles from "../../buzz-settings.module.css";
import {
  BUZZ_RUNTIME_BOUNDARIES,
  BUZZ_RUNTIME_COMPONENTS,
  DORMANT_BUZZ_RUNTIME,
} from "@/lib/buzz-runtime";
import type { ProductNavigationId } from "@/lib/product-direction";

const BUZZ_CONFIGURATION_KEY = "plotpickle.buzz.configuration.v1";

type BuzzConfiguration = {
  mode: "bundled" | "existing-relay";
  relayUrl: string;
  identityLabel: string;
  community: string;
  developerMode: boolean;
  allowCodingAgents: boolean;
};

const DEFAULT_CONFIGURATION: BuzzConfiguration = {
  mode: "bundled",
  relayUrl: "",
  identityLabel: "",
  community: "",
  developerMode: false,
  allowCodingAgents: false,
};

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

function readInitialConfiguration(): BuzzConfiguration {
  if (typeof window === "undefined") return DEFAULT_CONFIGURATION;
  try {
    const stored = window.localStorage.getItem(BUZZ_CONFIGURATION_KEY);
    return stored ? { ...DEFAULT_CONFIGURATION, ...JSON.parse(stored) } : DEFAULT_CONFIGURATION;
  } catch {
    return DEFAULT_CONFIGURATION;
  }
}

export default function BuzzSettingsPage() {
  const runtime = DORMANT_BUZZ_RUNTIME;
  const [configuration, setConfiguration] = useState<BuzzConfiguration>(readInitialConfiguration);
  const [notice, setNotice] = useState("");

  const existingRelayReady = useMemo(() => {
    if (configuration.mode !== "existing-relay") return false;
    try {
      const url = new URL(configuration.relayUrl);
      return url.protocol === "https:" || url.hostname === "127.0.0.1" || url.hostname === "localhost";
    } catch {
      return false;
    }
  }, [configuration.mode, configuration.relayUrl]);

  function navigate(tab: ProductNavigationId) {
    if (tab === "buzz") {
      window.location.assign("/buzz");
      return;
    }
    const workspace = WORKSPACE_QUERY[tab] ?? "dashboard";
    window.location.assign(`/?workspace=${encodeURIComponent(workspace)}`);
  }

  function updateConfiguration(patch: Partial<BuzzConfiguration>) {
    setConfiguration((current) => ({ ...current, ...patch }));
    setNotice("");
  }

  function saveConfiguration() {
    if (configuration.mode === "existing-relay" && !existingRelayReady) {
      setNotice("Enter a valid HTTPS, localhost or 127.0.0.1 Buzz relay address before saving.");
      return;
    }
    window.localStorage.setItem(BUZZ_CONFIGURATION_KEY, JSON.stringify(configuration));
    setNotice(configuration.mode === "bundled"
      ? "Bundled Buzz preferences were saved. The runtime remains dormant because verified native artifacts are not packaged yet."
      : "The existing-relay configuration draft was saved on this device. No identity or credential was created and no connection was attempted.");
  }

  function eraseConfiguration() {
    window.localStorage.removeItem(BUZZ_CONFIGURATION_KEY);
    setConfiguration(DEFAULT_CONFIGURATION);
    setNotice("The Buzz configuration draft was removed. No Buzz data or identity existed to erase.");
  }

  const packagedActionLabel = runtime.packaged ? "Configure bundled Buzz" : "Bundled runtime unavailable";

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
            <h1>Configure the optional Buzz workspace.</h1>
            <span>Settings owns Buzz setup, lifecycle, recovery and removal. Collab owns formal approvals; Buzz owns rooms, agents, media discussion and development activity.</span>
          </header>

          <section className={styles.statusCard} aria-labelledby="buzz-settings-status-title">
            <div>
              <p>Current runtime status</p>
              <h2 id="buzz-settings-status-title">Not configured</h2>
              <p>{runtime.message}</p>
            </div>
            <div className={styles.statusBadge} role="status"><i aria-hidden="true" /><b>Red · disconnected</b></div>
          </section>

          <section className={styles.runtimeGrid} aria-label="Buzz runtime information">
            <article><span>Package</span><strong>{runtime.packaged ? "Verified runtime included" : "Native artifacts not packaged"}</strong><small>PlotPickle never downloads or executes an unverified replacement.</small></article>
            <article><span>Process and port</span><strong>{runtime.processRunning || runtime.relayListening ? "Active" : "None"}</strong><small>No background process or listening port exists.</small></article>
            <article><span>Identity</span><strong>{runtime.identityCreated ? "Created" : "Not created"}</strong><small>Private keys and service secrets remain outside PPF and GitHub.</small></article>
            <article><span>Data</span><strong>{runtime.dataCreated ? "Initialized" : "Not created"}</strong><small>No database, room, media store or worktree exists.</small></article>
          </section>

          <section className={styles.choiceGrid} aria-label="Buzz connection mode">
            <article className={configuration.mode === "bundled" ? styles.selectedChoice : undefined}>
              <span>Recommended managed option</span>
              <h2>Use bundled local Buzz</h2>
              <p>PlotPickle will eventually initialize, start, stop, repair, update, back up and remove its pinned native Buzz runtime.</p>
              <button type="button" onClick={() => updateConfiguration({ mode: "bundled" })}>Select bundled Buzz</button>
              <small>Selected preferences can be saved now, but activation remains disabled until platform artifacts pass checksums and clean-machine validation.</small>
            </article>
            <article className={configuration.mode === "existing-relay" ? styles.selectedChoice : undefined}>
              <span>Advanced self-managed option</span>
              <h2>Connect an existing relay</h2>
              <p>Store the relay address and identity label without moving credentials into PPF, browser project data or GitHub.</p>
              <button type="button" onClick={() => updateConfiguration({ mode: "existing-relay" })}>Select existing relay</button>
              <small>A later local gateway step performs the connection test and encrypted identity setup.</small>
            </article>
          </section>

          <section className={styles.formCard} aria-labelledby="buzz-connection-details-title">
            <div><span>Connection details</span><h2 id="buzz-connection-details-title">{configuration.mode === "bundled" ? "Bundled local runtime" : "Existing Buzz relay"}</h2></div>
            <div className={styles.formGrid}>
              <label><span>Relay address</span><input type="url" value={configuration.relayUrl} disabled={configuration.mode === "bundled"} onChange={(event) => updateConfiguration({ relayUrl: event.target.value })} placeholder={configuration.mode === "bundled" ? "Managed automatically after native packaging" : "https://buzz.example.com"} /></label>
              <label><span>Identity label</span><input value={configuration.identityLabel} onChange={(event) => updateConfiguration({ identityLabel: event.target.value })} placeholder="Bryan · PlotPickle" /></label>
              <label><span>Community / workspace</span><input value={configuration.community} onChange={(event) => updateConfiguration({ community: event.target.value })} placeholder="PlotPickle project community" /></label>
            </div>
            <label className={styles.toggle}><span><b>Developer Mode</b><small>Required before Buzz may coordinate isolated coding worktrees.</small></span><input type="checkbox" checked={configuration.developerMode} onChange={(event) => updateConfiguration({ developerMode: event.target.checked, allowCodingAgents: event.target.checked ? configuration.allowCodingAgents : false })} /></label>
            <label className={styles.toggle}><span><b>Allow coding agents</b><small>Agents remain branch-only, test-gated and unable to read the PlotPickle credential vault or unrelated PPF folders.</small></span><input type="checkbox" disabled={!configuration.developerMode} checked={configuration.allowCodingAgents} onChange={(event) => updateConfiguration({ allowCodingAgents: event.target.checked })} /></label>
          </section>

          <section className={styles.lifecycleCard} aria-label="Buzz lifecycle controls">
            <div><span>Runtime lifecycle</span><h2>Settings keeps every action explicit.</h2><p>Unavailable actions stay disabled instead of pretending Buzz is connected.</p></div>
            <div className={styles.lifecycleActions}>
              <button type="button" disabled={!runtime.packaged}>{packagedActionLabel}</button>
              <button type="button" disabled={!runtime.configured}>Start</button>
              <button type="button" disabled={!runtime.processRunning}>Stop</button>
              <button type="button" disabled={!runtime.processRunning}>Restart</button>
              <button type="button" disabled={!runtime.packaged}>Test connection</button>
              <button type="button" disabled={!runtime.packaged}>Repair</button>
              <button type="button" disabled={!runtime.packaged}>Update</button>
              <button type="button" disabled={!runtime.dataCreated}>Back up</button>
              <button type="button" disabled={!runtime.dataCreated}>Restore</button>
              <button type="button" disabled={!runtime.dataCreated}>Remove Buzz data</button>
              <button type="button" disabled={!runtime.identityCreated}>Erase identity and credentials</button>
            </div>
          </section>

          <section className={styles.boundary}>
            <span>Dormant-by-default guarantee</span>
            <h2>Installing PlotPickle does not activate Buzz.</h2>
            <p>{BUZZ_RUNTIME_BOUNDARIES.dormantRule}</p>
            <ul><li>No background process or operating-system service.</li><li>No listening relay port.</li><li>No Buzz identity, private key or credential file.</li><li>No database, project room, media store or coding worktree.</li><li>No story content leaves the local PPF project.</li></ul>
          </section>

          <section className={styles.boundary}>
            <span>Managed component plan</span>
            <h2>PlotPickle packages only the native Buzz pieces it uses.</h2>
            <p>{BUZZ_RUNTIME_COMPONENTS.join(" · ")}</p><p>{BUZZ_RUNTIME_BOUNDARIES.packagingRule}</p>
          </section>

          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
          <section className={styles.actions}>
            <button type="button" onClick={saveConfiguration}>Save Buzz configuration</button>
            <button type="button" className={styles.removeAction} onClick={eraseConfiguration}>Remove configuration draft</button>
            <a href="/buzz">Open Buzz workspace</a>
            <button type="button" onClick={() => window.location.assign("/?workspace=settings")}>Return to all Settings</button>
          </section>
        </div>
      </main>
    </div>
  );
}
