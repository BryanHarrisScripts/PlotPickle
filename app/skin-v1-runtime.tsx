"use client";

import { useEffect } from "react";

const SKIN_STORAGE_KEY = "plotpickle.skin";
const SKIN_V1 = "skin-v1";
const LEGACY_SKIN = "legacy";

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

export default function SkinV1Runtime() {
  useEffect(() => {
    applySkin();
    window.addEventListener("popstate", applySkin);
    return () => window.removeEventListener("popstate", applySkin);
  }, []);

  return null;
}
