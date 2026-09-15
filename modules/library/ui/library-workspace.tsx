"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { PPFProject } from "../../../core/project/project";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  archiveLibraryProject,
  createLibraryUserProject,
  createLibraryWorkingCopy,
  importLibraryProject,
  initializeProjectLibrary,
  listArchivedLibraryProjects,
  listLibraryProjects,
  switchActiveLibraryProject,
  type LibraryPPFProject,
  type ProjectLibrarySummary,
} from "../../../core/storage/project-library-browser";
import AverySessionHistory from "./avery-session-history/index";
import ArchiveStoriesPanel from "./archive-stories-panel";
import {
  createFeaturedExamples,
  createGenrePresets,
  type LibraryCatalogItem,
  type LibraryFrontierCoverage,
} from "../project-library-catalog";
import styles from "./library-workspace.module.css";

type LibraryDestination = "new" | "import" | "load" | "examples" | "presets" | "avery" | "archive";
type PendingLoad =
  | { readonly kind: "catalog"; readonly sourceKind: "example" | "preset"; readonly item: LibraryCatalogItem }
  | { readonly kind: "story"; readonly item: ProjectLibrarySummary };

const DESTINATIONS: readonly { readonly id: LibraryDestination; readonly label: string }[] = [
  { id: "new", label: "NEW" },
  { id: "import", label: "IMPORT" },
  { id: "load", label: "LOAD" },
  { id: "examples", label: "EXAMPLES" },
  { id: "presets", label: "PRESETS" },
  { id: "avery", label: "AVERY" },
  { id: "archive", label: "ARCHIVE" },
];

const COVERAGE_LABELS: Readonly<Record<keyof LibraryFrontierCoverage, string>> = {
  foundations: "Foundations",
  world: "World",
  character: "Character",
  structure: "Structure",
  storyboard: "Storyboard",
};

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Saved locally";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function openActiveProject() {
  window.location.assign("/?workspace=dashboard");
}

function moveLibraryFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const buttons = Array.from(event.currentTarget.closest("nav")?.querySelectorAll<HTMLButtonElement>("button") || []);
  if (!buttons.length) return;
  let nextIndex = index;
  if (event.key === "ArrowDown") nextIndex = (index + 1) % buttons.length;
  else if (event.key === "ArrowUp") nextIndex = (index - 1 + buttons.length) % buttons.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = buttons.length - 1;
  else return;
  event.preventDefault();
  buttons[nextIndex]?.focus();
}

function CatalogCard({ item, sourceKind, onLoad }: {
  readonly item: LibraryCatalogItem;
  readonly sourceKind: "example" | "preset";
  readonly onLoad: () => void;
}) {
  return (
    <article className={styles.card} data-library-catalog-id={item.id}>
      <div className={styles.visual} data-visual-kind={item.id} aria-hidden="true"><span>{item.visualLabel}</span></div>
      <div className={styles.cardBody}>
        <div className={styles.meta}><span>{item.genre}</span><span>{item.format}</span></div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <div className={styles.coverage} aria-label={`${item.title} curriculum coverage`}>
          {(Object.keys(COVERAGE_LABELS) as (keyof LibraryFrontierCoverage)[]).map((key) => (
            <span data-coverage-state={item.coverage[key]} key={key}><b>{COVERAGE_LABELS[key]}</b><strong>{item.coverage[key]}</strong></span>
          ))}
        </div>
        {item.referenceLoader === "afterglow-v9-foundations" ? <small>Reference frontier: Foundations complete · later story detail remains reviewable or locked.</small> : null}
        <button className={styles.primaryButton} onClick={onLoad} type="button">{sourceKind === "example" ? "Load & Explore" : "Start from Preset"}</button>
      </div>
    </article>
  );
}

