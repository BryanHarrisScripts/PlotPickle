import { readFile, rm, writeFile } from "node:fs/promises";

const pagePath = new URL("../app/page.tsx", import.meta.url);
const hookPath = new URL("../app/use-afterglow-persistence.ts", import.meta.url);

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Missing patch marker: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Patch marker is not unique: ${label}`);
  return `${source.slice(0, first)}${to}${source.slice(first + from.length)}`;
}

let page = await readFile(pagePath, "utf8");

page = replaceOnce(
  page,
  'import DashboardCommandCentre from "./dashboard-command-centre";\n',
  'import DashboardCommandCentre from "./dashboard-command-centre";\nimport AfterglowExampleBoundary from "./afterglow-example-boundary";\n',
  "Afterglow boundary component import",
);

page = replaceOnce(
  page,
  'import { AFTERGLOW_PROJECT_ID } from "@/lib/afterglow-persistence";\nimport { useConnectionStatus } from "./use-connection-status";\nimport { useAfterglowPersistence } from "./use-afterglow-persistence";\n',
  'import {\n  AFTERGLOW_EXAMPLE_ACTIVE_KEY,\n  afterglowCopyFileName,\n  createAfterglowEditableCopy,\n  isAfterglowExampleProject,\n} from "@/lib/afterglow-example";\nimport { useConnectionStatus } from "./use-connection-status";\n',
  "Afterglow imports",
);

page = replaceOnce(
  page,
  '  const [showLanding, setShowLanding] = useState(true);\n  const fileInputRef = useRef<HTMLInputElement>(null);\n  const connectionState = useConnectionStatus(project, saveState);\n  const afterglowPersistence = useAfterglowPersistence(project.id);\n',
  '  const [showLanding, setShowLanding] = useState(true);\n  const [afterglowCopyWorking, setAfterglowCopyWorking] = useState(false);\n  const fileInputRef = useRef<HTMLInputElement>(null);\n  const connectionState = useConnectionStatus(project, saveState);\n  const afterglowExample = isAfterglowExampleProject(project);\n',
  "Afterglow state",
);

page = replaceOnce(
  page,
  '          const normalized = normalizePlotPickleProject(parsed);\n          if (normalized) setProject(synchronizeScreenplaySceneReferences(normalized, normalized.blocks));\n',
  '          const normalized = normalizePlotPickleProject(parsed);\n          if (normalized) {\n            const exampleWasDeliberatelyOpen = window.localStorage.getItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY) === "true";\n            const restored = isAfterglowExampleProject(normalized) && !exampleWasDeliberatelyOpen\n              ? createAfterglowEditableCopy(normalized, { title: `${normalized.metadata.title} — Recovered Copy` })\n              : isAfterglowExampleProject(normalized)\n                ? createAfterglowProject()\n                : normalized;\n            setProject(synchronizeScreenplaySceneReferences(restored, restored.blocks));\n            if (isAfterglowExampleProject(normalized) && !exampleWasDeliberatelyOpen) {\n              window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);\n              setToast("A previously editable Afterglow project was preserved as a new local copy. The bundled example is now read-only.");\n            }\n          }\n',
  "Hydration migration",
);

page = replaceOnce(
  page,
  '  useEffect(() => {\n    if (!hydrated) return;\n    const timer = window.setTimeout(() => {\n      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));\n      setSaveState("Saved on this device");\n    }, 300);\n    return () => window.clearTimeout(timer);\n  }, [project, hydrated]);\n\n  useEffect(() => {\n    if (!hydrated || !afterglowPersistence.enabled || project.id !== AFTERGLOW_PROJECT_ID) return;\n    let cancelled = false;\n    const timer = window.setTimeout(() => {\n      void afterglowPersistence.save(project).then((saved) => {\n        if (saved && !cancelled) setSaveState("Saved in persistent Afterglow project folder");\n      });\n    }, 900);\n    return () => {\n      cancelled = true;\n      window.clearTimeout(timer);\n    };\n  }, [afterglowPersistence.enabled, afterglowPersistence.save, hydrated, project]);\n',
  '  useEffect(() => {\n    if (!hydrated) return;\n    const timer = window.setTimeout(() => {\n      if (isAfterglowExampleProject(project)) {\n        window.localStorage.setItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY, "true");\n        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createAfterglowProject()));\n        setSaveState("Read-only PlotPickle example");\n        return;\n      }\n      window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);\n      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));\n      setSaveState("Saved on this device");\n    }, 300);\n    return () => window.clearTimeout(timer);\n  }, [project, hydrated]);\n',
  "Read-only autosave boundary",
);

page = replaceOnce(
  page,
  '  function commit(next: PlotPickleProject) {\n    setSaveState("Saving…");\n',
  '  function commit(next: PlotPickleProject) {\n    if (isAfterglowExampleProject(project) && isAfterglowExampleProject(next)) {\n      setSaveState("Read-only PlotPickle example");\n      setToast("Afterglow is a read-only example. Choose Make My Own Copy before changing canon, images, dialogue or project settings.");\n      return;\n    }\n    if (!isAfterglowExampleProject(next)) window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);\n    setSaveState("Saving…");\n',
  "Commit guard",
);

page = replaceOnce(
  page,
  '    const blank = createBlankProject();\n    setSaveState("Saving…");\n',
  '    const blank = createBlankProject();\n    window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);\n    setSaveState("Saving…");\n',
  "New project example marker",
);

const oldLoad = `  async function loadAfterglow() {
    if (completion > 0 && project.id !== "afterglow-echoes-of-sentience" && !window.confirm("Replace the current project with the Afterglow example? Export first if you want a backup.")) return;
    setSaveState(afterglowPersistence.enabled ? "Opening persistent Afterglow project…" : "Saving…");
    try {
      const persistent = await afterglowPersistence.load();
      const candidate = persistent ? normalizePlotPickleProject(persistent.project) : createAfterglowProject();
      if (!candidate) throw new Error("The saved Afterglow project could not be normalized and was not opened.");
      const afterglow = synchronizeScreenplaySceneReferences(candidate, candidate.blocks);
      setProject(afterglow);
      setSelectedCharacterId("ren");
      setSelectedBlockNumber(1);
      setSelectedMiniBlockNumber(1);
      setActiveTab("planner");
      setActiveSection("overview");
      setSaveState(persistent ? "Saved in persistent Afterglow project folder" : "Saving…");
      setToast(persistent?.message || "Afterglow loaded across the Story Planner, all 96 Treatment positions, and Visual Storyboard context. Unreconciled material is clearly marked.");
    } catch (error) {
      setSaveState("Saved on this device");
      setToast(error instanceof Error ? error.message : "Afterglow could not be loaded.");
    }
  }
