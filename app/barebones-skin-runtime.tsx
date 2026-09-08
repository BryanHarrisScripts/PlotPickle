"use client";

import { useEffect } from "react";

const SKIN_STORAGE_KEY = "plotpickle.skin";
const BAREBONES_SKIN = "barebones";

function applySkin() {
  const url = new URL(window.location.href);
  const explicit = url.searchParams.get("skin");
  const barebonesRoute = url.pathname === "/v2" || url.pathname.startsWith("/v2/");

  if (explicit === "legacy") {
    window.localStorage.removeItem(SKIN_STORAGE_KEY);
    delete document.documentElement.dataset.plotpickleSkin;
    return;
  }

  if (barebonesRoute || explicit === "v2" || explicit === BAREBONES_SKIN) {
    window.localStorage.setItem(SKIN_STORAGE_KEY, BAREBONES_SKIN);
    document.documentElement.dataset.plotpickleSkin = BAREBONES_SKIN;
    return;
  }

  if (url.pathname === "/" && window.localStorage.getItem(SKIN_STORAGE_KEY) === BAREBONES_SKIN) {
    window.location.replace("/v2");
    return;
  }

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
