"use client";

import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CONNECTION_ENGINES,
  CONNECTION_PROVIDERS,
  resolveConnectionJoin,
  connectionProof,
} from "../../core/contracts/compute/connection-join-contract.mjs";
import CapabilityDiagnosticsLog from "./capability-diagnostics-log";
import styles from "./hybrid-story-mode-panel.module.css";

type Capability = "text" | "image" | "video";
type Engine = "direct" | "comfy-local" | "comfy-cloud";
type ConnectionDraft = { engine: Engine; provider: string };
type RoutingOption = {
  label?: string; inferenceLocation?: string; provider?: string; supported?: boolean;
  disabled?: boolean; configured?: boolean; ready?: boolean; model?: string;
  locality?: string; cost?: string; error?: string; verifiedAt?: string;
  imageProfile?: string;
};
type Joined = {
  capability: Capability; engine: Engine; provider: string; route: string;
  profile?: string | null; joinedAt: string;
};
type RoutingGroup = { selected?: string; options?: Record<string, RoutingOption> };
type RoutingStatus = {
  ok?: boolean; text?: RoutingGroup; image?: RoutingGroup; video?: RoutingGroup;
  joins?: Partial<Record<Capability, Joined>>;
  join?: Joined & { ready?: boolean; state?: string; reason?: string };
  message?: string;
};

const CAPABILITIES: readonly { id: Capability; label: string; detail: string }[] = [
  { id: "text", label: "WRITING", detail: "Writing, planning and text Agents" },
  { id: "image", label: "IMAGES", detail: "Storyboards, references and stills" },
  { id: "video", label: "VIDEO", detail: "LTX, MiniMax H3 and cinematic motion" },
] as const;

const INITIAL_DRAFT: Record<Capability, ConnectionDraft> = {
  text: { engine: "direct", provider: "" },
  image: { engine: "direct", provider: "" },
  video: { engine: "direct", provider: "" },
};

function optionState(option: RoutingOption | undefined) {
  if (!option || option.supported === false || option.disabled) return "NOT CAPABLE";
  return option.ready ? "VERIFIED" : option.configured ? "TEST NEEDED" : "SETUP NEEDED";
}

