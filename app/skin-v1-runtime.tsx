"use client";

import { useEffect } from "react";

const SKIN_STORAGE_KEY = "plotpickle.skin";
const SKIN_V1 = "skin-v1";
const LEGACY_SKIN = "legacy";
const MEDIA_STATUS_PATH = "/api/media-routing/status";
const COMFY_START_PATH = "/api/media-routing/comfyui/start";

type LocalMediaStatus = {
  imageRoute?: string;
  comfyui?: { reachable?: boolean };
};

function applySkin() {
  const url = new URL(window.location.href);
  const explicit = url.searchParams.get("skin");
  const stored = window.localStorage.getItem(SKIN_STORAGE_KEY);
  const skinV1Route = url.pathname === "/skin-v1" || url.pathname.startsWith("/skin-v1/");

  if (explicit === LEGACY_SKIN) {
    window.localStorage.setItem(SKIN_STORAGE_KEY, LEGACY_SKIN);
    delete document.documentElement.dataset.plotpickleSkin;
    return;
  }

  if (skinV1Route || explicit === "v1" || explicit === SKIN_V1) {
    window.localStorage.setItem(SKIN_STORAGE_KEY, SKIN_V1);
    document.documentElement.dataset.plotpickleSkin = SKIN_V1;
    return;
  }

  if (url.pathname === "/") {
    if (stored === LEGACY_SKIN) {
      delete document.documentElement.dataset.plotpickleSkin;
      return;
    }
    window.localStorage.setItem(SKIN_STORAGE_KEY, SKIN_V1);
    window.location.replace("/skin-v1");
    return;
  }

  delete document.documentElement.dataset.plotpickleSkin;
}

async function bootstrapManagedLocalImages(signal: AbortSignal) {
  if (document.documentElement.dataset.plotpickleSkin !== SKIN_V1 || signal.aborted) return;
  try {
    const statusResponse = await fetch(MEDIA_STATUS_PATH, { cache: "no-store", signal });
    if (!statusResponse.ok || signal.aborted) return;
    const status = await statusResponse.json() as LocalMediaStatus;
    if (status.imageRoute !== "comfyui" || status.comfyui?.reachable || signal.aborted) return;

    await fetch(COMFY_START_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ approved: true, source: "skin-v1-local-image-default" }),
      signal,
    }).catch(() => null);
    if (!signal.aborted) window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
  } catch {
    // Local AI remains optional at runtime. Startup failures are surfaced in Local AI / Images,
    // never converted into a cloud fallback and never allowed to block PlotPickle itself.
  }
}

export default function SkinV1Runtime() {
  useEffect(() => {
    applySkin();
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void bootstrapManagedLocalImages(controller.signal); }, 900);
    window.addEventListener("popstate", applySkin);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("popstate", applySkin);
    };
  }, []);

  return null;
}
