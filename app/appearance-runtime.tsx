"use client";

import { useEffect } from "react";
import { defaultPlotPickleSettings, normalizePlotPickleSettings, type PlotPickleSettings } from "@/lib/ai/settings";

const SETTINGS_STORAGE_KEY = "plotpickle.settings.v1";

type AppearanceSnapshot = Pick<PlotPickleSettings, "appearance" | "accessibility">;

function readAppearance(): AppearanceSnapshot {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = stored
      ? normalizePlotPickleSettings(JSON.parse(stored))
      : structuredClone(defaultPlotPickleSettings);
    return { appearance: settings.appearance, accessibility: settings.accessibility };
  } catch {
    return {
      appearance: structuredClone(defaultPlotPickleSettings.appearance),
      accessibility: structuredClone(defaultPlotPickleSettings.accessibility),
    };
  }
}

function resolvedTheme(theme: PlotPickleSettings["appearance"]["theme"]) {
  if (theme === "light" || theme === "dark") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyAppearance() {
  const { appearance, accessibility } = readAppearance();
  const root = document.documentElement;
  root.dataset.plotpickleTheme = resolvedTheme(appearance.theme);
  root.dataset.plotpickleThemePreference = appearance.theme;
  root.dataset.plotpickleDensity = appearance.density;
  root.dataset.plotpickleTransparency = appearance.reduceTransparency ? "reduced" : "standard";
  root.dataset.plotpickleContrast = accessibility.highContrast ? "high" : "standard";
  root.dataset.plotpickleMotion = accessibility.reducedMotion ? "reduced" : "standard";
  root.dataset.plotpickleText = accessibility.largeText ? "large" : "standard";
}

export default function AppearanceRuntime() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyAppearance();
    const updateSystemTheme = () => {
      if (document.documentElement.dataset.plotpickleThemePreference === "system") applyAppearance();
    };
    applyAppearance();
    window.addEventListener("plotpickle:settings-changed", update);
    window.addEventListener("storage", update);
    media.addEventListener("change", updateSystemTheme);
    return () => {
      window.removeEventListener("plotpickle:settings-changed", update);
      window.removeEventListener("storage", update);
      media.removeEventListener("change", updateSystemTheme);
    };
  }, []);

  return null;
}