`;
const newLoad = `  async function loadAfterglow() {
    if (completion > 0 && !isAfterglowExampleProject(project) && !window.confirm("Replace the current project with the read-only Afterglow example? Export first if you want a backup.")) return;
    const candidate = createAfterglowProject();
    const afterglow = synchronizeScreenplaySceneReferences(candidate, candidate.blocks);
    window.localStorage.setItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY, "true");
    setProject(afterglow);
    setSelectedCharacterId("ren");
    setSelectedBlockNumber(1);
    setSelectedMiniBlockNumber(1);
    setActiveTab("planner");
    setActiveSection("overview");
    setSaveState("Read-only PlotPickle example");
    setToast("Afterglow — PlotPickle Example Story is open read-only. Explore freely, then choose Make My Own Copy before editing.");
  }
`;
page = replaceOnce(page, oldLoad, newLoad, "Bundled Afterglow loader");

const oldToggleStart = page.indexOf("  async function toggleAfterglowGitHub(enabled: boolean) {");
const exportStart = page.indexOf("  function exportProject() {", oldToggleStart);
if (oldToggleStart < 0 || exportStart < 0) throw new Error("Missing Afterglow GitHub toggle block");
const replacementActions = `  async function saveProjectToLocalLibrary(next: PlotPickleProject) {
    const response = await fetch("/api/local-projects/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: next, fileName: afterglowCopyFileName(next) }),
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() as { message?: string } : {};
    if (!response.ok) throw new Error(payload.message || "The Afterglow copy could not be saved to the local project library.");
  }

  async function makeAfterglowCopy() {
    if (!isAfterglowExampleProject(project) || afterglowCopyWorking) return;
    setAfterglowCopyWorking(true);
    setSaveState("Creating editable local copy…");
    try {
      const copy = synchronizeScreenplaySceneReferences(createAfterglowEditableCopy(project), project.blocks);
      await saveProjectToLocalLibrary(copy);
      window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);
      setProject(copy);
      setSelectedCharacterId(copy.characters[0]?.id ?? "");
      setSelectedBlockNumber(1);
      setSelectedMiniBlockNumber(1);
      setActiveTab("planner");
      setActiveSection("overview");
      setSaveState("Saved in local project library");
      setToast("Your editable Afterglow copy has a new project ID, local PPF and rolling-backup path. No GitHub repository is connected until you choose one.");
      await connectionState.refresh();
    } catch (error) {
      setSaveState("Read-only PlotPickle example");
      setToast(error instanceof Error ? error.message : "The editable Afterglow copy could not be created.");
    } finally {
      setAfterglowCopyWorking(false);
    }
  }

  function resetAfterglow() {
    if (!isAfterglowExampleProject(project)) return;
    if (!window.confirm("Reset the bundled Afterglow example to its original PlotPickle state? Your separate copies are not affected.")) return;
    const candidate = createAfterglowProject();
    const reset = synchronizeScreenplaySceneReferences(candidate, candidate.blocks);
    window.localStorage.setItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY, "true");
    setProject(reset);
    setSelectedCharacterId("ren");
    setSelectedBlockNumber(1);
    setSelectedMiniBlockNumber(1);
    setActiveTab("planner");
    setActiveSection("overview");
    setSaveState("Read-only PlotPickle example");
    setToast("The bundled Afterglow example was reset. Your local copies and repositories were not changed.");
  }

  function openAfterglowGraphicNovel() {
    setActiveTab("pitch");
    setToast("Opened Afterglow’s sample Graphic Novel workspace. The example remains read-only until you make a copy.");
  }

