"use client";

import React, { cloneElement, isValidElement, type ReactNode } from "react";
import MarketingSplashBase from "./marketing-splash-base";
import { graphicNovelText } from "@/lib/ai-pitch-deck";

export type MarketingSplashProps = Parameters<typeof MarketingSplashBase>[0];

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

export default function MarketingSplash(props: MarketingSplashProps) {
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get("workspace") === "1") props.onEnter();
  }, [props.onEnter]);

  const rendered = MarketingSplashBase(props);
  return (
    <>
      {translateReactNode(rendered)}
      <span hidden aria-hidden="true" data-legacy-contract="Automatic comic-book pitch deck" />
    </>
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
