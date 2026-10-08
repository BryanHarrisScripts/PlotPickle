"use client";

import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";

import { useCallback, useEffect, useMemo, useState } from "react";
import CapabilityDiagnosticsLog from "./capability-diagnostics-log";
import ComputeReadyMarker from "./compute-ready-marker";
import styles from "./hybrid-story-mode-panel.module.css";

type Capability = "text" | "image" | "video";
type Locality = "local" | "cloud";

type RoutingOption = {
  label?: string;
  inferenceLocation?: string;
  provider?: string;
  supported?: boolean;
  disabled?: boolean;
  configured?: boolean;
  ready?: boolean;
  model?: string;
  locality?: string;
  cost?: string;
  settingsTarget?: string;
  error?: string;
  verifiedAt?: string;
};

type RoutingGroup = {
  selected?: string;
  options?: Record<string, RoutingOption>;
};

type RoutingStatus = {
  ok?: boolean;
  text?: RoutingGroup;
  image?: RoutingGroup;
  video?: RoutingGroup;
  message?: string;
};

const CAPABILITIES: readonly { id: Capability; label: string; detail: string }[] = [
  { id: "text", label: "WRITING", detail: "Writing, planning, Sage and text Agents" },
  { id: "image", label: "IMAGES", detail: "Storyboards, reference frames and image work" },
  { id: "video", label: "VIDEO", detail: "Previs, animatic and motion work" },
] as const;