`;
page = `${page.slice(0, oldToggleStart)}${replacementActions}${page.slice(exportStart)}`;

page = replaceOnce(
  page,
  '    setSaveState("Saving…");\n    const synchronized = synchronizeScreenplaySceneReferences(imported, imported.blocks);\n',
  '    window.localStorage.removeItem(AFTERGLOW_EXAMPLE_ACTIVE_KEY);\n    setSaveState("Saving…");\n    const synchronized = synchronizeScreenplaySceneReferences(imported, imported.blocks);\n',
  "Imported screenplay marker",
);

page = replaceOnce(
  page,
  '      </div>\n\n      {reportReturnSection && activeTab !== "reports" ? (\n',
  '      </div>\n\n      {afterglowExample ? (\n        <AfterglowExampleBoundary\n          working={afterglowCopyWorking}\n          onMakeCopy={() => { void makeAfterglowCopy(); }}\n          onReset={resetAfterglow}\n          onOpenGraphicNovel={openAfterglowGraphicNovel}\n        />\n      ) : null}\n\n      {reportReturnSection && activeTab !== "reports" ? (\n',
  "Afterglow banner placement",
);

page = replaceOnce(
  page,
  '            afterglow={afterglowPersistence.dashboard}\n            afterglowWorking={afterglowPersistence.working}\n            afterglowMessage={afterglowPersistence.message}\n',
  '            afterglowCopyWorking={afterglowCopyWorking}\n',
  "Dashboard Afterglow state props",
);

page = replaceOnce(
  page,
  '            onLoadAfterglow={() => { void loadAfterglow(); }}\n            onToggleAfterglowGitHub={(enabled) => { void toggleAfterglowGitHub(enabled); }}\n',
  '            onLoadAfterglow={() => { void loadAfterglow(); }}\n            onMakeAfterglowCopy={() => { void makeAfterglowCopy(); }}\n            onResetAfterglow={resetAfterglow}\n            onOpenAfterglowGraphicNovel={openAfterglowGraphicNovel}\n',
  "Dashboard Afterglow actions",
);

for (const forbidden of [
  "useAfterglowPersistence",
  "afterglowPersistence.",
  "toggleAfterglowGitHub",
  "onToggleAfterglowGitHub",
]) {
  if (page.includes(forbidden)) throw new Error(`Removed Afterglow persistence contract remains: ${forbidden}`);
}

await writeFile(pagePath, page, "utf8");
await rm(hookPath);
