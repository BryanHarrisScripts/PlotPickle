"use client";

import { useEffect } from "react";
import "./skin-v1/preproduction-matrix-contract.css";
import "./skin-v1/preproduction-review-flow.css";
import "./skin-v1/previs-visual-coverage.css";
import "./skin-v1/library-writer-discovery.css";

const SKIN_STORAGE_KEY = "plotpickle.skin";
const SKIN_V1 = "skin-v1";
const SKIN_V2 = "skin-v2";
const LEGACY_SKIN = "legacy";
const MEDIA_STATUS_PATH = "/api/media-routing/status";
const COMFY_START_PATH = "/api/media-routing/comfyui/start";
const CANONICAL_SKIN_V1_ROUTES = new Set(["/write", "/storyboard", "/previs", "/pageflow"]);

type SkinTheme = typeof SKIN_V1 | typeof SKIN_V2;
type LocalMediaStatus = {
  imageRoute?: string;
  comfyui?: { reachable?: boolean };
};

function resolveSkinTheme(explicit: string | null, stored: string | null): SkinTheme {
  if (explicit === "v2" || explicit === SKIN_V2) return SKIN_V2;
  if (explicit === "v1" || explicit === SKIN_V1) return SKIN_V1;
  return stored === SKIN_V2 ? SKIN_V2 : SKIN_V1;
}

function syncSkinAliases(theme: SkinTheme) {
  const alias = theme === SKIN_V2 ? "BLACK AND WHITE" : "MATRIX";
  document.querySelectorAll<HTMLElement>("[data-skin-v1-standard-header=\"true\"]").forEach((header) => {
    const spans = header.querySelectorAll<HTMLSpanElement>("span");
    const target = spans.item(spans.length - 1);
    if (target && target.textContent !== alias) target.textContent = alias;
  });
}

function applySkin() {
  const url = new URL(window.location.href);
  const explicit = url.searchParams.get("skin");
  const stored = window.localStorage.getItem(SKIN_STORAGE_KEY);
  const skinV1Route = url.pathname === "/skin-v1"
    || url.pathname.startsWith("/skin-v1/")
    || CANONICAL_SKIN_V1_ROUTES.has(url.pathname);

  if (explicit === LEGACY_SKIN) {
    window.localStorage.setItem(SKIN_STORAGE_KEY, LEGACY_SKIN);
    delete document.documentElement.dataset.plotpickleSkin;
    delete document.documentElement.dataset.plotpickleSkinTheme;
    return;
  }

  if (skinV1Route || explicit === "v1" || explicit === SKIN_V1 || explicit === "v2" || explicit === SKIN_V2) {
    const theme = resolveSkinTheme(explicit, stored);
    window.localStorage.setItem(SKIN_STORAGE_KEY, theme);
    document.documentElement.dataset.plotpickleSkin = SKIN_V1;
    document.documentElement.dataset.plotpickleSkinTheme = theme;
    syncSkinAliases(theme);
    return;
  }

  if (url.pathname === "/") {
    if (stored === LEGACY_SKIN) {
      delete document.documentElement.dataset.plotpickleSkin;
      delete document.documentElement.dataset.plotpickleSkinTheme;
      return;
    }
    window.location.replace("/skin-v1");
    return;
  }

  delete document.documentElement.dataset.plotpickleSkin;
  delete document.documentElement.dataset.plotpickleSkinTheme;
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
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.dataset.plotpickleSkinTheme;
      if (theme === SKIN_V1 || theme === SKIN_V2) syncSkinAliases(theme);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", applySkin);
    window.addEventListener("plotpickle:skin-change", applySkin);
    return () => {
      controller.abort();
      observer.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener("popstate", applySkin);
      window.removeEventListener("plotpickle:skin-change", applySkin);
    };
  }, []);

  return null;
}
