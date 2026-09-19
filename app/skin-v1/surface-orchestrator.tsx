"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import surfaceRegistry from "@/config/skin-v1-surface-registry.json";
import anatomyContract from "@/config/skin-v1-surface-anatomy-contract.json";
import compositionReference from "@/config/skin-v1-surface-composition-reference.json";
import standardDeclarations from "@/config/skin-v1-surface-declarations/standard-surfaces.json";
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
  runtimeRoute?: string;
  navigationPath?: Array<{ order: number; slug: string; label: string }>;
  formatProfile?: FormatProfile;
};

type ActiveSurface = RuntimeSurface & { root: HTMLElement };

const ORCHESTRATED_SURFACES = (surfaceRegistry.surfaces as RuntimeSurface[])
  .filter((surface) => surface.orchestrated && surface.runtimeSelector);

const SURFACE_BY_ID = new Map(ORCHESTRATED_SURFACES.map((surface) => [surface.id, surface]));
const PREPRODUCTION_SURFACES = new Set([
  "story-map",
  "storyboard",
  "visual-story",
  "scene-timeline",
  "previs",
  "write",
  "pageflow",
]);

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
  for (const surface of ORCHESTRATED_SURFACES) {
    for (const element of document.querySelectorAll(surface.runtimeSelector!)) {
      if (!visible(element)) continue;
      matches.push({ ...surface, root: element as HTMLElement });
    }
  }
  const pathname = window.location.pathname;
  const directRouteMatches = matches.filter((surface) => {
    if (!surface.runtimeRoute) return false;
    return new URL(surface.runtimeRoute, window.location.origin).pathname === pathname;
  });
  const candidates = directRouteMatches.length ? directRouteMatches : matches;
  candidates.sort((a, b) =>
    surfaceDepth(b) - surfaceDepth(a)
    || domDepth(b.root) - domDepth(a.root)
  );
  return candidates[0] ?? null;
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
  const declarations = standardDeclarations.surfaces as Record<string, { declarationSource?: string }>;
  root.dataset.skinV1Declaration = declarations[surface.id]?.declarationSource
    ?? (surface.capturePolicy === "standard" ? "missing" : "registry-migration-projection");
}

function syncSurfaces() {
  const active = findActiveSurface();
  for (const surface of ORCHESTRATED_SURFACES) {
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

type DelegatedReturn = Readonly<{
  control: HTMLElement;
  label: string;
}>;

function existingReturnControl(active: ActiveSurface | null) {
  if (!active) return null;
  const selectors = [
    ".pp-skin-v1-return",
    "[data-skin-v1-return]",
    "[data-preproduction-return]",
  ];
  for (const selector of selectors) {
    const control = active.root.querySelector<HTMLElement>(selector);
    if (control) return control;
  }
  return null;
}

function delegatedReturn(active: ActiveSurface | null): DelegatedReturn | null {
  const control = existingReturnControl(active);
  const text = control?.textContent?.trim() ?? "";
  const match = /^Back to\s+(.+)$/iu.exec(text);
  const label = match?.[1]?.trim() ?? "";
  if (!control || !label) return null;
  if (label.toLocaleLowerCase() === parentLabel(active).toLocaleLowerCase()) return null;
  return { control, label };
}

function activateExistingReturn(active: ActiveSurface | null) {
  const control = existingReturnControl(active);
  if (!control || control === document.activeElement) return false;
  control.click();
  return true;
}

export default function SkinV1SurfaceOrchestrator({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveSurface | null>(null);
  const [delegatedReturnLabel, setDelegatedReturnLabel] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = syncSurfaces();
        setDelegatedReturnLabel(delegatedReturn(next)?.label ?? null);
        setActive((current) => (
          current?.id === next?.id && current?.root === next?.root ? current : next
        ));
      });
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

  const registeredReturnLabel = useMemo(() => parentLabel(active), [active]);
  const returnLabel = delegatedReturnLabel ?? registeredReturnLabel;
  const profile = active?.formatProfile;
  const preproductionContext = useMemo(() => {
    if (!active || !PREPRODUCTION_SURFACES.has(active.id) || typeof window === "undefined") return null;
    const query = new URLSearchParams(window.location.search);
    const block = Number(query.get("block"));
    const mini = Number(query.get("mini"));
    const parts: string[] = [];
    if (Number.isInteger(block) && block >= 1 && block <= 24) parts.push(`Block ${String(block).padStart(2, "0")}`);
    if (Number.isInteger(mini) && mini >= 1 && mini <= 4) parts.push(`Mini-Block ${mini}`);
    return parts.length ? parts.join(" · ") : "Current project";
  }, [active]);

  function returnToParent() {
    if (!active) return;
    const delegated = delegatedReturn(active);
    if (delegated) {
      delegated.control.click();
      return;
    }
    if (activateExistingReturn(active)) return;
    if (window.location.pathname !== "/skin-v1") {
      window.location.assign("/skin-v1");
      return;
    }
    if (!active.parent || active.parent === "dashboard") {
      window.dispatchEvent(new CustomEvent("plotpickle:return-dashboard", {
        detail: { sourceSurface: active.id },
      }));
      return;
    }
    if (active.parent === "settings" || active.parent === "story-mode") {
      window.dispatchEvent(new CustomEvent("plotpickle:return-surface", {
        detail: { sourceSurface: active.id, parentSurface: active.parent },
      }));
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
      data-skin-v1-declarations={standardDeclarations.id}
    >
      <AfterglowRepresentativeFixture />
      {active && active.id !== "dashboard" ? (
        <>
          <header className="pp-skin-v1-orchestrator-header" data-skin-v1-region-role="global-header">
            <strong>PLOTPICKLE</strong>
            <span>{active.label}</span>
            <span>SKIN V1</span>
          </header>
          <div className="pp-skin-v1-orchestrator-actions" data-skin-v1-region-role="surface-action-row">
            <button
              type="button"
              className="pp-skin-v1-orchestrator-return"
              data-skin-v1-return-contract="single-owner"
              data-skin-v1-return-source={delegatedReturnLabel ? "content-delegated" : "registry-parent"}
              onClick={returnToParent}
            >
              Back to {returnLabel}
            </button>
          </div>
          {preproductionContext ? (
            <section className="pp-skin-v1-orchestrator-workspace-header" data-skin-v1-region-role="workspace-header">
              <span className="pp-skin-v1-orchestrator-eyebrow">PRE-PRODUCTION</span>
              <h1>{active.label}</h1>
              <p>{preproductionContext}</p>
            </section>
          ) : null}
        </>
      ) : null}

      <div className="pp-skin-v1-orchestrator-content">{children}</div>

      {active && active.id !== "dashboard" ? (
        <footer className="pp-skin-v1-orchestrator-footer" data-skin-v1-region-role="status-footer">
          <span>Surface: {active.label}</span>
          <span>Layout: {profile?.layout ?? "standard"}</span>
          <span>↑↓ Navigate · Enter Select · ? Help</span>
        </footer>
      ) : null}
    </div>
  );
}
