"use client";

import { useEffect, useState } from "react";
import { authenticatedProfileFetch } from "../../../core/auth/profile-request-browser";
import styles from "../../skin-v1/settings-workspace-panel.module.css";

type Status = {
  state: "disconnected" | "connecting" | "ready" | "unavailable" | "failed";
  endpoint: string;
  installed: boolean;
  workspaceConfigured: boolean;
  owned: boolean;
  recommendedWorkspace?: string;
  message: string;
};

type Payload = { ok?: boolean; status?: Status; message?: string };

export default function OpenPencilCommandPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking OpenPencil MCP…");

  async function refresh(signal?: AbortSignal) {
    const response = await authenticatedProfileFetch("/api/openpencil/mcp", { cache: "no-store", signal });
    const body = await response.json() as Payload;
    if (!response.ok || !body.ok || !body.status) throw new Error(body.message || "OpenPencil status is unavailable.");
    setStatus(body.status);
    setWorkspaceRoot((current) => current.trim() ? current : body.status?.recommendedWorkspace || "");
    setMessage(body.status.message);
  }

  useEffect(() => {
    const abort = new AbortController();
    void refresh(abort.signal).catch((error) => {
      if (!abort.signal.aborted) setMessage(error instanceof Error ? error.message : "OpenPencil status is unavailable.");
    });
    return () => abort.abort();
  }, []);

  async function connect() {
    if (busy || !workspaceRoot.trim()) return;
    setBusy(true);
    try {
      const response = await authenticatedProfileFetch("/api/openpencil/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceRoot: workspaceRoot.trim() }),
      });
      const body = await response.json() as Payload;
      if (!response.ok || !body.ok || !body.status) throw new Error(body.message || "OpenPencil could not connect.");
      setStatus(body.status);
      setWorkspaceRoot((current) => current.trim() ? current : body.status?.recommendedWorkspace || "");
      setMessage(body.status.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OpenPencil could not connect.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await authenticatedProfileFetch("/api/openpencil/mcp", { method: "DELETE" });
      const body = await response.json() as Payload;
      if (!response.ok || !body.ok || !body.status) throw new Error(body.message || "OpenPencil could not disconnect.");
      setStatus(body.status);
      setWorkspaceRoot((current) => current.trim() ? current : body.status?.recommendedWorkspace || "");
      setMessage(body.status.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OpenPencil could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.form} aria-label="OpenPencil local design connection" data-command-openpencil={status?.state || "loading"}>
    <h2>OpenPencil</h2>
    <p>PlotPickle prepares the reviewed OpenPencil MCP package after core startup. The local MCP server still starts only when you explicitly connect it.</p>
    <p role="status">{message}</p>
    <small>State: {status?.state || "loading"} · Endpoint: {status?.endpoint || "127.0.0.1:7600/mcp"}</small>
    <label>
      <span>Local design workspace</span>
      <input
        value={workspaceRoot}
        onChange={(event) => setWorkspaceRoot(event.currentTarget.value)}
        placeholder="PlotPickle\\designs\\openpencil"
        disabled={busy || status?.state === "ready"}
      />
    </label>
    <div>
      <button type="button" disabled={busy || status?.state === "ready" || !workspaceRoot.trim()} onClick={() => { void connect(); }}>
        {busy ? "Working…" : "Connect OpenPencil"}
      </button>
      <button type="button" disabled={busy || status?.state !== "ready" || !status.owned} onClick={() => { void disconnect(); }}>
        Disconnect
      </button>
      <button type="button" disabled={busy} onClick={() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "OpenPencil status is unavailable.")); }}>
        Check status
      </button>
    </div>
    <small>Default workspace: the repository-owned designs\openpencil folder. Design source files there are Git artifacts; PlotPickle does not commit or merge them automatically.</small>
    <small>Command verbs: OpenPencil status · OpenPencil connect &lt;absolute workspace&gt; · OpenPencil disconnect</small>
  </section>;
}
