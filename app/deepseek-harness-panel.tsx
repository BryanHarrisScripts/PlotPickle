"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./deepseek-harness-panel.module.css";

type HarnessStatus = {
  checkedAt: string;
  state: "running" | "installed" | "available" | "not-installed";
  command: "ollama launch dsh";
  optional: true;
  autoInstallOnStartup: false;
  ollama: {
    installed: boolean;
    version: string;
    launchSupported: boolean;
  };
  dsh: {
    installed: boolean;
    running: boolean;
  };
  message: string;
};

function labelFor(state: HarnessStatus["state"]) {
  if (state === "running") return "Running";
  if (state === "installed") return "Installed";
  if (state === "available") return "Available";
  return "Not installed";
}

export default function DeepSeekHarnessPanel() {
  const [status, setStatus] = useState<HarnessStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/deepseek-harness/status", { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; status?: HarnessStatus; message?: string };
      if (!response.ok || !body.ok || !body.status) throw new Error(body.message || "Could not inspect DeepSeek Harness.");
      setStatus(body.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not inspect DeepSeek Harness.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const launch = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/deepseek-harness/launch", { method: "POST" });
      const body = await response.json() as { ok?: boolean; status?: HarnessStatus; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "Could not launch DeepSeek Harness.");
      if (body.status) setStatus(body.status);
      window.setTimeout(() => void refresh(), 1500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not launch DeepSeek Harness.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const canLaunch = Boolean(status?.ollama.installed && status.ollama.launchSupported && !status.dsh.running);

  return (
    <section className={styles.panel} aria-labelledby="deepseek-harness-title">
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>Optional developer harness</p>
          <h3 id="deepseek-harness-title">DeepSeek Harness</h3>
          <p className={styles.intro}>
            Use DeepSeek&apos;s open-source agent harness with the Ollama models already available on this machine. PlotPickle keeps Mastra and its native Agent Activity trace as the normal product runtime; DSH is an optional developer and agent-workflow tool.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => void refresh()} disabled={busy}>Refresh</button>
          <button className={styles.primary} type="button" onClick={() => void launch()} disabled={busy || !canLaunch}>
            {busy ? "Launching…" : status?.dsh.installed ? "Launch DSH" : "Install & launch DSH"}
          </button>
        </div>
      </div>

      <div className={styles.statusRow}>
        <span className={`${styles.badge} ${status?.state === "running" ? styles.running : ""}`}>{status ? labelFor(status.state) : "Checking…"}</span>
        <span>Ollama: {status?.ollama.installed ? status.ollama.version : "Not installed"}</span>
        <span>Launch integration: {status?.ollama.launchSupported ? "Available" : "Unavailable"}</span>
      </div>

      <div className={styles.command}>
        <span>Ollama command</span>
        <code>ollama launch dsh</code>
      </div>

      {status?.message ? <p className={styles.message}>{status.message}</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <p className={styles.safety}>
        PlotPickle never installs or launches DeepSeek Harness during normal startup. The command runs only after this explicit button press, and the integration does not replace PlotPickle&apos;s provider-independent local AI routing or native observability.
      </p>
    </section>
  );
}
