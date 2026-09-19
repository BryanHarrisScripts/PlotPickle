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

type ImageJobClass = "image-fast-draft" | "image-precision-edit";
type JobPreference = "auto" | "local-first" | "cloud-first";
type JobRoutingStatus = {
  ok?: boolean;
  jobs?: Partial<Record<ImageJobClass, JobPreference>>;
  message?: string;
};

const CAPABILITIES: readonly { id: Capability; label: string; detail: string }[] = [
  { id: "text", label: "WRITING", detail: "Writing, planning, Sage and text Agents" },
  { id: "image", label: "IMAGES", detail: "Storyboards, reference frames and image work" },
  { id: "video", label: "VIDEO", detail: "Previs, animatic and motion work" },
] as const;

const IMAGE_JOBS: readonly { id: ImageJobClass; label: string; detail: string }[] = [
  { id: "image-fast-draft", label: "IMAGES — FAST / DRAFT", detail: "Exploration, thumbnails and ordinary low/medium-quality image work" },
  { id: "image-precision-edit", label: "IMAGES — PRECISION / EDIT", detail: "High-quality, reference, identity and continuity-sensitive image work" },
] as const;

const JOB_PREFERENCES: readonly { id: JobPreference; label: string }[] = [
  { id: "auto", label: "AUTO" },
  { id: "local-first", label: "LOCAL FIRST" },
  { id: "cloud-first", label: "CLOUD FIRST" },
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
  const [jobRouting, setJobRouting] = useState<Record<ImageJobClass, JobPreference>>({
    "image-fast-draft": "auto",
    "image-precision-edit": "auto",
  });
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Loading Local and Cloud resources…");
  const [paidAcknowledged, setPaidAcknowledged] = useState(false);
  const [videoSharingAcknowledged, setVideoSharingAcknowledged] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [routingResponse, jobResponse] = await Promise.all([
        fetch("/api/ai-routing/status", { cache: "no-store" }),
        fetch("/api/story-mode/job-routing", { cache: "no-store" }),
      ]);
      const routingBody = await routingResponse.json() as RoutingStatus;
      const jobBody = await jobResponse.json() as JobRoutingStatus;
      if (!routingResponse.ok || routingBody.ok === false) throw new Error(routingBody.message || "AI routing status is unavailable.");
      if (!jobResponse.ok || jobBody.ok === false || !jobBody.jobs) throw new Error(jobBody.message || "Story Mode Job Routing is unavailable.");
      setRouting(routingBody);
      setJobRouting({
        "image-fast-draft": jobBody.jobs["image-fast-draft"] || "auto",
        "image-precision-edit": jobBody.jobs["image-precision-edit"] || "auto",
      });
      setNotice("Choose ready Local and Cloud resources, then set per-job routing preferences. AUTO preserves the currently selected ready route.");
    } catch (error) {
      setRouting(null);
      setNotice(error instanceof Error ? error.message : "Story Mode routing status is unavailable.");
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

  async function updateJobPreference(jobClass: ImageJobClass, preference: JobPreference) {
    if (working) return;
    setWorking(`job:${jobClass}`);
    setNotice(`Updating ${IMAGE_JOBS.find((job) => job.id === jobClass)?.label || jobClass} routing…`);
    try {
      const response = await fetch("/api/story-mode/job-routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobClass, preference }),
      });
      const body = await response.json() as JobRoutingStatus;
      if (!response.ok || body.ok === false || !body.jobs) throw new Error(body.message || "Job Routing preference could not be saved.");
      setJobRouting({
        "image-fast-draft": body.jobs["image-fast-draft"] || "auto",
        "image-precision-edit": body.jobs["image-precision-edit"] || "auto",
      });
      setNotice(`${IMAGE_JOBS.find((job) => job.id === jobClass)?.label || jobClass} now uses ${preference.toUpperCase().replace("-", " ")}. The live image request resolves only across tested routes allowed by Story Mode.`);
      onChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Job Routing preference could not be saved.");
    } finally {
      setWorking("");
    }
  }

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

      <section className={styles.jobRouting} data-story-mode-job-routing="image" aria-labelledby="hybrid-job-routing-title">
        <header>
          <p>JOB ROUTING</p>
          <h3 id="hybrid-job-routing-title">Route each real image workload independently</h3>
          <span>Preferences never change canon or provider setup. AUTO keeps the currently selected tested route; LOCAL FIRST and CLOUD FIRST resolve per request without changing the global provider selection.</span>
        </header>
        {IMAGE_JOBS.map((job) => (
          <div className={styles.jobRow} key={job.id} data-job-class={job.id}>
            <div>
              <strong>{job.label}</strong>
              <span>{job.detail}</span>
            </div>
            <div className={styles.jobChoices} role="group" aria-label={`${job.label} routing preference`}>
              {JOB_PREFERENCES.map((preference) => (
                <button
                  key={preference.id}
                  type="button"
                  data-job-preference={preference.id}
                  data-selected={jobRouting[job.id] === preference.id ? "true" : "false"}
                  disabled={Boolean(working)}
                  onClick={() => void updateJobPreference(job.id, preference.id)}
                >
                  {preference.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

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
