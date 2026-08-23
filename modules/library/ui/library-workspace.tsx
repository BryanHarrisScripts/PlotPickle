"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { PPFProject } from "../../../core/project/project";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  createLibraryWorkingCopy,
  initializeProjectLibrary,
  listLibraryProjects,
  switchActiveLibraryProject,
  type ProjectLibrarySummary,
} from "../../../core/storage/project-library-browser";
import AverySessionHistory from "./avery-session-history/index";
import { createFeaturedExamples, createGenrePresets, type LibraryCatalogItem } from "../project-library-catalog";
import styles from "./library-workspace.module.css";

type LibraryTab = "featured" | "presets" | "stories";
type PendingLoad =
  | { readonly kind: "catalog"; readonly sourceKind: "example" | "preset"; readonly item: LibraryCatalogItem }
  | { readonly kind: "story"; readonly item: ProjectLibrarySummary };

const TABS: readonly { readonly id: LibraryTab; readonly label: string }[] = [
  { id: "featured", label: "Featured Examples" },
  { id: "presets", label: "Genre Presets" },
  { id: "stories", label: "My Stories" },
];

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Saved locally";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function openActiveProject() {
  window.location.assign("/?workspace=dashboard");
}

function CatalogCard({ item, sourceKind, onLoad }: { readonly item: LibraryCatalogItem; readonly sourceKind: "example" | "preset"; readonly onLoad: () => void }) {
  return <article className={styles.card} data-library-catalog-id={item.id}><div className={styles.visual} data-visual-kind={item.id} aria-hidden="true"><span>{item.visualLabel}</span></div><div className={styles.cardBody}><div className={styles.meta}><span>{item.genre}</span><span>{item.format}</span></div><h3>{item.title}</h3><p>{item.description}</p><button className={styles.primaryButton} onClick={onLoad} type="button">{sourceKind === "example" ? "Load & Explore" : "Start from Preset"}</button></div></article>;
}

function StoryCard({ item, activeProjectId, onOpen }: { readonly item: ProjectLibrarySummary; readonly activeProjectId: string; readonly onOpen: () => void }) {
  const active = item.id === activeProjectId;
  return <article className={`${styles.card} ${active ? styles.activeCard : ""}`} data-library-story-id={item.id}><div className={styles.storyVisual}>{item.thumbnail ? <Image alt="" fill sizes="(max-width: 760px) 100vw, 33vw" src={item.thumbnail} unoptimized /> : <span aria-hidden="true">{item.title.slice(0, 1).toUpperCase()}</span>}{active ? <strong>Active story</strong> : null}</div><div className={styles.cardBody}><div className={styles.meta}><span>{item.genre || item.sourceKind}</span><span>{item.format}</span></div><h3>{item.title}</h3><p>{item.frontier} · {item.progress}% complete</p><small>Last saved {displayDate(item.updatedAt)}</small><div className={styles.progress} aria-label={`${item.progress}% complete`}><i style={{ width: `${item.progress}%` }} /></div><button className={active ? styles.secondaryButton : styles.primaryButton} onClick={active ? openActiveProject : onOpen} type="button">{active ? "Resume" : "Open Story"}</button></div></article>;
}

