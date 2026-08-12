"use client";

import { useEffect } from "react";

const FOUNDATION_APPLY_SELECTOR = '[aria-label="Apply what you have learned in Foundations"]';

function prepareApplyAction() {
  const target = document.querySelector<HTMLElement>(FOUNDATION_APPLY_SELECTOR);
  if (!target) return;
  target.dataset.planHandoff = "true";
  target.setAttribute("role", "button");
  target.setAttribute("tabindex", "0");
  target.setAttribute("title", "Open PLAN and build your Foundations Brief");
  const status = target.querySelector<HTMLElement>("small");
  if (status) status.textContent = "Open PLAN";
}

function openPlan() {
  window.location.assign("/?workspace=plan&section=foundations");
}

export default function LearnPlanHandoff() {
  useEffect(() => {
    prepareApplyAction();
    const observer = new MutationObserver(prepareApplyAction);
    observer.observe(document.body, { childList: true, subtree: true });

    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest(FOUNDATION_APPLY_SELECTOR) : null;
      if (!element) return;
      event.preventDefault();
      openPlan();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const element = event.target instanceof Element ? event.target.closest(FOUNDATION_APPLY_SELECTOR) : null;
      if (!element) return;
      event.preventDefault();
      openPlan();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