function StoryCard({ item, activeProjectId, onOpen, onArchive }: {
  readonly item: ProjectLibrarySummary;
  readonly activeProjectId: string;
  readonly onOpen: () => void;
  readonly onArchive: () => void;
}) {
  const active = item.id === activeProjectId;
  return (
    <article className={`${styles.card} ${active ? styles.activeCard : ""}`} data-library-story-id={item.id}>
      <div className={styles.storyVisual}>
        {item.thumbnail ? <Image alt="" fill sizes="(max-width: 760px) 100vw, 33vw" src={item.thumbnail} unoptimized /> : <span aria-hidden="true">{item.title.slice(0, 1).toUpperCase()}</span>}
        {active ? <strong>Active story</strong> : null}
        <details className={styles.cardMenu}>
          <summary aria-label={`More options for ${item.title}`}>•••</summary>
          <div><button type="button" onClick={onArchive}>Archive story</button></div>
        </details>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.meta}><span>{item.genre || item.sourceKind}</span><span>{item.format}</span></div>
        <h3>{item.title}</h3>
        <p>{item.frontier} · {item.progress}% complete</p>
        <small>Last saved {displayDate(item.updatedAt)}</small>
        <progress className={styles.progress} max={100} value={item.progress} aria-label={`${item.progress}% complete`} />
        <button className={active ? styles.secondaryButton : styles.primaryButton} onClick={active ? openActiveProject : onOpen} type="button">{active ? "Resume" : "Open Story"}</button>
      </div>
    </article>
  );
}

function NewStoryCard({ onCreate }: { readonly onCreate: () => void }) {
  return (
    <article className={`${styles.card} ${styles.ghostCard}`} data-library-new-story-card="ready">
      <div className={styles.storyVisual}><span aria-hidden="true">+</span><strong>Ready</strong></div>
      <div className={styles.cardBody}>
        <div className={styles.meta}><span>Story</span><span>Local PPF</span></div>
        <h3>New Story</h3>
        <p>Start a clean local PlotPickle story. Nothing is automatically treated as canon.</p>
        <small>This is the primary entry point for creating a new Human-owned story.</small>
        <button className={styles.primaryButton} onClick={onCreate} type="button">Create New Story</button>
      </div>
    </article>
  );
}

