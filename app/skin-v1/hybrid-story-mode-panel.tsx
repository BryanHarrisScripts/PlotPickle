"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./hybrid-story-mode-panel.module.css";

type Capability = "text" | "image" | "video";
type Locality = "local" | "cloud";

type RoutingOption = {
  configured?: boolean;
  ready?: boolean;
  model?: string;
  locality?: string;
  cost?: string;
  settingsTarget?: string;
  error?: string;
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
  return route
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
  if (selected && option.ready) return "ACTIVE";
  if (option.ready) return "READY";
  if (option.configured) return "NOT READY";
  return "SETUP";
}

export default function HybridStoryModePanel({ onChanged }: { readonly onChanged?: () => void }) {
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Loading Local and Cloud resources…");
  const [paidAcknowledged, setPaidAcknowledged] = useState(false);
  const [videoSharingAcknowledged, setVideoSharingAcknowledged] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ai-routing/status", { cache: "no-store" });
      const body = await response.json() as RoutingStatus;
      if (!response.ok || body.ok === false) throw new Error(body.message || "AI routing status is unavailable.");
      setRouting(body);
      setNotice("Choose one active route per capability. A true Hybrid mix uses at least one Local route and at least one Cloud route.");
    } catch (error) {
      setRouting(null);
      setNotice(error instanceof Error ? error.message : "AI routing status is unavailable.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const mix = useMemo(() => CAPABILITIES.map(({ id }) => {
    const selected = selectedOption(routing?.[id]);
    return selected ? { capability: id, route: selected.route, locality: selected.option.locality, ready: selected.option.ready === true } : null;
  }), [routing]);

  const hybridReady = mix.every((item) => item?.ready === true)
    && mix.some((item) => item?.locality === "local")
    && mix.some((item) => item?.locality === "cloud");

  async function selectRoute(capability: Capability, route: string, locality: Locality) {
    if (working) return;
    const option = routing?.[capability]?.options?.[route];
    if (!option?.ready) {
      setNotice(`${routeLabel(route)} is not ready. Complete its setup/testing before selecting it for ${capability}.`);
      return;
    }
    if (locality === "cloud" && !paidAcknowledged) {
      setNotice("Confirm that cloud provider requests may incur charges before selecting a Cloud resource.");
      return;
    }
    if (capability === "video" && locality === "cloud" && !videoSharingAcknowledged) {
      setNotice("Confirm that cloud video prompts and selected reference media may leave this computer before selecting Cloud video.");
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
          paidAcknowledged: locality === "cloud",
          dataSharingAcknowledged: capability === "video" && locality === "cloud" ? videoSharingAcknowledged : false,
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
      </section>

      <div className={styles.consent}>
        <label>
          <input type="checkbox" checked={paidAcknowledged} onChange={(event) => setPaidAcknowledged(event.currentTarget.checked)} />
          <span>I understand selected Cloud providers may charge my configured API account.</span>
        </label>
        <label>
          <input type="checkbox" checked={videoSharingAcknowledged} onChange={(event) => setVideoSharingAcknowledged(event.currentTarget.checked)} />
          <span>I understand Cloud video may send prompts and selected reference media outside this computer.</span>
        </label>
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
                      data-selected={selected ? "true" : "false"}
                      data-ready={option.ready ? "true" : "false"}
                      disabled={Boolean(working)}
                      onClick={() => void selectRoute(capability.id, route, "local")}
                    >
                      <span><b>{routeLabel(route)}</b><small>{option.model || option.settingsTarget || "Local route"}</small></span>
                      <em>{stateLabel(option, selected)}</em>
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
                      data-selected={selected ? "true" : "false"}
                      data-ready={option.ready ? "true" : "false"}
                      disabled={Boolean(working)}
                      onClick={() => void selectRoute(capability.id, route, "cloud")}
                    >
                      <span><b>{routeLabel(route)}</b><small>{option.model || option.settingsTarget || "Cloud route"}</small></span>
                      <em>{stateLabel(option, selected)}</em>
                    </button>
                  );
                }) : <p>No Cloud route is registered for this capability.</p>}
              </div>
            </div>
          );
        })}
      </div>

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
