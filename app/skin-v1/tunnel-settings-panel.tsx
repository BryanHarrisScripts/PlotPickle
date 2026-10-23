"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedProfileFetch } from "../../core/auth/profile-request-browser";
import styles from "./tunnel-settings-panel.module.css";

type TunnelLocalState = "WINDOWS_ONLY" | "LAUNCHER_NOT_INSTALLED" |
  "READY_TO_LAUNCH" | "LOCAL_MCP_PORT_OCCUPIED";
type TunnelStatus = {
  readonly version: 1;
  readonly state: TunnelLocalState;
  readonly launcherAvailable: boolean;
  readonly localMcpPortOccupied: boolean;
  readonly remoteAuthorized: false;
};
const ENDPOINT = "/api/factory/tunnel";
const LABELS: Record<TunnelLocalState, string> = {
  WINDOWS_ONLY: "Available on the local Windows installation",
  LAUNCHER_NOT_INSTALLED: "Local tunnel launcher not installed",
  READY_TO_LAUNCH: "Launcher found · tunnel not locally observed",
  LOCAL_MCP_PORT_OCCUPIED: "Local MCP port occupied · remote authorization unverified",
};

export default function TunnelSettingsPanel() {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [engineering, setEngineering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Checking the local Windows tunnel launcher…");

  const refresh = useCallback(async () => {
    try {
      const response = await authenticatedProfileFetch(ENDPOINT, {
        method: "GET", cache: "no-store", headers: { Accept: "application/json" },
      });
      const body = await response.json() as TunnelStatus & { code?: string };
      if (!response.ok) throw new Error(body.code || "TUNNEL_STATUS_UNAVAILABLE");
      setStatus(body);
      setNotice("");
    } catch (error) {
      setStatus(null);
      setNotice(error instanceof Error && error.message === "LOCAL_WINDOWS_ONLY"
        ? "Tunnel setup is available on the local Windows installation."
        : "Unlock the Human profile or check that PlotPickle is running locally. Tunnel state is not verified.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function start() {
    if (busy || !status?.launcherAvailable || status.localMcpPortOccupied) return;
    if (!window.confirm("Open your local PlotPickle tunnel launcher in a separate PowerShell window? You will enter your own restricted key there. PlotPickle will not receive that key.")) return;
    setBusy(true);
    try {
      const response = await authenticatedProfileFetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "start", engineering }),
      });
      const body = await response.json() as { state?: string; code?: string };
      if (!response.ok || body.state !== "LAUNCH_REQUESTED") {
        throw new Error(body.code || "TUNNEL_START_BLOCKED");
      }
      // Startup request is not proof of a running tunnel or authorized plugin.
      setNotice("PowerShell launch requested. Enter your restricted Tunnel Runtime API key in that window. Look for PLOTPICKLE TUNNEL READY there, then connect your own ChatGPT Plugin.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Tunnel launch was blocked.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.root} aria-label="Tunnel settings" data-settings-tunnel="owner-controlled">
      <header className={styles.head}>
        <p>SETTINGS / COMPUTE / TUNNEL</p>
        <h2>My PlotPickle Tunnel</h2>
        <span>Use your own authenticated MCP connection for development and creative tools. Existing story and Factory permissions do not change.</span>
      </header>
      <div className={styles.status} role="status">
        <strong>{status ? LABELS[status.state] : "Local status unverified"}</strong>
        <span>Local MCP: {status?.localMcpPortOccupied ? "PORT 43115 OCCUPIED (IDENTITY UNVERIFIED)" : "NOT OBSERVED"}</span>
        <span>ChatGPT plugin authorization: NOT VERIFIED BY THIS PAGE</span>
        {notice ? <p>{notice}</p> : null}
      </div>
      <div className={styles.controls}>
        <label className={styles.toggle}>
          <input type="checkbox" checked={engineering} onChange={(event) => setEngineering(event.currentTarget.checked)} />
          <span>Enable the authenticated Engineering Workbench tool (6 authenticated MCP tools instead of the basic 5)</span>
        </label>
        <div className={styles.actions}>
          <button type="button" disabled={busy || !status?.launcherAvailable || status.localMcpPortOccupied} onClick={() => void start()}>
            {busy ? "Requesting launch…" : "Start My Tunnel"}
          </button>
          <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh local status</button>
        </div>
      </div>
      <div className={styles.help}>
        <h3>Set up your own tunnel</h3>
        <ol>
          <li>Keep your local PlotPickle app running and unlock your Human profile.</li>
          <li>Make sure <code>Start-PlotPickle-Tunnel-Authenticated.ps1</code> exists in your PlotPickle repository directory. If it is missing, install the separately provisioned authenticated launcher first.</li>
          <li>Select <strong>Start My Tunnel</strong>. In the separate PowerShell window, provide your own restricted Tunnel Runtime API key at its hidden prompt. Do not enter it here or paste it into ChatGPT.</li>
          <li>Wait for <strong>PLOTPICKLE TUNNEL READY</strong> in that window. Configure your own PlotPickle MCP Tunnel plugin in ChatGPT. Local port availability does not confirm the plugin is connected.</li>
          <li>When finished, use <strong>Ctrl+C</strong> in the owning PowerShell window. This GUI will not guess a process ID or stop unrelated services.</li>
        </ol>
        <p>Local MCP: <code>http://127.0.0.1:43115/mcp</code>. Local tunnel dashboard: <a href="http://127.0.0.1:8080/ui" target="_blank" rel="noreferrer">Open tunnel dashboard</a> (available only when your launcher started it).</p>
        <small>Starting a tunnel does not enable autonomous coding, paid providers, automatic merges or sharing creative files. Those require separate credentials, consents and verification gates.</small>
      </div>
    </section>
  );
}