export default function LibraryWorkspace() {
  const catalogCreatedAt = useMemo(() => "2026-08-20T00:00:00.000Z", []);
  const examples = useMemo(() => createFeaturedExamples(catalogCreatedAt), [catalogCreatedAt]);
  const presets = useMemo(() => createGenrePresets(catalogCreatedAt), [catalogCreatedAt]);
  const ppfInput = useRef<HTMLInputElement>(null);
  const [destination, setDestination] = useState<LibraryDestination>("load");
  const [activeProject, setActiveProject] = useState<PPFProject | null>(null);
  const [stories, setStories] = useState<readonly ProjectLibrarySummary[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [pending, setPending] = useState<PendingLoad | null>(null);
  const [notice, setNotice] = useState("");
  const [importingPpf, setImportingPpf] = useState(false);
  const [loadingReference, setLoadingReference] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const library = initializeProjectLibrary();
      setActiveProject(library.activeProject);
      setStories(listLibraryProjects());
      setArchivedCount(listArchivedLibraryProjects().length);
      if (library.migrated) setNotice("Your existing PlotPickle project was safely added to LOAD.");
      else if (library.quarantined.length) setNotice("PlotPickle preserved an unreadable record for recovery and opened the last good story.");
    };
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("averySession")) setDestination("avery");
  }, []);

  function createNewStory() {
    try {
      createLibraryUserProject({ title: "Untitled Story", format: "Feature" });
      window.location.assign("/?workspace=learn");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not create a new story.");
    }
  }

  async function confirmLoad() {
    if (!pending || loadingReference) return;
    setLoadingReference(true);
    try {
      if (pending.kind === "story") {
        switchActiveLibraryProject(pending.item.id);
      } else {
        let sourceProject = pending.item.project;
        if (pending.item.referenceLoader === "afterglow-v9-foundations") {
          const { createAfterglowV9FoundationsReference } = await import("../reference/afterglow-v9-foundations");
          sourceProject = createAfterglowV9FoundationsReference();
        }
        createLibraryWorkingCopy({
          sourceProject,
          sourceKind: pending.sourceKind,
          sourceId: pending.item.id,
          title: pending.item.title,
          genre: pending.item.genre,
          format: pending.item.format,
        });
      }
      setPending(null);
      openActiveProject();
    } catch (error) {
      setPending(null);
      setNotice(error instanceof Error ? error.message : "PlotPickle could not switch stories.");
    } finally {
      setLoadingReference(false);
    }
  }

  function archiveStory(item: ProjectLibrarySummary) {
    try {
      archiveLibraryProject(item.id);
      setPending((current) => current?.kind === "story" && current.item.id === item.id ? null : current);
      setNotice(`${item.title} moved to Archive. You can restore it at any time.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not archive this story.");
    }
  }

  async function importPpf(file: File) {
    if (importingPpf) return;
    setImportingPpf(true);
    setNotice("");
    try {
      const response = await fetch("/api/library/import/ppf", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-PlotPickle-Project-Filename": encodeURIComponent(file.name),
        },
        body: await file.arrayBuffer(),
      });
      const result = await response.json() as {
        readonly message?: string;
        readonly sourceProjectId?: string;
        readonly sourceFileName?: string;
        readonly project?: LibraryPPFProject;
      };
      if (!response.ok || !result.project) throw new Error(result.message || "PlotPickle could not convert this .ppf into a Library story.");
      const imported = importLibraryProject({
        sourceProject: result.project,
        sourceId: result.sourceProjectId || result.sourceFileName || file.name,
        title: result.project.title,
        format: `Imported · ${result.project.sourceEvidence.screenplay?.sourceFormat || "PPF"}`,
      });
      setDestination("load");
      setNotice(`${imported.title} was imported into Library. Screenplay passages stay evidence; imported interpretation still requires your review.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not import this .ppf.");
    } finally {
      setImportingPpf(false);
      if (ppfInput.current) ppfInput.current.value = "";
    }
  }

  function renderSurface() {
    if (destination === "new") {
      return (
        <section aria-labelledby="new-title" className={styles.section} data-library-surface="new">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Create a Human-owned story</p><h2 id="new-title">NEW</h2></div>
            <p>Start a clean local project. Nothing is automatically treated as canon, so creative decisions remain yours from the beginning.</p>
          </div>
          <div className={styles.singleCard}><NewStoryCard onCreate={createNewStory} /></div>
        </section>
      );
    }

    if (destination === "import") {
      return (
        <section aria-labelledby="import-title" className={styles.section} data-library-surface="import">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Bring in existing work</p><h2 id="import-title">IMPORT</h2></div>
            <p>.PPF is the currently supported Library import path. Imported material remains source evidence until reviewed, and importer interpretation never silently becomes canon.</p>
          </div>
          <div className={styles.actionPanel}>
            <div><strong>Import a .PPF story</strong><p>Choose an existing PlotPickle PPF file and add it to your local Library.</p></div>
            <input ref={ppfInput} accept=".ppf,application/octet-stream" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importPpf(file); }} type="file" />
            <button className={styles.primaryButton} disabled={importingPpf} onClick={() => ppfInput.current?.click()} type="button">{importingPpf ? "Importing…" : "Import .PPF"}</button>
          </div>
        </section>
      );
    }

    if (destination === "load") {
      return (
        <section aria-labelledby="load-title" className={styles.section} data-library-surface="load">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Durable local projects</p><h2 id="load-title">LOAD</h2></div>
            <p>Open, resume, and manage your saved Human-owned PlotPickle stories. Avery Writer-in-Residence work is kept separate.</p>
          </div>
          {stories.length ? (
            <div className={styles.grid}>
              {stories.map((item) => (
                <StoryCard
                  activeProjectId={activeProject?.id || ""}
                  item={item}
                  key={item.id}
                  onArchive={() => archiveStory(item)}
                  onOpen={() => setPending({ kind: "story", item })}
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty}><h3>No saved stories yet.</h3><p>Use NEW to start a clean project or IMPORT to bring in an existing .PPF.</p></div>
          )}
        </section>
      );
    }

    if (destination === "examples" || destination === "presets") {
      const isExamples = destination === "examples";
      const visibleCatalog = isExamples ? examples : presets;
      return (
        <section aria-labelledby={`${destination}-title`} className={styles.section} data-library-surface={destination}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>{isExamples ? "Packaged reference stories" : "Supported starter structures"}</p><h2 id={`${destination}-title`}>{isExamples ? "EXAMPLES" : "PRESETS"}</h2></div>
            <p>{isExamples
              ? "These are complete reference stories supplied with PlotPickle. Loading one creates a user-owned working copy while the packaged source remains unchanged."
              : "Presets provide a starting structure for a genre or story type. They fill only supported starter fields, keep creative decisions with the Human, and create normal user-owned working projects."}</p>
          </div>
          <div className={styles.grid}>{visibleCatalog.map((item) => <CatalogCard item={item} key={item.id} onLoad={() => setPending({ kind: "catalog", sourceKind: isExamples ? "example" : "preset", item })} sourceKind={isExamples ? "example" : "preset"} />)}</div>
        </section>
      );
    }

    if (destination === "avery") {
      return (
        <section aria-labelledby="avery-title" className={styles.section} data-library-surface="avery">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Writer-in-Residence</p><h2 id="avery-title">AVERY</h2></div>
            <p>Avery synthetic work and Writer-in-Residence history stay read-only and separate from Human-owned Library stories.</p>
          </div>
          <AverySessionHistory />
        </section>
      );
    }

    return (
      <section aria-labelledby="archive-title" className={styles.section} data-library-surface="archive">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>Human-owned story history</p><h2 id="archive-title">ARCHIVE</h2></div>
          <p>Review Human-owned stories you deliberately archived and restore them when needed. Avery sessions, examples, and presets do not enter this archive lifecycle.</p>
        </div>
        <ArchiveStoriesPanel />
      </section>
    );
  }

  return (
    <main className={styles.workspace} aria-labelledby="library-title" data-library-workspace="v2">
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>Local story library</p><h1 id="library-title">Library</h1><p>Your stories first</p></div>
        <aside aria-label="Active story"><span>Active story</span><strong>{activeProject?.title || "No active story"}</strong><small>{activeProject ? "Your work stays local and is saved before every story switch." : "Create, restore, or import a story when you are ready."}</small></aside>
      </header>

      <div className={styles.libraryLayout}>
        <nav aria-label="Library navigation" className={styles.libraryNav}>
          {DESTINATIONS.map((item, index) => (
            <button
              aria-current={destination === item.id ? "page" : undefined}
              data-library-nav={item.id}
              key={item.id}
              onClick={() => setDestination(item.id)}
              onKeyDown={(event) => moveLibraryFocus(event, index)}
              type="button"
            >
              <strong>{item.label}</strong>
              {item.id === "load" ? <span>{stories.length}</span> : item.id === "archive" ? <span>{archivedCount}</span> : null}
            </button>
          ))}
        </nav>

        <div className={styles.libraryColumn}>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
          {renderSurface()}
        </div>
      </div>

      {pending ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <section aria-labelledby="library-load-title" aria-modal="true" className={styles.dialog} role="dialog">
            <p className={styles.eyebrow}>Safe project switch</p><h2 id="library-load-title">Load this project?</h2>
            <p>Your current work will be saved as a local story before PlotPickle switches projects.</p><strong>{pending.item.title}</strong>
            {pending.kind === "catalog" && pending.item.referenceLoader === "afterglow-v9-foundations" ? <small>The complete v9 reference is loaded only after you confirm, keeping the screenplay and reference evidence off PlotPickle’s startup path.</small> : null}
            <div><button className={styles.secondaryButton} disabled={loadingReference} onClick={() => setPending(null)} type="button">Keep Current Story</button><button className={styles.primaryButton} disabled={loadingReference} onClick={() => void confirmLoad()} type="button">{loadingReference ? "Loading Reference…" : "Save & Switch"}</button></div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
