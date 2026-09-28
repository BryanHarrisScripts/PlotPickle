"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { PPFProject } from "../../../core/project/project";
import { libraryBackupFileName, parseLibraryBackup, serializeLibraryBackup } from "../../../core/storage/library-project";
import {
  DEFAULT_LOCAL_PROFILE_ID,
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  PROJECT_LIBRARY_CHANGED_EVENT,
  createLibraryUserProject,
  createLibraryWorkingCopy,
  importLibraryProject,
  initializeProjectLibrary,
  listArchivedLibraryProjects,
  listLibraryProjects,
  loadLibraryProjectSnapshot,
  saveActiveLibraryProject,
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
import {
  createLibraryLoadSessionBaseline,
  inventoryLocalResources,
  restoreLocalStoryboardResources,
  restoreLocalWorldMapCharacterResources,
  restoreLocalWorldMapPosterResources,
  type LibraryLoadSessionBaseline,
  type LocalAssetIndexItem,
  type LocalResourceInventory,
  type RecoveredStoryboardResource,
  type RecoveredWorldMapCharacterResource,
  type RecoveredWorldMapPosterResource,
} from "../local-resource-recovery";
import styles from "./library-workspace.module.css";
import { flushProfilePrivateWrites, persistActiveProfileProject } from "../../../core/storage/profile-private-browser";

type LibraryDestination = "load" | "new" | "import-export" | "examples" | "presets" | "avery" | "archive";
type PendingLoad =
  | { readonly kind: "catalog"; readonly sourceKind: "example" | "preset"; readonly item: LibraryCatalogItem }
  | { readonly kind: "story"; readonly item: ProjectLibrarySummary };

type PendingRecovery = {
  readonly project: LibraryPPFProject;
  readonly baseline: LibraryLoadSessionBaseline;
  readonly inventory: LocalResourceInventory;
  readonly scanError: string;
};

type LocalAssetIndexResponse = {
  readonly assets?: readonly LocalAssetIndexItem[];
  readonly message?: string;
};

const PROJECT_LIBRARY_SESSION_CHANGED_EVENT = "plotpickle:project-library-session-changed";
const SESSION_PROJECT_KEY_PREFIX = "plotpickle.project-library.session-project";
const LOAD_SESSION_KEY_PREFIX = "plotpickle.project-library.load-session";
const LOCAL_RESOURCE_SCAN_TIMEOUT_MS = 8_000;

const DESTINATIONS: readonly {
  readonly id: LibraryDestination;
  readonly shortcut: string;
  readonly label: string;
  readonly description: string;
}[] = [
  { id: "load", shortcut: "L", label: "LOAD", description: "Load Your Stories" },
  { id: "new", shortcut: "N", label: "NEW", description: "Start a New Story" },
  { id: "import-export", shortcut: "I", label: "IMPORT EXPORT", description: "Import or Export a Story" },
  { id: "examples", shortcut: "E", label: "EXAMPLES", description: "Explore Reference Stories" },
  { id: "presets", shortcut: "P", label: "PRESETS", description: "Start From a Story Preset" },
  { id: "avery", shortcut: "A", label: "AVERY", description: "Writer-in-Residence History" },
  { id: "archive", shortcut: "R", label: "ARCHIVE", description: "Archived Stories" },
];

const COVERAGE_LABELS: Readonly<Record<keyof LibraryFrontierCoverage, string>> = {
  foundations: "Foundations",
  world: "World",
  character: "Character",
  structure: "Structure",
  storyboard: "Storyboard",
};

const AFTERGLOW_EXAMPLE_SOURCE_ID = "afterglow-v9";
const AFTERGLOW_EXAMPLE_FALLBACK_POSTER = "/assets/library/examples/afterglow.svg";
function currentProfileId() {
  return window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY)?.trim() || DEFAULT_LOCAL_PROFILE_ID;
}

function currentSessionProjectKey() {
  return `${SESSION_PROJECT_KEY_PREFIX}:${currentProfileId()}`;
}

function currentLoadSessionKey() {
  return `${LOAD_SESSION_KEY_PREFIX}:${currentProfileId()}`;
}