function routeLabel(route: string) {
  const labels: Record<string, string> = { comfyui: "ComfyUI", "ollama-comfyui": "Ollama + ComfyUI", "minimax-comfyui": "ComfyUI · MiniMax H3", "comfyui-native": "ComfyUI · Native inference", openai: "OpenAI", minimax: "MiniMax", gemini: "Gemini", ollama: "Ollama", local: "Local Runtime" };
  return labels[route] || route
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function optionsFor(group: RoutingGroup | undefined, locality: Locality) {
  return Object.entries(group?.options || {})
    .filter(([, option]) => option.locality === locality)
    .sort(([a], [b]) => a.localeCompare(b));
}

function selectedOption(group: RoutingGroup | undefined) {
  if (!group?.selected) return null;
  const option = group.options?.[group.selected];
  return option ? { route: group.selected, option } : null;
}

function stateLabel(option: RoutingOption, selected: boolean) {
  if (option.disabled) return "DISABLED";
  if (option.supported === false) return "UNSUPPORTED";
  if (selected && option.ready) return "ACTIVE";
  if (option.ready) return "READY";
  if (option.configured) return "CONFIGURED · TEST NEEDED";
  return "SETUP NEEDED";
}

export default function HybridStoryModePanel({ onChanged }: { readonly onChanged?: () => void }) {
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Loading Local and Cloud resources…");

  const refresh = useCallback(async () => {
    try {
      const routingResponse = await fetch("/api/ai-routing/status", { cache: "no-store" });
      const routingBody = await routingResponse.json() as RoutingStatus;
      if (!routingResponse.ok || routingBody.ok === false) throw new Error(routingBody.message || "Compute capability status is unavailable.");
      setRouting(routingBody);
      setNotice("Select a ready resource for each capability. Local and Cloud configure and verify; Hybrid controls where work runs.");
    } catch (error) {
      setRouting(null);
      setNotice(error instanceof Error ? error.message : "Hybrid compute status is unavailable.");
    }
  }, []);

  useEffect(() => {
    const handleRefresh = () => { void refresh(); };
    handleRefresh();
    window.addEventListener("plotpickle:setup-status-refresh", handleRefresh);
    window.addEventListener("plotpickle:connection-status-refresh", handleRefresh);
    return () => {
      window.removeEventListener("plotpickle:setup-status-refresh", handleRefresh);
      window.removeEventListener("plotpickle:connection-status-refresh", handleRefresh);
    };
  }, [refresh]);

  const mix = useMemo(() => CAPABILITIES.map(({ id }) => {
    const selected = selectedOption(routing?.[id]);
    return selected ? { capability: id, route: selected.route, locality: selected.option.locality, ready: selected.option.ready === true } : null;
  }), [routing]);

  const incompleteCapabilities = mix.flatMap((item, index) => item?.ready === true ? [] : [CAPABILITIES[index].label.toLowerCase()]);
  const hybridReady = mix.every((item) => item?.ready === true)
;

  const setupCoverage = useMemo(() => {
    function summarize(locality: Locality) {
      let configured = 0;
      let ready = 0;
      for (const capability of CAPABILITIES) {
        const options = optionsFor(routing?.[capability.id], locality).map(([, option]) => option);
        if (options.some((option) => option.configured || option.ready)) configured += 1;
        if (options.some((option) => option.ready)) ready += 1;
      }
      return { configured, ready, total: CAPABILITIES.length };
    }
    return { local: summarize("local"), cloud: summarize("cloud") };
  }, [routing]);

  async function selectRoute(capability: Capability, route: string, locality: Locality) {
    if (working) return;
    const option = routing?.[capability]?.options?.[route];
    if (!option?.ready) {
      setNotice(`${routeLabel(route)} is not ready. Complete its setup/testing before selecting it for ${capability}.`);
      return;
    }
    setWorking(`${capability}:${route}`);
    setNotice(`Selecting ${routeLabel(route)} for ${capability}…`);
    try {
      const response = await fetch("/api/ai-routing/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capability,
          route,
        }),
      });
      const body = await response.json() as RoutingStatus;
      if (!response.ok) throw new Error(body.message || "The route could not be selected.");
      setRouting(body);
      setNotice(`${routeLabel(route)} is now active for ${capability.toUpperCase()}.`);
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
      onChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The route could not be selected.");
      await refresh();
    } finally {
      setWorking("");
    }
  }

  return (
    <div className={styles.surface} data-hybrid-story-mode="capability-matrix">
      <section className={styles.summary}>
        <div>
          <p>HYBRID ROUTING</p>
          <h2>{hybridReady ? "HYBRID READY" : "BUILD YOUR HYBRID MIX"}</h2>
          <span>Assign each story capability to one ready Local or Cloud resource. Writing can stay Local while Images or Video use Cloud, or any other mix you choose.</span>
        </div>
        <strong data-ready={hybridReady ? "true" : "false"}>{hybridReady ? "READY" : "NOT READY"}</strong>
        {!hybridReady ? <p role="status">{incompleteCapabilities.length ? `The selected ${incompleteCapabilities.join(", ")} route needs setup or a successful test.` : "Select ready resources for the capabilities you want to use."}</p> : null}
      </section>

      <div className={styles.active} aria-label="Detected Local and Cloud compute setup">
        <span><b>LOCAL SETUP</b>{setupCoverage.local.ready}/{setupCoverage.local.total} capabilities ready · {setupCoverage.local.configured}/{setupCoverage.local.total} configured</span>
        <span><b>CLOUD SETUP</b>{setupCoverage.cloud.ready}/{setupCoverage.cloud.total} capabilities ready · {setupCoverage.cloud.configured}/{setupCoverage.cloud.total} configured</span>
      </div>

      <div className={styles.matrix} role="table" aria-label="Hybrid Story Mode Local and Cloud resource matrix">
        <div className={styles.header} role="row">
          <span role="columnheader">CAPABILITY</span>
          <span role="columnheader">LOCAL RESOURCES</span>
          <span role="columnheader">CLOUD RESOURCES</span>
        </div>

        {CAPABILITIES.map((capability) => {
          const group = routing?.[capability.id];
          const localOptions = optionsFor(group, "local");
          const cloudOptions = optionsFor(group, "cloud");
          return (
            <div className={styles.row} role="row" key={capability.id} data-hybrid-capability={capability.id}>
              <div className={styles.capability} role="rowheader">
                <strong>{capability.label}</strong>
                <span>{capability.detail}</span>
              </div>

              <div className={styles.resources} role="cell" data-locality="local">
                {localOptions.length ? localOptions.map(([route, option]) => {
                  const selected = group?.selected === route;
                  return (
                    <button
                      key={route}
                      type="button"
                      data-route={route}
                      data-locality="local"
                      data-skin-control-density="content-card"
                      data-selected={selected ? "true" : "false"}
                      data-ready={option.ready ? "true" : "false"}
                      disabled={Boolean(working)}
                      onClick={() => void selectRoute(capability.id, route, "local")}
                    >
                      <span><b>{option.label || routeLabel(route)}</b><small>{option.model || option.settingsTarget || "Local route"}</small></span>
                      <em><ComputeReadyMarker ready={option.ready === true} /> {stateLabel(option, selected)}</em>
                      <small>{option.cost ? `${option.cost} · ` : ""}{option.ready ? `Verified${option.verifiedAt ? ` · ${new Date(option.verifiedAt).toLocaleString()}` : ""}` : option.error || (option.configured ? "Configured in Local Settings; a successful capability test is still required." : "Configure this capability in Local Settings.")}</small>
                    </button>
                  );
                }) : <p>No Local route is registered for this capability.</p>}
              </div>

              <div className={styles.resources} role="cell" data-locality="cloud">
                {cloudOptions.length ? cloudOptions.map(([route, option]) => {
                  const selected = group?.selected === route;
                  return (
                    <button
                      key={route}
                      type="button"
                      data-route={route}
                      data-locality="cloud"
                      data-skin-control-density="content-card"
                      data-selected={selected ? "true" : "false"}
                      data-ready={option.ready ? "true" : "false"}
                      disabled={Boolean(working)}
                      onClick={() => void selectRoute(capability.id, route, "cloud")}
                    >
                      <span><b>{option.label || routeLabel(route)}</b><small>{option.model || option.settingsTarget || "Cloud route"}</small></span>
                      <em><ComputeReadyMarker ready={option.ready === true} /> {stateLabel(option, selected)}</em>
                      <small>{option.cost ? `${option.cost} · ` : ""}{option.ready ? `Verified${option.verifiedAt ? ` · ${new Date(option.verifiedAt).toLocaleString()}` : ""}` : option.error || (option.configured ? "Configured in Cloud Settings; a successful capability test is still required." : "Configure this capability in Cloud Settings.")}</small>
                    </button>
                  );
                }) : <p>No Cloud route is registered for this capability.</p>}
              </div>
            </div>
          );
        })}
      </div>

      <CapabilityDiagnosticsLog />
      <div className={styles.active} aria-live="polite">
        {CAPABILITIES.map(({ id, label }) => {
          const selected = selectedOption(routing?.[id]);
          return (
            <span key={id}>
              <b>{label}</b>
              {selected
                ? `${routeLabel(selected.route)} · ${String(selected.option.locality || "unknown").toUpperCase()} · ${selected.option.ready ? "READY" : "NOT READY"}`
                : "No route selected"}
            </span>
          );
        })}
      </div>

      <p className={styles.notice} role="status">{notice}</p>
    </div>
  );
}
