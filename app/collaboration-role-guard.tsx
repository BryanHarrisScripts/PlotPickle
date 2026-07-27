"use client";
import { useEffect } from "react";
import type { CollaborationSession } from "@/lib/collaboration-invitations";

function feedbackContext() {
  const query = new URLSearchParams(window.location.search);
  return query.get("tab") === "feedback" || query.get("section")?.includes("review") || query.get("section") === "table-read";
}
function collaborationUi(target: EventTarget | null) { return target instanceof Element && Boolean(target.closest("[data-plotpickle-collaboration-ui]")); }
function editable(target: EventTarget | null) { return target instanceof Element && Boolean(target.closest("input, textarea, select, button, [contenteditable='true'], [role='button']")); }

export default function CollaborationRoleGuard() {
  useEffect(() => {
    let active: CollaborationSession | null = null;
    const update = (event: Event) => {
      active = (event as CustomEvent<CollaborationSession | null>).detail || null;
      document.body.dataset.plotpickleCollaborationRole = active?.role || "project-lead";
      document.body.dataset.plotpickleReadOnly = active?.readOnlyReview ? "true" : "false";
    };
    const block = (event: Event) => {
      if (!active?.readOnlyReview || collaborationUi(event.target) || feedbackContext()) return;
      if (event.type === "click" && !editable(event.target)) return;
      event.preventDefault(); event.stopPropagation();
      window.dispatchEvent(new CustomEvent("plotpickle-reviewer-blocked"));
    };
    window.addEventListener("plotpickle-collaboration-session", update);
    for (const name of ["beforeinput", "change", "submit", "drop", "paste", "cut", "click"]) document.addEventListener(name, block, true);
    return () => { window.removeEventListener("plotpickle-collaboration-session", update); for (const name of ["beforeinput", "change", "submit", "drop", "paste", "cut", "click"]) document.removeEventListener(name, block, true); };
  }, []);
  return null;
}
