"use client";

import { useEffect } from "react";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/project";

const STORAGE_KEY = "plotpickle.project.v1";
const API_ROOT = "/api/render/lazy-frames";

type LazyStatus = {
  installed?: boolean;
  installState?: string;
  renderState?: string;
  message?: string;
  version?: string;
  preview?: { url?: string };
};

function loadProject(): PlotPickleProject {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return createBlankProject();
    return normalizePlotPickleProject(JSON.parse(stored)) ?? createBlankProject();
  } catch {
    return createBlankProject();
  }
}

function addText(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, text: string, className?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

async function api(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`${API_ROOT}/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok || value.ok === false) throw new Error(String(value.message || "Lazy Frames action failed."));
  return value;
}

function buildAnimaticPanel(anchor: Element) {
  if (document.querySelector("[data-build-animatic-studio]")) return;
  const project = loadProject();
  const panel = document.createElement("section");
  panel.dataset.buildAnimaticStudio = "true";
  panel.className = "build-animatic-studio";

  const heading = document.createElement("div");
  heading.className = "build-animatic-heading";
  addText(heading, "span", "ANIMATIC · LOCAL RENDER", "build-animatic-eyebrow");
  addText(heading, "h2", "Turn approved sequences into a motion preview");
  addText(heading, "p", "Lazy Frames creates a derived animatic from approved BUILD material. Your PPF remains the story source of truth; preview and MP4 files are disposable render outputs.");
  panel.appendChild(heading);

  const statusCard = document.createElement("div");
  statusCard.className = "build-animatic-status-card";
  const statusTitle = addText(statusCard, "strong", "Checking Lazy Frames…");
  const statusCopy = addText(statusCard, "span", "Local readiness is being inspected.");
  panel.appendChild(statusCard);

  const actions = document.createElement("div");
  actions.className = "build-animatic-actions";
  panel.appendChild(actions);

  const detail = addText(panel, "p", "Prepare → Validate → Preview → Render MP4", "build-animatic-detail");
  let currentStatus: LazyStatus = {};
  let projectPrepared = false;
  let projectValidated = false;
  let busy = false;

  function setMessage(message: string, isError = false) {
    detail.textContent = message;
    detail.dataset.state = isError ? "error" : "info";
  }

  function button(label: string, action: () => Promise<void>, className = "") {
    const control = document.createElement("button");
    control.type = "button";
    control.textContent = label;
    if (className) control.className = className;
    control.addEventListener("click", () => {
      if (busy) return;
      busy = true;
      control.disabled = true;
      void action()
        .catch((error) => setMessage(error instanceof Error ? error.message : "Lazy Frames action failed.", true))
        .finally(() => {
          busy = false;
          renderActions();
        });
    });
    actions.appendChild(control);
    return control;
  }

  async function refreshStatus() {
    currentStatus = await api("status") as LazyStatus;
    const installed = currentStatus.installed === true;
    statusTitle.textContent = installed ? `Lazy Frames ${currentStatus.version || ""} · READY TO CHECK` : "Lazy Frames · OPTIONAL LOCAL TOOL";
    statusCopy.textContent = currentStatus.message || (installed ? "Installed locally." : "Not installed yet.");
    statusCard.dataset.ready = installed ? "true" : "false";
    renderActions();
  }

  function renderActions() {
    actions.replaceChildren();
    if (!currentStatus.installed) {
      button(`Install Lazy Frames ${currentStatus.version || "0.6.3"}`, async () => {
        setMessage("Installing the reviewed local Lazy Frames package in the background…");
        await api("install", { approved: true });
        window.setTimeout(() => void refreshStatus(), 1200);
      }, "primary");
      return;
    }

    button("Prepare animatic", async () => {
      const result = await api("prepare", { project });
      projectPrepared = true;
      projectValidated = false;
      setMessage(`${String(result.sceneCount || 0)} approved sequence(s) prepared. Canon was not changed.`);
    });

    button("Validate", async () => {
      if (!projectPrepared) throw new Error("Prepare the animatic first.");
      setMessage("Running Lazy Frames snapshot and determinism gates…");
      await api("check", { projectId: project.id });
      projectValidated = true;
      setMessage("Validation passed. Open Preview and review the motion before rendering.");
    });

    button("Open preview", async () => {
      if (!projectValidated) throw new Error("Validate the animatic before opening Preview.");
      const result = await api("preview", { projectId: project.id });
      const url = String(result.url || currentStatus.preview?.url || "");
      if (!url) throw new Error("Lazy Frames did not return a local preview URL.");
      window.open(url, "_blank", "noopener,noreferrer");
      setMessage("Preview opened locally. Review it, then choose Render MP4 when you approve the result.");
    });

    button("Render MP4", async () => {
      if (!projectValidated) throw new Error("Validate and review the animatic before rendering.");
      const approved = window.confirm("Render this validated animatic to MP4 now? This does not change PPF/canon.");
      if (!approved) {
        setMessage("Render cancelled. The validated preview remains available.");
        return;
      }
      const result = await api("render", { projectId: project.id, approved: true });
      setMessage(String(result.message || "Lazy Frames render started in the background."));
      window.setTimeout(() => void refreshStatus(), 1500);
    }, "primary");
  }

  anchor.insertAdjacentElement("afterend", panel);
  void refreshStatus().catch((error) => {
    statusTitle.textContent = "Lazy Frames · STATUS UNAVAILABLE";
    statusCopy.textContent = error instanceof Error ? error.message : "Local render status could not be read.";
    setMessage("PlotPickle remains usable without Lazy Frames.", true);
  });
}

export default function BuildAnimaticStudio() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("workspace") !== "build") return;
    const mount = () => {
      const anchor = document.querySelector("[data-build-assembly-studio]")
        ?? document.querySelector("[data-build-studio-context]");
      if (anchor) buildAnimaticPanel(anchor);
      return Boolean(anchor);
    };
    if (mount()) return;
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => observer.disconnect(), 5000);
    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);
  return null;
}
