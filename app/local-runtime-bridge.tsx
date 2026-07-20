"use client";

import { useEffect } from "react";

const STORAGE_KEY = "plotpickle.project.v1";
const DISK_BOOTSTRAP_KEY = "plotpickle.local.disk-bootstrap.v1";
const HEALTH_URL = "/__plotpickle/health";
const PROJECTS_URL = "/__plotpickle/projects";
const PROJECT_URL = "/__plotpickle/project";

function safeFileName(title: unknown): string {
  const value = typeof title === "string" ? title : "active";
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "active";
  return `${slug}.plotpickle.json`;
}

async function isLocalRuntime(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, { cache: "no-store" });
    if (!response.ok) return false;
    const payload = (await response.json()) as { localRuntime?: boolean };
    return payload.localRuntime === true;
  } catch {
    return false;
  }
}

async function restoreLatestDiskProject(): Promise<boolean> {
  if (window.sessionStorage.getItem(DISK_BOOTSTRAP_KEY) === "done") return false;

  const response = await fetch(PROJECTS_URL, { cache: "no-store" });
  if (!response.ok) return false;
  const payload = (await response.json()) as { projects?: { name: string }[] };
  const latest = payload.projects?.[0];

  window.sessionStorage.setItem(DISK_BOOTSTRAP_KEY, "done");
  if (!latest) return false;

  const projectResponse = await fetch(`${PROJECT_URL}?name=${encodeURIComponent(latest.name)}`, { cache: "no-store" });
  if (!projectResponse.ok) return false;
  const projectText = await projectResponse.text();
  JSON.parse(projectText);
  window.localStorage.setItem(STORAGE_KEY, projectText);
  window.location.reload();
  return true;
}

async function saveProject(projectText: string): Promise<void> {
  const project = JSON.parse(projectText) as { metadata?: { title?: unknown } };
  const name = safeFileName(project.metadata?.title);
  const response = await fetch(`${PROJECT_URL}?name=${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: projectText,
  });

  if (!response.ok) {
    throw new Error(`Local project save failed with status ${response.status}.`);
  }

  window.dispatchEvent(new CustomEvent("plotpickle:local-save", { detail: { ok: true, name } }));
}

export default function LocalRuntimeBridge() {
  useEffect(() => {
    let stopped = false;
    let lastSaved = "";
    let pending: ReturnType<typeof window.setTimeout> | undefined;
    let interval: ReturnType<typeof window.setInterval> | undefined;

    void (async () => {
      if (!(await isLocalRuntime()) || stopped) return;
      document.documentElement.dataset.plotpickleRuntime = "local";

      try {
        if (await restoreLatestDiskProject()) return;
      } catch (error) {
        console.warn("PlotPickle could not restore the latest local project.", error);
      }

      const checkForChanges = () => {
        const current = window.localStorage.getItem(STORAGE_KEY);
        if (!current || current === lastSaved) return;
        if (pending) window.clearTimeout(pending);
        pending = window.setTimeout(() => {
          void saveProject(current)
            .then(() => {
              lastSaved = current;
            })
            .catch((error) => {
              console.error("PlotPickle local autosave failed.", error);
              window.dispatchEvent(new CustomEvent("plotpickle:local-save", { detail: { ok: false } }));
            });
        }, 700);
      };

      checkForChanges();
      interval = window.setInterval(checkForChanges, 750);
    })();

    return () => {
      stopped = true;
      if (pending) window.clearTimeout(pending);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  return null;
}