export default function HybridStoryModePanel({ onChanged }: { readonly onChanged?: () => void }) {
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [draft, setDraft] = useState<Record<Capability, ConnectionDraft>>(INITIAL_DRAFT);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Checking capability connections…");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ai-routing/status", { cache: "no-store" });
      const body = await response.json() as RoutingStatus;
      if (!response.ok || body.ok === false) throw new Error(body.message || "Compute routing status is unavailable.");
      setRouting(body);
      setDraft((current) => {
        const next = { ...current };
        for (const capability of CAPABILITIES) {
          const existing = body.joins?.[capability.id];
          if (existing && !current[capability.id].provider) {
            next[capability.id] = { engine: existing.engine, provider: existing.provider };
          }
        }
        return next;
      });
      setNotice("Select a workflow when needed, select a provider or model, then Join. Setup and testing are separate from verification.");
    } catch (error) {
      setRouting(null);
      setNotice(error instanceof Error ? error.message : "Connections status is unavailable.");
    }
  }, []);

  useEffect(() => {
    const handler = () => { void refresh(); };
    handler();
    window.addEventListener("plotpickle:setup-status-refresh", handler);
    window.addEventListener("plotpickle:connection-status-refresh", handler);
    return () => {
      window.removeEventListener("plotpickle:setup-status-refresh", handler);
      window.removeEventListener("plotpickle:connection-status-refresh", handler);
    };
  }, [refresh]);

  function choose(capability: Capability, update: Partial<ConnectionDraft>) {
    setDraft((current) => ({ ...current, [capability]: { ...current[capability], ...update } }));
  }

  async function join(capability: Capability) {
    if (working) return;
    const selected = draft[capability];
    if (!selected.provider) {
      setNotice(`Select a provider or model for ${capability} before joining.`);
      return;
    }
    const compatibility = resolveConnectionJoin(capability, selected.engine, selected.provider);
    if (!compatibility.capable) {
      setNotice(compatibility.reason || "This route is not capable.");
      return;
    }
    setWorking(capability);
    try {
      const response = await fetch("/api/ai-routing/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability, engine: selected.engine, provider: selected.provider }),
      });
      const body = await response.json() as RoutingStatus;
      if (!response.ok || body.ok === false) throw new Error(body.message || "The Join could not be saved.");
      setRouting(body);
      setNotice(body.message || "Connection saved. Check the exact readiness state before generating.");
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
      onChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Join could not be saved.");
      await refresh();
    } finally {
      setWorking("");
    }
  }

  const setupCoverage = useMemo(() => {
    function summarize(locality: string) {
      let configured = 0;
      let ready = 0;
      for (const capability of CAPABILITIES) {
        const options = Object.values(routing?.[capability.id]?.options || {}).filter((item) => item.locality === locality);
        if (options.some((item) => item.configured || item.ready)) configured++;
        if (options.some((item) => item.ready)) ready++;
      }
      return { configured, ready, total: CAPABILITIES.length };
    }
    return { local: summarize("local"), cloud: summarize("cloud") };
  }, [routing]);

  const allReady = CAPABILITIES.every(({ id }) => {
    const joined = routing?.joins?.[id];
    return joined && connectionProof(routing, joined).ready && routing?.[id]?.selected === joined.route;
  });

  return (
    <div className={styles.surface} data-hybrid-story-mode="capability-matrix">
      <section className={styles.summary}>
        <div>
          <p>CAPABILITY CONNECTIONS</p>
          <h2>{allReady ? "CONNECTIONS READY" : "CONNECT YOUR CAPABILITIES"}</h2>
          <span>Connect workflows and local or cloud resources. A colored selection is not verification: only a successful capability test makes a Join ready for story work.</span>
        </div>
        <strong data-ready={allReady ? "true" : "false"}>{allReady ? "READY" : "SETUP NEEDED"}</strong>
      </section>

      <div className={styles.active} aria-label="Detected Local and Cloud compute setup">
        <span><b>LOCAL SETUP</b>{setupCoverage.local.ready}/{setupCoverage.local.total} capabilities verified · {setupCoverage.local.configured}/{setupCoverage.local.total} configured</span>
        <span><b>CLOUD SETUP</b>{setupCoverage.cloud.ready}/{setupCoverage.cloud.total} capabilities verified · {setupCoverage.cloud.configured}/{setupCoverage.cloud.total} configured</span>
      </div>

      <div className={styles.matrix} role="table" aria-label="Capability workflow routing and local and cloud providers">
        <div className={styles.header} role="row">
          <span role="columnheader">CAPABILITY</span>
          <span role="columnheader">WORKFLOW ROUTING</span>
          <span role="columnheader">LOCAL AND CLOUD PROVIDERS</span>
        </div>
        {CAPABILITIES.map((capability) => {
          const group = routing?.[capability.id];
          const choice = draft[capability.id];
          const joined = routing?.joins?.[capability.id];
          const joinedProof = joined ? connectionProof(routing, joined) : null;
          const directProvider = (CONNECTION_PROVIDERS[capability.id] || []).find((item) => item.id === choice.provider);
          const compatibility = choice.provider ? resolveConnectionJoin(capability.id, choice.engine, choice.provider) : null;
          return (
            <div className={styles.row} role="row" key={capability.id} data-hybrid-capability={capability.id}>
              <div className={styles.capability} role="rowheader">
                <strong>{capability.label}</strong>
                <span>{capability.detail}</span>
                <small data-active-route={group?.selected || "off"}>
                  ACTIVE {capability.label}: {group?.selected || "off"} · {group?.selected && group.options?.[group.selected]?.ready === true ? "VERIFIED FOR GENERATION" : "NOT VERIFIED / NOT SELECTED FOR GENERATION"}
                  {capability.id === "video" && (group?.selected === "off" || !group?.selected) ? " · A saved Join awaiting setup does not activate Timeline motion." : ""}
                </small>
                {joined ? <small data-join-state={joinedProof?.state || "NOT JOINED"}>
                  Joined: {joined.provider} · {joined.engine === "direct" ? "direct" : joined.engine === "comfy-local" ? "ComfyUI Local" : "ComfyUI Cloud"} · {joinedProof?.state}
                  {joinedProof?.reason ? ` · ${joinedProof.reason}` : ""}
                </small> : <small>No Join saved for this capability.</small>}
              </div>

              <div className={styles.resources} role="cell" data-workflow-routing="true">
                {capability.id === "text" ? <p>Direct Writing goes to the selected provider; ComfyUI is not required.</p> : (
                  <>
                    {CONNECTION_ENGINES.map((engine) => {
                      const active = choice.engine === engine.id;
                      const related = engine.id === "comfy-cloud"
                        ? group?.options?.["comfy-cloud"]
                        : Object.values(group?.options || {}).find((option) => option.locality === "local" && option.ready);
                      const state = engine.id === "comfy-cloud"
                        ? "SETUP NEEDED"
                        : related?.ready ? "AVAILABLE" : "SETUP NEEDED";
                      return (
                        <button key={engine.id} type="button" data-engine={engine.id}
                          data-selected={active ? "true" : "false"}
                          data-ready={state === "AVAILABLE" ? "true" : "false"}
                          data-skin-control-density="content-card"
                          aria-pressed={active} disabled={Boolean(working)}
                          onClick={() => choose(capability.id, { engine: engine.id as Engine })}>
                          <span><b>{engine.label}</b><small>{engine.locality === "cloud" ? "Remote ComfyUI workflow" : "Local workflow engine"}</small></span>
                          <em>{state}</em>
                          {engine.id === "comfy-cloud" ? <small>{group?.options?.["comfy-cloud"]?.error || "Executable cloud workflow setup required."}</small> : null}
                        </button>
                      );
                    })}
                    <button type="button" className={styles.directChoice} data-engine="direct"
                      data-selected={choice.engine === "direct" ? "true" : "false"} aria-pressed={choice.engine === "direct"}
                      disabled={Boolean(working)} onClick={() => choose(capability.id, { engine: "direct" })}>
                      Clear workflow — use a direct provider
                    </button>
                  </>
                )}
              </div>

              <div className={styles.resources} role="cell" data-provider-choices="true">
                {(CONNECTION_PROVIDERS[capability.id] || []).map((provider) => {
                  const matched = resolveConnectionJoin(capability.id, choice.engine, provider.id);
                  const fallbackRoute = Object.values(provider.routes)[0];
                  const route = matched.capable ? matched.route : fallbackRoute;
                  const option = route ? group?.options?.[route] : undefined;
                  const status = matched.capable
                    ? connectionProof(routing, { capability: capability.id, engine: choice.engine, provider: provider.id, route })
                    : { ready: false, state: "NOT CAPABLE", reason: matched.reason };
                  const selected = choice.provider === provider.id;
                  const saved = joined?.provider === provider.id && joined?.engine === choice.engine;
                  return (
                    <button type="button" key={provider.id} data-provider={provider.id}
                      data-route={route || "unsupported"} data-locality={provider.locality}
                      data-ready={status.ready ? "true" : "false"} data-selected={selected ? "true" : "false"}
                      data-joined={saved ? "true" : "false"} aria-pressed={selected}
                      data-skin-control-density="content-card"
                      disabled={Boolean(working)} onClick={() => choose(capability.id, { provider: provider.id })}>
                      <span><b>{provider.label}</b><small>{provider.detail || `${provider.locality} capability`}</small></span>
                      <em>{matched.capable ? status.state : optionState(option) === "NOT CAPABLE" ? "NOT CAPABLE" : "SELECT WORKFLOW"}</em>
                      <small>{matched.capable && status.ready ? `Verified${option?.verifiedAt ? ` · ${new Date(option.verifiedAt).toLocaleString()}` : ""}` : option?.error || provider.detail || "Setup or capability verification required."}</small>
                    </button>
                  );
                })}
                <div className={styles.joinActions}>
                  <button type="button" data-join-capability={capability.id} disabled={Boolean(working) || !choice.provider}
                    onClick={() => void join(capability.id)}>{working === capability.id ? "JOINING…" : "JOIN"}</button>
                  <span>{compatibility ? compatibility.capable
                    ? `${directProvider?.label || choice.provider} + ${choice.engine === "direct" ? "direct route" : choice.engine === "comfy-local" ? "ComfyUI Local" : "ComfyUI Cloud"} · ${joined && choice.provider === joined.provider && choice.engine === joined.engine ? joinedProof?.state || "JOINED" : "READY TO JOIN"}`
                    : compatibility.reason : "Choose a provider or model."}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CapabilityDiagnosticsLog />
      <div className={styles.active} aria-live="polite">
        {CAPABILITIES.map(({ id, label }) => {
          const selected = routing?.[id]?.selected || "off";
          const joined = routing?.joins?.[id];
          const proof = joined ? connectionProof(routing, joined) : null;
          return <span key={id}><b>{label}</b>{joined ? `${joined.provider} · ${joined.engine} · ${proof?.state || "NOT JOINED"}` : `Active legacy route: ${selected}; no joined configuration yet`}</span>;
        })}
      </div>
      <p className={styles.notice} role="status">{notice}</p>
    </div>
  );
}