function persistLoadSessionBaseline(baseline: LibraryLoadSessionBaseline) {
  window.sessionStorage.setItem(currentLoadSessionKey(), JSON.stringify(baseline));
}

function markCurrentSessionLibraryProject(projectId: string) {
  const normalized = projectId.trim();
  if (!normalized) throw new Error("A current-session story requires a project ID.");
  window.sessionStorage.setItem(currentSessionProjectKey(), normalized);
  window.dispatchEvent(new Event(PROJECT_LIBRARY_SESSION_CHANGED_EVENT));
}

function clearCurrentSessionLibraryProject() {
  window.sessionStorage.removeItem(currentSessionProjectKey());
  window.dispatchEvent(new Event(PROJECT_LIBRARY_SESSION_CHANGED_EVENT));
}

function currentSessionLibraryProject(): LibraryPPFProject | null {
  const projectId = window.sessionStorage.getItem(currentSessionProjectKey())?.trim();
  if (!projectId) return null;
  const activeProject = initializeProjectLibrary().activeProject;
  return activeProject?.id === projectId ? activeProject : null;
}

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Saved locally";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function openActiveProject() {
  await persistActiveProfileProject();
  await flushProfilePrivateWrites();
  window.location.assign("/?workspace=dashboard");
}

function ExampleGatewayCard({ item, onOpen }: {
  readonly item: LibraryCatalogItem;
  readonly onOpen: () => void;
}) {
  return (
    <article className={`${styles.card} ${styles.exampleGatewayCard}`} data-library-example-gateway={item.id}>
      <div className={styles.gatewayPoster}>
        <Image
          src={AFTERGLOW_EXAMPLE_FALLBACK_POSTER}
          alt="Afterglow packaged PlotPickle example"
          width={1200}
          height={675}
          priority
        />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.meta}><span>Packaged with PlotPickle</span><span>Example</span></div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <small>Open EXAMPLES to choose Project Defaults or restore your own local changes.</small>
        <button className={styles.primaryButton} onClick={onOpen} type="button">Open Example</button>
      </div>
    </article>
  );
}

