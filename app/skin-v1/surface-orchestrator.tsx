"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import surfaceRegistry from "@/config/skin-v1-surface-registry.json";
import anatomyContract from "@/config/skin-v1-surface-anatomy-contract.json";
import compositionReference from "@/config/skin-v1-surface-composition-reference.json";
import AfterglowRepresentativeFixture from "./afterglow-representative-fixture";

type FormatProfile = {
  layout: string;
  shell: string;
  frame: string;
  selectedState: string;
  typography: string;
};

type RuntimeSurface = {
  id: string;
  label: string;
  parent: string | null;
  surfaceClass: string;
  capturePolicy: string;
  orchestrated?: boolean;
  runtimeSelector?: string;
  runtimeReadySelector?: string;
  navigationPath?: Array<{ order: number; slug: string; label: string }>;
  formatProfile?: FormatProfile;
};

type ActiveSurface = RuntimeSurface & { root: HTMLElement };

const STANDARD_SURFACES = (surfaceRegistry.surfaces as RuntimeSurface[])
  .filter((surface) => surface.capturePolicy === "standard" && surface.orchestrated && surface.runtimeSelector);

const SURFACE_BY_ID = new Map(STANDARD_SURFACES.map((surface) => [surface.id, surface]));

function visible(element: Element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && style.opacity !== "0"
    && element.getClientRects().length > 0;
}

function domDepth(element: Element) {
  let depth = 0;
  let node: Element | null = element;
  while (node?.parentElement) {
    depth += 1;
    node = node.parentElement;
  }
  return depth;
}

function surfaceDepth(surface: RuntimeSurface) {
  return surface.navigationPath?.length ?? 0;
}

function findActiveSurface(): ActiveSurface | null {
  const matches: ActiveSurface[] = [];
  for (const surface of STANDARD_SURFACES) {
    for (const element of document.querySelectorAll(surface.runtimeSelector!)) {
      if (!visible(element)) continue;
      matches.push({ ...surface, root: element as HTMLElement });
    }
  }
  matches.sort((a, b) =>
    surfaceDepth(b) - surfaceDepth(a)
    || domDepth(b.root) - domDepth(a.root)
  );
  return matches[0] ?? null;
}

function markSurface(surface: RuntimeSurface, root: HTMLElement, active: boolean) {
  const profile = surface.formatProfile;
  root.dataset.skinV1Orchestrated = "true";
  root.dataset.skinV1SurfaceId = surface.id;
  root.dataset.skinV1SurfaceClass = surface.surfaceClass;
  root.dataset.skinV1OrchestratorActive = active ? "true" : "false";
  root.dataset.skinV1Layout = profile?.layout ?? "unspecified";
  root.dataset.skinV1Shell = profile?.shell ?? "unspecified";
  root.dataset.skinV1Frame = profile?.frame ?? "unspecified";
  root.dataset.skinV1SelectedState = profile?.selectedState ?? "unspecified";
  root.dataset.skinV1Typography = profile?.typography ?? "unspecified";
  root.dataset.skinV1Composition = compositionReference.id;
  root.dataset.skinV1Anatomy = anatomyContract.id;
}

function syncSurfaces() {
  const active = findActiveSurface();
  for (const surface of STANDARD_SURFACES) {
    document.querySelectorAll(surface.runtimeSelector!).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      markSurface(surface, element, active?.root === element && active.id === surface.id);
    });
  }
  return active;
}

function parentLabel(surface: RuntimeSurface | null) {
  if (!surface?.parent) return "Dashboard";
  return SURFACE_BY_ID.get(surface.parent)?.label ?? "Dashboard";
}

function activateExistingReturn(active: ActiveSurface | null) {
  if (!active) return false;
  const selectors = [
    ".pp-skin-v1-return",
    "[data-skin-v1-return]",
    "[data-preproduction-return]",
  ];
  for (const selector of selectors) {
    const control = active.root.querySelector<HTMLElement>(selector);
    if (control && control !== document.activeElement) {
      control.click();
      return true;
    }
  }
  return false;
}

export default function SkinV1SurfaceOrchestrator({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveSurface | null>(null);

  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setActive(syncSurfaces()));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "hidden",
        "aria-hidden",
        "data-dashboard-review-surface",
        "data-library-destination",
        "data-visual-story-view",
        "data-story-mode-view",
      ],
    });
    window.addEventListener("popstate", refresh);
    window.addEventListener("plotpickle:surface-change", refresh as EventListener);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", refresh);
      window.removeEventListener("plotpickle:surface-change", refresh as EventListener);
    };
  }, []);

  const returnLabel = useMemo(() => parentLabel(active), [active]);
  const profile = active?.formatProfile;

  function returnToParent() {
    if (activateExistingReturn(active)) return;
    if (window.location.pathname !== "/skin-v1") {
      window.location.assign("/skin-v1");
      return;
    }
    if (window.history.length > 1) window.history.back();
  }

  return (
    <div
      className="pp-skin-v1-orchestrator"
      data-skin-v1-orchestrator="runtime"
      data-skin-v1-orchestrator-active={active ? "true" : "false"}
      data-skin-v1-active-surface={active?.id ?? "pending"}
      data-skin-v1-active-layout={profile?.layout ?? "pending"}
      data-skin-v1-composition-contract={compositionReference.id}
      data-skin-v1-anatomy-contract={anatomyContract.id}
    >
      <AfterglowRepresentativeFixture />
      {active ? (
        <>
          <header className="pp-skin-v1-orchestrator-header" data-skin-v1-region-role="global-header">
            <strong>PLOTPICKLE</strong>
            <span>{active.label}</span>
            <span>SKIN V1</span>
          </header>
          {active.id !== "dashboard" ? (
            <div className="pp-skin-v1-orchestrator-actions" data-skin-v1-region-role="surface-action-row">
              <button type="button" className="pp-skin-v1-orchestrator-return" onClick={returnToParent}>
                Back to {returnLabel}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="pp-skin-v1-orchestrator-content">{children}</div>

      {active ? (
        <footer className="pp-skin-v1-orchestrator-footer" data-skin-v1-region-role="status-footer">
          <span>Surface: {active.label}</span>
          <span>Layout: {profile?.layout ?? "standard"}</span>
          <span>↑↓ Navigate · Enter Select · ? Help</span>
        </footer>
      ) : null}
    </div>
  );
}
