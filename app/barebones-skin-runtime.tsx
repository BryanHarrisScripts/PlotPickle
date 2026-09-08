"use client";

import { useEffect } from "react";

const SKIN_STORAGE_KEY = "plotpickle.skin";
const BAREBONES_SKIN = "barebones";

function requestedSkin() {
  const url = new URL(window.location.href);
  const explicit = url.searchParams.get("skin");
  if (explicit === "legacy") return "legacy";
  if (explicit === "v2" || explicit === BAREBONES_SKIN || url.pathname === "/v2" || url.pathname.startsWith("/v2/")) {
    return BAREBONES_SKIN;
  }
  return window.localStorage.getItem(SKIN_STORAGE_KEY) === BAREBONES_SKIN ? BAREBONES_SKIN : "legacy";
}

function applySkin() {
  const skin = requestedSkin();
  if (skin === BAREBONES_SKIN) {
    window.localStorage.setItem(SKIN_STORAGE_KEY, BAREBONES_SKIN);
    document.documentElement.dataset.plotpickleSkin = BAREBONES_SKIN;
    return;
  }
  window.localStorage.removeItem(SKIN_STORAGE_KEY);
  delete document.documentElement.dataset.plotpickleSkin;
}

export default function BarebonesSkinRuntime() {
  useEffect(() => {
    applySkin();
    window.addEventListener("popstate", applySkin);
    return () => window.removeEventListener("popstate", applySkin);
  }, []);

  return null;
}
