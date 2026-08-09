"use client";

import { useEffect } from "react";
import type { ProductNavigationId } from "@/lib/product-direction";

const COLLABORATION_WORKSPACES: Record<string, ProductNavigationId> = {
  "/": "dashboard",
  "/dashboard": "dashboard",
  "/write": "script",
  "/read": "script",
  "/build": "build",
  "/feedback": "feedback",
  "/read-learn": "learn",
  "/storyboard": "visuals",
  "/production": "reports",
  "/table-read": "feedback",
  "/characters": "planner",
  "/reports": "reports",
  "/collab": "collab",
  "/settings": "settings",
};

export const COLLABORATION_WORKSPACE_EVENT = "plotpickle:navigate-workspace";

export default function CollaborationWorkspaceRouter() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === "/" && url.searchParams.has("workspace")) return;
      const workspace = COLLABORATION_WORKSPACES[url.pathname];
      if (!workspace) return;
      event.preventDefault();
      window.dispatchEvent(new CustomEvent<ProductNavigationId>(COLLABORATION_WORKSPACE_EVENT, { detail: workspace }));
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