function CatalogCard({ item, sourceKind, onLoad, disabled = false }: {
  readonly item: LibraryCatalogItem;
  readonly sourceKind: "example" | "preset";
  readonly onLoad: (mode?: "defaults" | "restore") => void;
  readonly disabled?: boolean;
}) {
  return (
    <article className={`${styles.card} ${sourceKind === "example" ? styles.exampleCard : ""}`} data-library-catalog-id={item.id}>
      {sourceKind === "example"
        ? (
          <div className={styles.examplePoster} data-example-poster="packaged">
            <Image
              src={AFTERGLOW_EXAMPLE_FALLBACK_POSTER}
              alt="Afterglow packaged PlotPickle example poster"
              width={1200}
              height={675}
              priority
            />
          </div>
        )
        : <div className={styles.visual} data-visual-kind={item.id} aria-hidden="true"><span>{item.visualLabel}</span></div>}
      <div className={styles.cardBody}>
        <div className={styles.meta}><span>{item.genre}</span><span>{item.format}</span></div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        {sourceKind === "example" ? (
          <div className={styles.exampleLogline}>
            <span>Logline</span>
            <p>{item.logline}</p>
          </div>
        ) : (
          <div className={styles.coverage} aria-label={`${item.title} curriculum coverage`}>
            {(Object.keys(COVERAGE_LABELS) as (keyof LibraryFrontierCoverage)[]).map((key) => (
              <span data-coverage-state={item.coverage[key]} key={key}><b>{COVERAGE_LABELS[key]}</b><strong>{item.coverage[key]}</strong></span>
            ))}
          </div>
        )}
        {sourceKind === "example" ? (
          <div className={styles.exampleActions}>
            <button className={styles.secondaryButton} disabled={disabled} onClick={() => onLoad("defaults")} type="button">Project Defaults</button>
            <button className={styles.primaryButton} disabled={disabled} onClick={() => onLoad("restore")} type="button">Restore Your Changes</button>
          </div>
        ) : (
          <button className={styles.primaryButton} disabled={disabled} onClick={() => onLoad()} type="button">Start from Preset</button>
        )}
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
  const directoryItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [destination, setDestination] = useState<LibraryDestination>("load");
  const [directorySelectedIndex, setDirectorySelectedIndex] = useState(0);
  const [activeProject, setActiveProject] = useState<PPFProject | null>(null);
  const [stories, setStories] = useState<readonly ProjectLibrarySummary[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [pending, setPending] = useState<PendingLoad | null>(null);
  const [recovery, setRecovery] = useState<PendingRecovery | null>(null);
  const [selectedRecoveryOrigins, setSelectedRecoveryOrigins] = useState<readonly string[]>([]);
  const [notice, setNotice] = useState("");
  const [importingPpf, setImportingPpf] = useState(false);
  const [loadingReference, setLoadingReference] = useState(false);
  const [restoringResources, setRestoringResources] = useState(false);
  const [rescanningResources, setRescanningResources] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const library = initializeProjectLibrary();
      setActiveProject(currentSessionLibraryProject());
      const savedStories = listLibraryProjects().filter((item) => item.sourceKind !== "synthetic");
      const archivedStories = listArchivedLibraryProjects().filter((item) => item.sourceKind !== "synthetic");
      setStories(savedStories);
      setArchivedCount(archivedStories.length);
      if (library.migrated) setNotice("Your existing PlotPickle project was safely added to LOAD.");
      else if (library.quarantined.length) setNotice("PlotPickle preserved an unreadable record for recovery and opened the last good story.");
    };
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    window.addEventListener(PROJECT_LIBRARY_SESSION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
      window.removeEventListener(PROJECT_LIBRARY_SESSION_CHANGED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("averySession")) return;
    const averyIndex = DESTINATIONS.findIndex((item) => item.id === "avery");
    setDirectorySelectedIndex(averyIndex);
    setDestination("avery");
  }, []);

  function selectDirectoryItem(index: number) {
    const normalized = (index + DESTINATIONS.length) % DESTINATIONS.length;
    setDirectorySelectedIndex(normalized);
    window.requestAnimationFrame(() => directoryItemRefs.current[normalized]?.focus());
  }

  function activateDestination(index: number) {
    const item = DESTINATIONS[index];
    if (!item) return;
    setDirectorySelectedIndex(index);
    setDestination(item.id);
  }

  function handleDirectoryKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1) {
      const shortcut = event.key.toUpperCase();
      const shortcutIndex = DESTINATIONS.findIndex((item) => item.shortcut === shortcut);
      if (shortcutIndex >= 0) {
        event.preventDefault();
        activateDestination(shortcutIndex);
        return;
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectDirectoryItem(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectDirectoryItem(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectDirectoryItem(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectDirectoryItem(DESTINATIONS.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateDestination(index);
    }
  }

  async function createNewStory() {
    try {
      const project = createLibraryUserProject({ title: "Untitled Story", format: "Feature" });
      markCurrentSessionLibraryProject(project.id);
      await persistActiveProfileProject();
      await flushProfilePrivateWrites();
      window.location.assign("/?workspace=learn");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not create a new story.");
    }
  }

  async function scanLocalResources(project: LibraryPPFProject) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), LOCAL_RESOURCE_SCAN_TIMEOUT_MS);
    try {
      const response = await fetch("/api/local-ai/assets", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.json() as LocalAssetIndexResponse;
      if (!response.ok) throw new Error(body.message || "PlotPickle could not scan local resources.");
      const sourceProjects = [...listLibraryProjects(), ...listArchivedLibraryProjects()]
        .map((item) => loadLibraryProjectSnapshot(item.id))
        .filter((item): item is LibraryPPFProject => Boolean(item));
      return inventoryLocalResources(project, Array.isArray(body.assets) ? body.assets : [], sourceProjects);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Local resource scan timed out. The story is still loaded; retry the scan or continue with project defaults.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function confirmLoad() {
    if (!pending || loadingReference) return;
    setLoadingReference(true);
    try {
      let openedProject: LibraryPPFProject;
      if (pending.kind === "story") {
        openedProject = switchActiveLibraryProject(pending.item.id);
      } else {
        let sourceProject = pending.item.project;
        if (pending.item.referenceLoader === "afterglow-v9-foundations") {
          const { createAfterglowV9FoundationsReference } = await import("../reference/afterglow-v9-foundations");
          sourceProject = createAfterglowV9FoundationsReference();
        }
        openedProject = createLibraryWorkingCopy({
          sourceProject,
          sourceKind: pending.sourceKind,
          sourceId: pending.item.id,
          title: pending.item.title,
          genre: pending.item.genre,
          format: pending.item.format,
        });
      }

      markCurrentSessionLibraryProject(openedProject.id);
      const baseline = createLibraryLoadSessionBaseline(openedProject, {
        sessionId: globalThis.crypto?.randomUUID?.() ?? `load-${Date.now()}`,
        startedAt: new Date().toISOString(),
      });
      persistLoadSessionBaseline(baseline);

      let inventory = inventoryLocalResources(openedProject, []);
      let scanError = "";
      try {
        inventory = await scanLocalResources(openedProject);
      } catch (error) {
        scanError = error instanceof Error ? error.message : "PlotPickle could not scan local resources.";
      }

      if (!inventory.groups.length && !scanError) {
        setPending(null);
        void openActiveProject().catch((error) => setNotice(error instanceof Error ? error.message : "PlotPickle could not save the loaded story."));
        return;
      }

      setSelectedRecoveryOrigins(inventory.groups.filter((group) => group.selectedByDefault).map((group) => group.originProjectId));
      setRecovery({ project: openedProject, baseline, inventory, scanError });
      setPending(null);
    } catch (error) {
      setPending(null);
      setNotice(error instanceof Error ? error.message : "PlotPickle could not switch stories.");
    } finally {
      setLoadingReference(false);
    }
  }

  function useProjectDefaults() {
    setRecovery(null);
    setSelectedRecoveryOrigins([]);
    void openActiveProject().catch((error) => setNotice(error instanceof Error ? error.message : "PlotPickle could not save the loaded story."));
  }

  function toggleRecoveryOrigin(originProjectId: string) {
    setSelectedRecoveryOrigins((current) => current.includes(originProjectId)
      ? current.filter((value) => value !== originProjectId)
      : [...current, originProjectId]);
  }

  async function retryLocalResourceScan() {
    if (!recovery || rescanningResources || restoringResources) return;
    setRescanningResources(true);
    try {
      const inventory = await scanLocalResources(recovery.project);
      const selectedOrigins = inventory.groups.filter((group) => group.selectedByDefault).map((group) => group.originProjectId);
      setSelectedRecoveryOrigins(selectedOrigins);
      setRecovery((current) => current ? { ...current, inventory, scanError: "" } : current);
      setNotice("Local resources scanned again. Choose what to restore, load all, or continue with project defaults.");
    } catch (error) {
      const scanError = error instanceof Error ? error.message : "PlotPickle could not scan local resources.";
      setRecovery((current) => current ? { ...current, scanError } : current);
      setNotice(scanError);
    } finally {
      setRescanningResources(false);
    }
  }

  function restoreLocalResources(originProjectIds: readonly string[]) {
    if (!recovery || restoringResources) return;
    const selected = recovery.inventory.groups
      .filter((group) => originProjectIds.includes(group.originProjectId))
      .flatMap((group) => group.resources);
    if (!selected.length) {
      setNotice("Choose at least one local resource group, or use the project defaults.");
      return;
    }

    setRestoringResources(true);
    try {
      const current = initializeProjectLibrary().activeProject;
      if (!current || current.id !== recovery.project.id) {
        throw new Error("The active story changed before local resources were restored.");
      }
      const storyboardResources = selected.filter((resource): resource is RecoveredStoryboardResource => resource.kind === "storyboard-frame");
      const posterResources = selected.filter((resource): resource is RecoveredWorldMapPosterResource => resource.kind === "worldmap-poster");
      const characterResources = selected.filter((resource): resource is RecoveredWorldMapCharacterResource => resource.kind === "worldmap-character");
      const storyboardApprovalProjectIds = [...new Set([
        ...storyboardResources.map((resource) => resource.originProjectId),
        ...listLibraryProjects().map((item) => item.id),
        ...listArchivedLibraryProjects().map((item) => item.id),
      ])].sort();
      const storyboardSourceProjects = storyboardApprovalProjectIds
        .map((projectId) => loadLibraryProjectSnapshot(projectId))
        .filter((project): project is LibraryPPFProject => Boolean(project));
      const storyboardResult = restoreLocalStoryboardResources(current, storyboardResources, storyboardSourceProjects);
      const posterResult = restoreLocalWorldMapPosterResources(storyboardResult.project, posterResources);
      const characterResult = restoreLocalWorldMapCharacterResources(posterResult.project, characterResources);
      saveActiveLibraryProject(characterResult.project);
      const attachedCount = storyboardResult.attachedCount + posterResult.attachedCount + characterResult.attachedVersionCount;
      const skippedCount = storyboardResult.skippedCount + posterResult.skippedCount + characterResult.skippedVersionCount;
      setNotice(`${attachedCount} local resource group${attachedCount === 1 ? "" : "s"} restored: ${storyboardResult.attachedCount} Storyboard frame${storyboardResult.attachedCount === 1 ? "" : "s"}, ${posterResult.attachedCount} World Map poster${posterResult.attachedCount === 1 ? "" : "s"}, and ${characterResult.attachedVersionCount} World Map character version${characterResult.attachedVersionCount === 1 ? "" : "s"}. ${storyboardResult.restoredLockedCount} proven Storyboard lock${storyboardResult.restoredLockedCount === 1 ? "" : "s"} and ${characterResult.restoredLockedCount} proven character lock${characterResult.restoredLockedCount === 1 ? "" : "s"} restored. ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"} skipped.`);
      setRecovery(null);
      setSelectedRecoveryOrigins([]);
      void openActiveProject().catch((error) => setNotice(error instanceof Error ? error.message : "PlotPickle could not save the loaded story."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not restore local resources.");
    } finally {
      setRestoringResources(false);
    }
  }

  function loadAllLocalResources() {
    if (!recovery || restoringResources || rescanningResources) return;
    const allOrigins = recovery.inventory.groups.map((group) => group.originProjectId);
    setSelectedRecoveryOrigins(allOrigins);
    restoreLocalResources(allOrigins);
  }

  function restoreSelectedLocalResources() {
    restoreLocalResources(selectedRecoveryOrigins);
  }

  function archiveStory(item: ProjectLibrarySummary) {
    try {
      const wasCurrentSessionStory = activeProject?.id === item.id;
      archiveLibraryProject(item.id);
      if (wasCurrentSessionStory) clearCurrentSessionLibraryProject();
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
      if (file.size > 48 * 1024 * 1024) throw new Error("A Library import cannot exceed 48 MB.");
      if (file.name.toLowerCase().endsWith(".ppf.json")) {
        const backup = parseLibraryBackup(await file.text());
        const imported = importLibraryProject({
          sourceProject: backup,
          sourceId: backup.id,
          title: backup.title,
          format: "Imported · Library backup",
        });
        markCurrentSessionLibraryProject(imported.id);
        setDirectorySelectedIndex(0);
        setDestination("load");
        setNotice(`${imported.title} was imported into Library as a separate working story.`);
        return;
      }
      if (!file.name.toLowerCase().endsWith(".ppf")) throw new Error("Choose a PlotPickle .ppf or .ppf.json file.");
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
      markCurrentSessionLibraryProject(imported.id);
      const loadIndex = DESTINATIONS.findIndex((item) => item.id === "load");
      setDirectorySelectedIndex(loadIndex);
      setDestination("load");
      setNotice(`${imported.title} was imported into Library. Screenplay passages stay evidence; imported interpretation still requires your review.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not import this project.");
    } finally {
      setImportingPpf(false);
      if (ppfInput.current) ppfInput.current.value = "";
    }
  }

  function exportCurrentStory() {
    try {
      const project = currentSessionLibraryProject() ?? initializeProjectLibrary().activeProject;
      if (!project) throw new Error("Load a story before exporting a Library backup.");
      const blob = new Blob([serializeLibraryBackup(project)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = libraryBackupFileName(project.title);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice(`${project.title} exported as a Library .ppf.json backup. Local image files are stored separately.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not export this story.");
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

    if (destination === "import-export") {
      return (
        <section aria-labelledby="import-export-title" className={styles.section} data-library-surface="import-export">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Move your work</p><h2 id="import-export-title">IMPORT EXPORT</h2></div>
            <p>Import a legacy .ppf story or a Library .ppf.json backup. Export your current story as a Library backup; locally stored image files remain separate.</p>
          </div>
          <div className={styles.actionPanel}>
            <div><strong>Import a story</strong><p>Choose a PlotPickle .ppf or .ppf.json file. Import creates a separate local working story.</p></div>
            <input ref={ppfInput} accept=".ppf,.json,application/octet-stream,application/json" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importPpf(file); }} type="file" />
            <button className={styles.primaryButton} disabled={importingPpf} onClick={() => ppfInput.current?.click()} type="button">{importingPpf ? "Importing…" : "Import story"}</button>
          </div>
          <div className={styles.actionPanel}>
            <div><strong>Export current story</strong><p>Download a .ppf.json backup of the current Library story. Keep local image files alongside your backup.</p></div>
            <button className={styles.primaryButton} disabled={!stories.length} onClick={exportCurrentStory} type="button">Export story</button>
          </div>
        </section>
      );
    }

    if (destination === "load") {
      return (
        <section aria-labelledby="load-title" className={styles.section} data-library-surface="load">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Load a base project</p><h2 id="load-title">LOAD</h2></div>
            <p>Open a saved working story below to continue its Mind Map, World Map, World Agent decisions, and other project work. Start a fresh Afterglow copy from EXAMPLES. Local media is never attached or made canon without your choice.</p>
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
            <div className={styles.empty}><h3>No saved working stories yet.</h3><p>Use EXAMPLES for a fresh Afterglow copy, NEW to start a clean project, or IMPORT EXPORT to bring in an existing story.</p></div>
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
            <div><p className={styles.eyebrow}>{isExamples ? "Packaged reference story" : "Supported starter structures"}</p><h2 id={`${destination}-title`}>{isExamples ? "EXAMPLES" : "PRESETS"}</h2></div>
            <p>{isExamples
              ? "This is a complete reference story supplied with PlotPickle. Loading creates a user-owned working copy while the packaged source remains unchanged. Changes made in your working copy can be saved locally and revisited later for learning and comparison."
              : "Presets provide a starting structure for a genre or story type. They fill only supported starter fields, keep creative decisions with the Human, and create normal user-owned working projects."}</p>
          </div>
          <div className={isExamples ? styles.exampleGrid : styles.grid}>{visibleCatalog.map((item) => <CatalogCard item={item} key={item.id} onLoad={() => setPending({ kind: "catalog", sourceKind: isExamples ? "example" : "preset", item })} posterUrls={isExamples ? afterglowPosters : undefined} sourceKind={isExamples ? "example" : "preset"} />)}</div>
        </section>
      );
    }

    if (destination === "avery") {
      return (
        <section aria-labelledby="avery-title" className={styles.section} data-library-surface="avery">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Writer-in-Residence</p><h2 id="avery-title">AVERY</h2></div>
            <p>Open saved Avery stories here. Reconstructed working copies remain separate from Human-owned Library stories.</p>
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

  const selectedDirectoryItem = DESTINATIONS[directorySelectedIndex];

  return (
    <main className={styles.workspace} aria-labelledby="library-title" data-library-workspace="v2">
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>Local story library</p><h1 id="library-title">Library</h1><p>Your stories first</p></div>
        <aside aria-label="Active story"><span>Active story</span><strong>{activeProject?.title || "No active story"}</strong><small>{activeProject ? "Your work stays local and is saved before every story switch." : "Create, restore, or import a story when you are ready."}</small></aside>
      </header>

      <div className={styles.libraryLayout} data-library-layout="single-surface" style={{ display: "block" }}>
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

        <section
          className={`pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs ${styles.libraryDirectory}`}
          aria-label="Library menu"
          data-library-directory="keyboard-directory"
          data-skin-menu="library"
          data-skin-menu-indicators="hidden"
        >
          <div className="pp-skin-v1-bbs" data-skin-reference-panel="standard" data-skin-visual-treatment="flat-approved">
            <div className="pp-skin-v1-dashboard-title" data-skin-v1-local-chrome="decorative-title">*** LIBRARY DIRECTORY ***</div>
            <p className={`${styles.eyebrow} ${styles.libraryDirectoryEyebrow}`}>Library directory</p>
            <div className={`pp-skin-v1-menu pp-skin-v1-dashboard-menu ${styles.libraryDirectoryMenu}`} role="listbox" aria-label="Library directory">
              {DESTINATIONS.map((item, index) => {
                const selected = index === directorySelectedIndex;
                const count = item.id === "load" ? stories.length : item.id === "archive" ? archivedCount : null;
                const description = count === null ? item.description : `${item.description} (${count})`;
                const accessibleLabel = count === null ? item.label : `${item.label} (${count})`;
                return (
                  <button
                    key={item.id}
                    ref={(node) => { directoryItemRefs.current[index] = node; }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    autoFocus={selected}
                    className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item ${styles.libraryDirectoryItem}${selected ? " is-selected" : ""}`}
                    data-library-nav={item.id}
                    data-library-shortcut={item.shortcut}
                    data-skin-menu-row={item.id}
                    data-skin-menu-shortcut={item.shortcut}
                    data-skin-menu-connected="true"
                    aria-keyshortcuts={item.shortcut}
                    aria-label={accessibleLabel}
                    title={`${description} · Shortcut ${item.shortcut}`}
                    onClick={() => activateDestination(index)}
                    onKeyDown={(event) => handleDirectoryKeyDown(event, index)}
                  >
                    <span className={styles.libraryDirectoryLabel}>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="pp-skin-v1-dashboard-reminder" aria-live="polite">Selected: {selectedDirectoryItem?.label || "LOAD"}</p>
          </div>
        </section>

        <section
          className={styles.libraryColumn}
          aria-label={`${selectedDirectoryItem?.label || destination} Library destination`}
          data-library-destination={destination}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              void openActiveProject().catch((error) => setNotice(error instanceof Error ? error.message : "PlotPickle could not save the loaded story."));
            }
          }}
        >
          <button
            type="button"
            data-skin-v1-local-return="true"
            onClick={() => void openActiveProject().catch((error) => setNotice(error instanceof Error ? error.message : "PlotPickle could not save the loaded story."))}
          >Back to Dashboard</button>
          {renderSurface()}
        </section>
      </div>

      {pending ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <section aria-labelledby="library-load-title" aria-modal="true" className={styles.dialog} role="dialog">
            <p className={styles.eyebrow}>Safe project load</p><h2 id="library-load-title">Load this project?</h2>
            <p>{pending.kind === "story"
              ? "PlotPickle opens this exact saved working story, including its saved World Agent decisions and World Map state. Local media recovery remains a separate optional step."
              : "PlotPickle creates a new working copy from the selected packaged reference. Local resources are a separate optional choice on the next step."}</p><strong>{pending.item.title}</strong>
            {pending.kind === "catalog" && pending.item.referenceLoader === "afterglow-v9-foundations" ? <small>The packaged Afterglow reference becomes a fresh working copy. Saved World Agent decisions from another working copy are not imported. Existing local media is offered separately and is never treated as canon automatically.</small> : null}
            <div><button className={styles.secondaryButton} disabled={loadingReference} onClick={() => setPending(null)} type="button">Keep Current Story</button><button className={styles.primaryButton} disabled={loadingReference} onClick={() => void confirmLoad()} type="button">{loadingReference ? "Loading Project…" : pending.kind === "story" ? "Open Saved Story" : "Start Fresh Copy"}</button></div>
          </section>
        </div>
      ) : null}

      {recovery ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <section aria-labelledby="library-recovery-title" aria-modal="true" className={`${styles.dialog} ${styles.recoveryDialog}`} role="dialog" onKeyDown={(event) => {
            if (event.key === "Escape" && !restoringResources && !rescanningResources) {
              event.preventDefault();
              event.stopPropagation();
              useProjectDefaults();
            }
          }}>
            <button aria-label="Close local resource recovery" className={styles.recoveryClose} disabled={restoringResources || rescanningResources} onClick={useProjectDefaults} type="button">×</button>
            <p className={styles.eyebrow}>Load Session · base revision {recovery.baseline.baseRevision}</p>
            <h2 id="library-recovery-title">Restore local resources?</h2>
            <p><strong>{recovery.project.title}</strong> is loaded. You can keep the project defaults or add selected local Storyboard frames, World Map posters, and saved World Map character visuals. This restores media only; World Agent decisions and other story canon come from the saved working story itself.</p>
            <div className={styles.recoverySummary}>
              <span><b>{recovery.inventory.storyboardResources.length}</b> recoverable Storyboard frame{recovery.inventory.storyboardResources.length === 1 ? "" : "s"}</span>
              <span><b>{recovery.inventory.posterResources.length}</b> recoverable World Map poster{recovery.inventory.posterResources.length === 1 ? "" : "s"}</span>
              <span><b>{recovery.inventory.characterResources.length}</b> recoverable World Map character image{recovery.inventory.characterResources.length === 1 ? "" : "s"}</span>
              <span><b>{recovery.inventory.unclassifiedAssets.length}</b> other local asset{recovery.inventory.unclassifiedAssets.length === 1 ? "" : "s"} inventoried only</span>
            </div>
            {recovery.scanError ? (
              <div>
                <p role="alert">{recovery.scanError} You can retry the scan or continue with project defaults.</p>
                <button
                  className={styles.secondaryButton}
                  disabled={rescanningResources || restoringResources}
                  onClick={() => void retryLocalResourceScan()}
                  type="button"
                >{rescanningResources ? "Scanning Again…" : "Retry Resource Scan"}</button>
              </div>
            ) : null}
            {recovery.inventory.groups.length ? (
              <fieldset className={styles.recoveryGroups}>
                <legend>Resource groups</legend>
                <button
                  className={styles.secondaryButton}
                  disabled={restoringResources || rescanningResources || !recovery.inventory.groups.length}
                  onClick={loadAllLocalResources}
                  type="button"
                >{restoringResources ? "Restoring All…" : "Load All"}</button>
                {recovery.inventory.groups.map((group) => (
                  <label key={group.originProjectId}>
                    <input
                      checked={selectedRecoveryOrigins.includes(group.originProjectId)}
                      disabled={restoringResources || rescanningResources}
                      onChange={() => toggleRecoveryOrigin(group.originProjectId)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{group.exactProject ? "Current project resources" : "Legacy"}</strong>
                      <small>{group.resources.filter((resource) => resource.kind === "storyboard-frame").length} frame(s) · {group.resources.filter((resource) => resource.kind === "worldmap-poster").length} poster(s) · {group.resources.filter((resource) => resource.kind === "worldmap-character").length} character image(s) · origin <code>{group.originProjectId}</code>{group.exactProject ? " · selected automatically" : " · requires your explicit selection"}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : <p>No recoverable Storyboard frames, World Map posters, or saved World Map character visuals were found. The local asset folder remains unchanged.</p>}
            <p className={styles.recoveryPolicy}>Local media restore is additive. It does not copy World Agent answers, overwrite project defaults, invent approvals, promote story canon, or resolve story-data conflicts. Storyboard and World Map character media restore as Locked only when exact saved Library metadata proves the prior Human lock; otherwise they remain saved/draft. If a cloud/current story revision later differs from base revision {recovery.baseline.baseRevision}, canonical story changes require reconciliation rather than last-write-wins.</p>
            <div className={styles.recoveryActions}>
              <button className={styles.secondaryButton} disabled={restoringResources || rescanningResources} onClick={useProjectDefaults} type="button">Use Project Defaults</button>
              <button className={styles.primaryButton} disabled={restoringResources || rescanningResources || !selectedRecoveryOrigins.length} onClick={restoreSelectedLocalResources} type="button">{restoringResources ? "Restoring…" : "Restore Local Resources"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