export default function LibraryWorkspace() {
  const catalogCreatedAt = useMemo(() => "2026-08-20T00:00:00.000Z", []);
  const examples = useMemo(() => createFeaturedExamples(catalogCreatedAt), [catalogCreatedAt]);
  const presets = useMemo(() => createGenrePresets(catalogCreatedAt), [catalogCreatedAt]);
  const [tab, setTab] = useState<LibraryTab>("featured");
  const [activeProject, setActiveProject] = useState<PPFProject | null>(null);
  const [stories, setStories] = useState<readonly ProjectLibrarySummary[]>([]);
  const [pending, setPending] = useState<PendingLoad | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const refresh = () => {
      const library = initializeProjectLibrary();
      setActiveProject(library.activeProject);
      setStories(listLibraryProjects());
      if (library.migrated) setNotice("Your existing PlotPickle project was safely added to My Stories.");
      else if (library.quarantined.length) setNotice("PlotPickle preserved an unreadable record for recovery and opened the last good story.");
    };
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
  }, []);

  function confirmLoad() {
    if (!pending) return;
    try {
      if (pending.kind === "story") switchActiveLibraryProject(pending.item.id);
      else createLibraryWorkingCopy({ sourceProject: pending.item.project, sourceKind: pending.sourceKind, sourceId: pending.item.id, title: pending.item.title, genre: pending.item.genre, format: pending.item.format });
      setPending(null);
      openActiveProject();
    } catch (error) {
      setPending(null);
      setNotice(error instanceof Error ? error.message : "PlotPickle could not switch stories.");
    }
  }

  const visibleCatalog = tab === "featured" ? examples : presets;

  return <main className={styles.workspace} aria-labelledby="library-title" data-library-workspace="v1">
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>Local story archive</p><h1 id="library-title">Library</h1><p>Examples &amp; Stories</p></div>
      <aside aria-label="Active story"><span>Active story</span><strong>{activeProject?.title || "Opening your Library…"}</strong><small>Your work stays local and is saved before every story switch.</small></aside>
    </header>

    <div className={styles.libraryColumn}>
      <AverySessionHistory />
      <nav aria-label="Library filters" className={styles.tabs}>{TABS.map((item) => <button aria-current={tab === item.id ? "page" : undefined} key={item.id} onClick={() => setTab(item.id)} type="button">{item.label}{item.id === "stories" ? <span>{stories.length}</span> : null}</button>)}</nav>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {tab === "stories" ? <section aria-labelledby="my-stories-title" className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Durable local projects</p><h2 id="my-stories-title">My Stories</h2></div><p>Open any saved Human project without mixing it with Avery’s read-only Writer-in-Residence sessions. Those sessions stay above the story shelf and never become the active Human project.</p></div>{stories.length ? <div className={styles.grid}>{stories.map((item) => <StoryCard activeProjectId={activeProject?.id || ""} item={item} key={item.id} onOpen={() => setPending({ kind: "story", item })} />)}</div> : <div className={styles.empty}><h3>Your shelves are ready.</h3><p>Explore a complete example or choose a genre preset to create your first local working story.</p><button className={styles.primaryButton} onClick={() => setTab("featured")} type="button">Browse Featured Examples</button></div>}</section> : <section aria-labelledby={`${tab}-title`} className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{tab === "featured" ? "Immutable source projects" : "Canonical PPF starters"}</p><h2 id={`${tab}-title`}>{tab === "featured" ? "Featured Examples" : "Genre Presets"}</h2></div><p>{tab === "featured" ? "Load a user-owned working copy, then explore it through the normal PlotPickle workflow. The packaged source never changes." : "Each preset fills only fields supported by the current PPF model, leaving your creative decisions open."}</p></div><div className={styles.grid}>{visibleCatalog.map((item) => <CatalogCard item={item} key={item.id} onLoad={() => setPending({ kind: "catalog", sourceKind: tab === "featured" ? "example" : "preset", item })} sourceKind={tab === "featured" ? "example" : "preset"} />)}</div></section>}
    </div>

    {pending ? <div className={styles.dialogBackdrop} role="presentation"><section aria-labelledby="library-load-title" aria-modal="true" className={styles.dialog} role="dialog"><p className={styles.eyebrow}>Safe project switch</p><h2 id="library-load-title">Load this project?</h2><p>Your current work will be saved as a local story before PlotPickle switches projects.</p><strong>{pending.item.title}</strong><div><button className={styles.secondaryButton} onClick={() => setPending(null)} type="button">Keep Current Story</button><button className={styles.primaryButton} onClick={confirmLoad} type="button">Save &amp; Switch</button></div></section></div> : null}
  </main>;
}
