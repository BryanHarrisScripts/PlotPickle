
"use client";

import { Fragment, type ReactNode, useEffect, useState } from "react";
import styles from "./readme-tabs.module.css";

const tabs = [
  { id: "getting-started", label: "Getting Started", path: "/docs/readme/GETTING-STARTED.md", source: "public/docs/readme/GETTING-STARTED.md" },
  { id: "writing-production", label: "Writing & Production", path: "/docs/readme/WRITING-AND-PRODUCTION.md", source: "public/docs/readme/WRITING-AND-PRODUCTION.md" },
  { id: "collaboration-development", label: "Collaboration & Development", path: "/docs/readme/COLLABORATION-AND-DEVELOPMENT.md", source: "public/docs/readme/COLLABORATION-AND-DEVELOPMENT.md" },
] as const;

type TabId = typeof tabs[number]["id"];

function inline(value: string): ReactNode[] {
  const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
  return value.split(pattern).filter(Boolean).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a href={link[2]} key={`${part}-${index}`} target={link[2].startsWith("http") ? "_blank" : undefined} rel="noreferrer">{link[1]}</a>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function renderMarkdown(source: string) {
  const nodes: ReactNode[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  let code: string[] = [];
  let list: string[] = [];
  let inCode = false;
  const flushList = () => { if (list.length) { nodes.push(<ul key={`list-${nodes.length}`}>{list.map((item, index) => <li key={`${item}-${index}`}>{inline(item)}</li>)}</ul>); list = []; } };
  const flushCode = () => { if (code.length) { nodes.push(<pre key={`code-${nodes.length}`}><code>{code.join("\n")}</code></pre>); code = []; } };
  lines.forEach((line) => {
    if (line.startsWith("```")) { flushList(); if (inCode) flushCode(); inCode = !inCode; return; }
    if (inCode) { code.push(line); return; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { flushList(); const level = Math.min(4, heading[1].length + 1); const content = inline(heading[2]); nodes.push(level === 2 ? <h2 key={`h-${nodes.length}`}>{content}</h2> : level === 3 ? <h3 key={`h-${nodes.length}`}>{content}</h3> : <h4 key={`h-${nodes.length}`}>{content}</h4>); return; }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) { list.push(bullet[1]); return; }
    flushList();
    if (!line.trim()) return;
    if (/^---+$/.test(line.trim())) { nodes.push(<hr key={`hr-${nodes.length}`} />); return; }
    if (line.startsWith("> ")) { nodes.push(<blockquote key={`q-${nodes.length}`}>{inline(line.slice(2))}</blockquote>); return; }
    nodes.push(<p key={`p-${nodes.length}`}>{inline(line)}</p>);
  });
  flushList(); flushCode();
  return nodes;
}

export default function ReadmeTabs() {
  const [active, setActive] = useState<TabId>("getting-started");
  const [content, setContent] = useState("Loading documentation…");
  const selected = tabs.find((tab) => tab.id === active) ?? tabs[0];
  useEffect(() => {
    const controller = new AbortController();
    fetch(selected.path, { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error("Documentation could not be loaded."); return response.text(); }).then(setContent).catch((error) => { if (!controller.signal.aborted) setContent(error instanceof Error ? error.message : "Documentation could not be loaded."); });
    return () => controller.abort();
  }, [selected.path]);
  return (
    <section className={styles.browser} aria-labelledby="readme-tabs-title">
      <header><div><span>Complete project README</span><h2 id="readme-tabs-title">Read the same documentation in three selectable tabs.</h2><p>No README material was removed; the long guide is divided by task so a writer, collaborator or installer can enter at the right place.</p></div><a href={`https://github.com/BryanHarrisScripts/PlotPickle/blob/main/${selected.source}`} target="_blank" rel="noreferrer">Open this .md on GitHub</a></header>
      <nav role="tablist" aria-label="PlotPickle README sections">{tabs.map((tab) => <button type="button" role="tab" aria-selected={active === tab.id} className={active === tab.id ? styles.active : ""} key={tab.id} onClick={() => setActive(tab.id)}>{tab.label}</button>)}</nav>
      <article className={styles.markdown}>{renderMarkdown(content)}</article>
    </section>
  );
}
