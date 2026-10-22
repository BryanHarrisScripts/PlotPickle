"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedProfileFetch } from "../../core/auth/profile-request-browser";
import styles from "./factory-supervisor-panel.module.css";

type SupervisorState = "OFF" | "OFFLINE" | "RUNNING" | "BLOCKED" | "PAUSE_REQUESTED" |
  "PAUSED" | "RESUME_REQUESTED" | "STOP_REQUESTED";
type Status = {
  readonly version: 1;
  readonly state: SupervisorState;
  readonly reason: string | null;
  readonly sourceHead: string | null;
  readonly heartbeatAt: number | null;
  readonly pauseAcknowledged: boolean;
  readonly workerProcessVerified: false;
  readonly autonomousCodingVerified: false;
  readonly automaticMergeEnabled: false;
};
const LABEL: Record<SupervisorState, string> = {
  OFF: "Not enabled",
  OFFLINE: "No fresh worker heartbeat",
  RUNNING: "Worker heartbeat observed",
  BLOCKED: "Worker is blocked",
  PAUSE_REQUESTED: "Pause requested, not yet acknowledged",
  PAUSED: "Pause acknowledged by worker",
  RESUME_REQUESTED: "Resume requested, worker not independently verified",
  STOP_REQUESTED: "Local STOP requested",
};
const ENDPOINT = "/api/factory/supervisor";
async function readBody(response: Response): Promise<Status & { readonly code?: string }> {
  const value = await response.json() as Status & { readonly code?: string };
  if (!response.ok) throw new Error(value.code || "SUPERVISOR_STATUS_UNAVAILABLE");
  return value;
}

export default function FactorySupervisorPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("Checking the authenticated local Windows Factory supervisor…");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await readBody(await fetch(ENDPOINT, {
        method: "GET", cache: "no-store", credentials: "same-origin",
        headers: { Accept: "application/json" },
      }));
      setStatus(next);
      setMessage("");
    } catch (error) {
      setStatus(null);
      setMessage(error instanceof Error && error.message === "LOCAL_WINDOWS_ONLY"
        ? "Factory supervisor controls are available only on the local Windows installation."
        : "Unlock your local PlotPickle Human profile or check the supervisor connection.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function request(action: "pause" | "resume") {
    setBusy(true);
    setMessage("");
    try {
      const response = await authenticatedProfileFetch(ENDPOINT, {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action }),
      });
      const receipt = await readBody(response);
      setMessage(action === "pause"
        ? "Pause submitted. Only an actual worker heartbeat can acknowledge PAUSED; in-flight work may still complete."
        : "Resume submitted. This does not prove that the supervisor is running or restart blocked work.");
      setStatus(receipt);
    } catch {
      setMessage("Operation blocked. Confirm an unlocked, recently reauthenticated local Human profile and unchanged Windows host pairing.");
      await refresh();
    } finally { setBusy(false); }
  }

  const canPause = status && ["OFFLINE", "RUNNING", "RESUME_REQUESTED"].includes(status.state);
  const canResume = status && ["PAUSE_REQUESTED", "PAUSED"].includes(status.state);
  return (
    <section className={styles.panel} aria-label="Software Factory supervisor" data-factory-supervisor-panel="local-authenticated">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>OPERATIONS / SOFTWARE FACTORY</p>
          <h3>Windows Supervisor</h3>
        </div>
        <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh status</button>
      </div>
      <p className={styles.state} role="status" data-factory-supervisor-state={status?.state || "UNAVAILABLE"}>
        {status ? LABEL[status.state] : "Supervisor status unavailable"}
      </p>
      {status?.reason && <p className={styles.detail}>Reason: {status.reason}</p>}
      {status?.sourceHead && <p className={styles.detail}>Bound source: <code>{status.sourceHead.slice(0, 12)}</code></p>}
      <div className={styles.actions}>
        <button type="button" disabled={busy || !canPause} onClick={() => void request("pause")}>Pause new work</button>
        <button type="button" disabled={busy || !canResume} onClick={() => void request("resume")}>Resume polling</button>
      </div>
      {message && <p className={styles.detail} role="status">{message}</p>}
      <p className={styles.note}>
        These commands use the same paired Windows supervisor as CMD. They cannot start a
        worker, cancel an in-flight task, or approve code, providers, spending or merges.
        A healthy heartbeat is not independent verification of process ownership.
      </p>
    </section>
  );
}
