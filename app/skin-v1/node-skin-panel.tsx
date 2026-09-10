"use client";

import { useCallback, useEffect, useState } from "react";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import { PROJECT_LIBRARY_CHANGED_EVENT } from "@/core/storage/project-library-browser";
import { getProfilePrivateSaveState, PROFILE_PRIVATE_SAVE_STATE_EVENT } from "@/core/storage/profile-private-browser";
import { PLOTPICKLE_VERSION } from "@/lib/runtime/application-version";

type NodeStatus = {
  node: { id: string; shortId: string };
  lifecycle: { state: string; lastError: string; inProgress: boolean };
  launcher: { browserOwnership: string; shutdownSignalConfigured: boolean };
};

type ProfileStatus = {
  authenticated: boolean;
  profile: { displayName: string } | null;
};

type TopologyStatus = {
  currentNode?: {
    readiness?: string;
    capabilities?: readonly string[];
  };
};

const shell: React.CSSProperties = {
  minHeight: "100vh",
  padding: "var(--pp-skin-space-4) clamp(10px, 2vw, var(--pp-skin-space-6)) var(--pp-skin-space-7)",
  background: "var(--pp-skin-fill-panel)",
  color: "var(--pp-skin-ink)",
  fontFamily: "var(--pp-skin-font-ui)",
};

const panel: React.CSSProperties = {
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line-strong)",
  borderRadius: "var(--pp-skin-radius)",
  background: "var(--pp-skin-surface-1)",
  padding: "var(--pp-skin-space-4)",
  boxShadow: "var(--pp-skin-shadow-control)",
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(140px, 0.35fr) 1fr",
  gap: "var(--pp-skin-space-4)",
  padding: "var(--pp-skin-space-3) 0",
  borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  alignItems: "start",
};

const button: React.CSSProperties = {
  minHeight: "var(--pp-skin-control-height)",
  padding: "var(--pp-skin-space-2) var(--pp-skin-space-4)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line-strong)",
  borderRadius: "var(--pp-skin-radius)",
  background: "var(--pp-skin-surface-1)",
  color: "var(--pp-skin-ink)",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};

async function readJson<T>(response: Response, fallback: string) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error(fallback);
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || fallback);
  return value;
}

export default function NodeSkinPanel() {
  const [node, setNode] = useState<NodeStatus | null>(null);
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [topology, setTopology] = useState<TopologyStatus | null>(null);
  const [projectTitle, setProjectTitle] = useState("No active project");
  const [saveState, setSaveState] = useState(getProfilePrivateSaveState());
  const [notice, setNotice] = useState("Reading Node information...");

  const refresh = useCallback(async () => {
    try {
      const [nodeResponse, profileResponse, topologyResponse] = await Promise.all([
        fetch("/api/system/node-control", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/system/node-topology", { credentials: "same-origin", cache: "no-store" }),
      ]);
      const [nodeStatus, profileStatus, topologyStatus] = await Promise.all([
        readJson<NodeStatus>(nodeResponse, "Node control is unavailable."),
        readJson<ProfileStatus>(profileResponse, "Profile status is unavailable."),
        readJson<TopologyStatus>(topologyResponse, "Node topology is unavailable."),
      ]);
      setNode(nodeStatus);
      setProfile(profileStatus);
      setTopology(topologyStatus);
      try { setProjectTitle(loadFoundationProject().title || "Untitled Story"); }
      catch { setProjectTitle("No active project"); }
      setSaveState(getProfilePrivateSaveState());
      setNotice("NODE INFORMATION CURRENT");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Node information could not be read.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const syncProject = () => {
      try { setProjectTitle(loadFoundationProject().title || "Untitled Story"); }
      catch { setProjectTitle("No active project"); }
      setSaveState(getProfilePrivateSaveState());
    };
    const syncSave = () => setSaveState(getProfilePrivateSaveState());
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, syncProject);
    window.addEventListener(PROFILE_PRIVATE_SAVE_STATE_EVENT, syncSave);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, syncProject);
      window.removeEventListener(PROFILE_PRIVATE_SAVE_STATE_EVENT, syncSave);
    };
  }, [refresh]);

  const capabilities = topology?.currentNode?.capabilities
    ?.filter((item) => !["client", "host"].includes(item))
    .join(" / ") || "LOCAL CORE";
  const readiness = topology?.currentNode?.readiness || "UNKNOWN";
  const saveLabel = saveState.state === "saved" ? "SAVED" : saveState.state === "saving" ? "SAVING" : "SAVE BLOCKED";

  const rows = [
    ["NODE", node?.node.shortId || "CHECKING..."],
    ["FULL NODE ID", node?.node.id || "CHECKING..."],
    ["VERSION", PLOTPICKLE_VERSION],
    ["LIFECYCLE", node?.lifecycle.state || "CHECKING..."],
    ["ACTIVE HUMAN", profile?.profile?.displayName || "LOCKED"],
    ["CURRENT PROJECT", projectTitle],
    ["SAVE STATE", saveLabel],
    ["READINESS", readiness.toUpperCase()],
    ["CAPABILITIES", capabilities.toUpperCase()],
  ] as const;

  return (
    <div style={shell} data-skin-v1-node="true">
      <section style={panel} aria-labelledby="skin-v1-node-title">
        <p style={{ margin: 0, fontSize: 12, color: "var(--pp-skin-accent-bright)", letterSpacing: ".08em" }}>PROFILE / NODE</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h1 id="skin-v1-node-title" style={{ margin: "6px 0 4px", fontSize: 24 }}>NODE</h1>
            <p style={{ margin: 0, color: "var(--pp-skin-ink-soft)" }}>LOCAL PLOTPICKLE INSTALLATION</p>
          </div>
          <span style={{ border: "var(--pp-skin-border-thin) solid var(--pp-skin-line-strong)", padding: "5px 9px", color: node?.lifecycle.state === "RUNNING" ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-ink)" }}>
            {node?.lifecycle.state || "CHECKING"}
          </span>
        </div>
      </section>

      <section style={{ ...panel, marginTop: 12 }} aria-label="Node information">
        {rows.map(([label, value]) => (
          <div key={label} style={row}>
            <strong style={{ color: "var(--pp-skin-ink)" }}>{label}</strong>
            <span style={{ color: "var(--pp-skin-ink-soft)", overflowWrap: "anywhere" }}>{value}</span>
          </div>
        ))}
        {node?.launcher.browserOwnership ? (
          <div style={row}>
            <strong>BROWSER OWNERSHIP</strong>
            <span style={{ color: "var(--pp-skin-ink-soft)" }}>{node.launcher.browserOwnership.toUpperCase()}</span>
          </div>
        ) : null}
        {node?.lifecycle.lastError ? <p role="alert" style={{ borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-line)", paddingTop: 12, color: "var(--pp-skin-ink)" }}>{node.lifecycle.lastError}</p> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" style={button} onClick={() => void refresh()}>REFRESH NODE</button>
        </div>
      </section>

      <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "var(--pp-skin-accent-bright)" }}>{notice}</p>
      <p style={{ margin: "18px 0 0", color: "var(--pp-skin-ink-muted)", fontSize: 12, lineHeight: 1.5 }}>
        NODE IDENTITY IS DEVICE-SCOPED. HUMAN PROFILE SETTINGS REMAIN SEPARATE.
      </p>
    </div>
  );
}
