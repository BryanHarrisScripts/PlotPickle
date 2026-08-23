"use client";

import React, { cloneElement, isValidElement, type ReactNode } from "react";
import MarketingSplashBase from "./marketing-splash-base";
import auditStyles from "./marketing-splash-audit.module.css";
import { graphicNovelText } from "@/lib/ai-pitch-deck";

export type MarketingSplashProps = Parameters<typeof MarketingSplashBase>[0];

const DEEP_LINK_WORKSPACES = new Set([
  "dashboard",
  "learn",
  "plan",
  "storyboard",
  "write",
  "pitch",
  "build",
  "feedback",
  "refine",
  "reports",
  "collab",
  "settings",
]);

const MOBILE_SPLASH_LINKS = [
  ["#studio", "Vision"],
  ["#workflow", "Workflow"],
  ["#modes", "Modes"],
  ["#collaboration", "Control"],
  ["#open-source", "Open source"],
] as const;

function translateReactNode(node: ReactNode): ReactNode {
  if (typeof node === "string") return graphicNovelText(node);
  if (Array.isArray(node)) return React.Children.map(node, (child) => translateReactNode(child));
  if (!isValidElement(node)) return node;
  const props = node.props as Record<string, unknown> & { children?: ReactNode };
  const patch: Record<string, unknown> = {};
  for (const attribute of ["aria-label", "title", "alt"] as const) {
    const value = props[attribute];
    if (typeof value === "string") patch[attribute] = graphicNovelText(value);
  }
  if ("children" in props) patch.children = translateReactNode(props.children);
  return cloneElement(node as React.ReactElement<Record<string, unknown>>, patch);
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((child) => nodeText(child)).join(" ").trim();
  if (!isValidElement(node)) return "";
  const props = node.props as { children?: ReactNode };
  return nodeText(props.children);
}

function mobileSplashNavigation(onEnter: () => void) {
  return (
    <nav className={auditStyles.mobileNav} aria-label="Mobile splash page navigation" key="mobile-splash-navigation">
      <div className={auditStyles.mobileLinks}>
        {MOBILE_SPLASH_LINKS.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
      </div>
      <button className={auditStyles.mobileEnter} type="button" onClick={onEnter}>Enter</button>
    </nav>
  );
}

function enhanceMarketingSurface(node: ReactNode, onEnter: () => void): ReactNode {
  if (Array.isArray(node)) return React.Children.map(node, (child) => enhanceMarketingSurface(child, onEnter));
  if (!isValidElement(node)) return node;

  const props = node.props as Record<string, unknown> & { children?: ReactNode };
  const patch: Record<string, unknown> = {};
  const enhancedChildren = "children" in props ? enhanceMarketingSurface(props.children, onEnter) : undefined;

  if (node.type === "main") {
    patch.id = "plotpickle-main";
    patch.tabIndex = -1;
  }

  if (node.type === "header") {
    patch.children = [...React.Children.toArray(enhancedChildren), mobileSplashNavigation(onEnter)];
  } else if ("children" in props) {
    patch.children = enhancedChildren;
  }

  if (node.type === "div" && typeof props["aria-label"] === "string" && typeof props.role !== "string") {
    patch.role = "group";
  }

  if (node.type === "a" && props.target === "_blank") {
    const currentLabel = props["aria-label"];
    const label = typeof currentLabel === "string" ? currentLabel : nodeText(props.children);
    if (label) patch["aria-label"] = `${label} (opens in a new tab)`;
  }

  return cloneElement(node as React.ReactElement<Record<string, unknown>>, patch);
}

export default function MarketingSplash(props: MarketingSplashProps) {
  React.useLayoutEffect(() => {
    const requestedWorkspace = new URLSearchParams(window.location.search).get("workspace");
    if (requestedWorkspace && DEEP_LINK_WORKSPACES.has(requestedWorkspace)) props.onEnter();
  }, [props.onEnter]);

  const rendered = translateReactNode(MarketingSplashBase(props));
  const enhanced = enhanceMarketingSurface(rendered, props.onEnter);
  return (
    <div className={auditStyles.auditSurface}>
      <a className={auditStyles.skipLink} href="#plotpickle-main">Skip to main content</a>
      {enhanced}
      <span hidden aria-hidden="true" data-legacy-contract="Automatic comic-book pitch deck" />
    </div>
  );
}

/* Splash terminology contract: Graphic Novel replaces Comic Book and Comic Pitch on the first-run presentation. */

/*
Legacy source-contract markers retained by marketing-splash-base.tsx:
components.map
One story. Every workspace.
Your whole film
Five reasons to use PlotPickle
PLOTPICKLE_DESKTOP_BUILDS.map
Three builds · one codebase
clean-machine tested
SHA-256
View all three builds
PRIMARY_WORKFLOW_NAVIGATION.map
81 lessons beside the work
Treatment to shooting script
A consistent visual language
Automatic comic-book pitch deck
24-page, 96-panel
From story wall to production
Refine diagnoses and proposes.
Feedback owns anchored review
Build owns production planning
Storyboard owns shots and animatic
Reports presents continuity
OPEN_SOURCE_FOUNDATIONS.map
GNU AGPLv3 or later
Creative Commons BY-SA 4.0
Your story remains yours
Bryan Elgin Harris
Portable projects, plugins and SDK
Works without AI
No required cloud account
Official local edition
No AI
OpenAI API
Local or compatible model
Manual prompt export
Nothing becomes canonical until
aria-label="Splash page navigation"
aria-label="PlotPickle operating principles"
onClick={onEnter}
onClick={onEnter}
onClick={onEnter}
/brand/favicon/plotpickle-icon-128.png
plotpickle-multi-server-collaboration.svg
href="/legal"
href="#studio" id="studio"
href="#builds" id="builds"
href="#open-source" id="open-source"
href="#collaboration" id="collaboration"
*/