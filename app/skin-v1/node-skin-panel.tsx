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
  padding: "14px clamp(10px, 2vw, 24px) 28px",
  background: "#050505",
  color: "#f2f2f2",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const panel: React.CSSProperties = {
  border: "1px solid #d8d8d8",
  background: "#080808",
  padding: 16,
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(140px, 0.35fr) 1fr",
  gap: 14,
  padding: "11px 0",
  borderTop: "1px solid #303030",
  alignItems: "start",
};

const button: React.CSSProperties = {
  minHeight: 38,
  padding: "8px 14px",
  border: "1px solid #d8d8d8",
  background: "#0b0b0b",
  color: "#fff",
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
        <p style={{ margin: 0, fontSize: 12, color: "#8fc99f", letterSpacing: ".08em" }}>PROFILE / NODE</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h1 id="skin-v1-node-title" style={{ margin: "6px 0 4px", fontSize: 24 }}>NODE</h1>
            <p style={{ margin: 0, color: "#bdbdbd" }}>LOCAL PLOTPICKLE INSTALLATION</p>
          </div>
          <span style={{ border: "1px solid #d8d8d8", padding: "5px 9px", color: node?.lifecycle.state === "RUNNING" ? "#8fc99f" : "#f2f2f2" }}>
            {node?.lifecycle.state || "CHECKING"}
          </span>
        </div>
      </section>

      <section style={{ ...panel, marginTop: 12 }} aria-label="Node information">
        {rows.map(([label, value]) => (
          <div key={label} style={row}>
            <strong style={{ color: "#fff" }}>{label}</strong>
            <span style={{ color: "#cfcfcf", overflowWrap: "anywhere" }}>{value}</span>
          </div>
        ))}
        {node?.launcher.browserOwnership ? (
          <div style={row}>
            <strong>BROWSER OWNERSHIP</strong>
            <span style={{ color: "#cfcfcf" }}>{node.launcher.browserOwnership.toUpperCase()}</span>
          </div>
        ) : null}
        {node?.lifecycle.lastError ? <p role="alert" style={{ borderTop: "1px solid #303030", paddingTop: 12, color: "#fff" }}>{node.lifecycle.lastError}</p> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" style={button} onClick={() => void refresh()}>REFRESH NODE</button>
        </div>
      </section>

      <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "#8fc99f" }}>{notice}</p>
      <p style={{ margin: "18px 0 0", color: "#8f8f8f", fontSize: 12, lineHeight: 1.5 }}>
        NODE IDENTITY IS DEVICE-SCOPED. HUMAN PROFILE SETTINGS REMAIN SEPARATE.
      </p>
    </div>
  );
}
