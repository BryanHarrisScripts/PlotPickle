from pathlib import Path
import re

page_path = Path("app/page.tsx")
page = page_path.read_text()
if 'import DashboardCommandCentre from "./dashboard-command-centre";' in page:
    print("Issue #113 page integration is already applied.")
else:
    page = page.replace(
        'import MarketingSplash from "./marketing-splash";\n',
        'import MarketingSplash from "./marketing-splash";\nimport ApplicationShellHeader from "./application-shell-header";\nimport DashboardCommandCentre from "./dashboard-command-centre";\n',
        1,
    )
    page = page.replace(
        'import { PRODUCT_COMPONENTS, PRODUCT_NAVIGATION, type ProductNavigationId } from "@/lib/product-direction";',
        'import { PRODUCT_COMPONENTS, type ProductNavigationId } from "@/lib/product-direction";',
        1,
    )
    page, count = re.subn(
        r'\nconst mainTabs = PRODUCT_NAVIGATION;\n\ntype HealthTone = "green" \| "yellow" \| "red";\ntype DashboardStatus = \{ id: string; label: string; tone: HealthTone; status: string; detail: string \};\nconst healthMeta: Record<HealthTone, \{ icon: string; meaning: string \}> = \{[\s\S]*?\n\};\n',
        '\n',
        page,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not remove the legacy Dashboard health contract")
    page, count = re.subn(
        r'\n  const openAlerts = storySections\.filter\([\s\S]*?\n  \];',
        '',
        page,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not remove the legacy Dashboard status calculation")
    page, count = re.subn(
        r'      <header className="topbar">[\s\S]*?      </header>\n\n      <input ref=\{fileInputRef\}',
        '''      <ApplicationShellHeader
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onOpenLanding={() => setShowLanding(true)}
        onProjectAction={(action) => {
          if (action === "new-project") createNewProject();
          else if (action === "import") fileInputRef.current?.click();
          else if (action === "export") exportProject();
          else loadAfterglow();
        }}
      />

      <input ref={fileInputRef}''',
        page,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not replace the inline application header")
    page, count = re.subn(
        r'        \{activeTab === "dashboard" \? \([\s\S]*?        \) : null\}\n\n        \{activeTab === "instructions"',
        '''        {activeTab === "dashboard" ? (
          <DashboardCommandCentre
            project={project}
            saveState={saveState}
            onNavigate={(workspace, section) => {
              setActiveTab(workspace);
              if (workspace === "planner" && section) setActiveSection(section as StorySection);
            }}
            onOpenBlock={(number) => openBlock(number, "planner")}
          />
        ) : null}

        {activeTab === "instructions"''',
        page,
        count=1,
    )
    if count != 1:
        raise SystemExit("Could not replace the legacy Dashboard workspace")
    page_path.write_text(page)

selector_path = Path("lib/dashboard-command-centre.ts")
selector = selector_path.read_text()
selector = selector.replace(
    'const activePlugins = options.settings.plugins.filter((plugin) => plugin.status !== "coming-soon").length;',
    'const activePlugins = options.settings.plugins.filter((plugin) => String(plugin.status) !== "coming-soon").length;',
)
selector = selector.replace('section: "plugins"', 'section: "collaboration"')
selector = selector.replace('section: "storage"', 'section: "collaboration"')
selector_path.write_text(selector)

settings_path = Path("app/settings-panel.tsx")
settings = settings_path.read_text()
if "plotpickle:settings-section" not in settings:
    settings = settings.replace(
        'const SETTINGS_STORAGE_KEY = "plotpickle.settings.v1";\n',
        'const SETTINGS_STORAGE_KEY = "plotpickle.settings.v1";\nconst SETTINGS_SECTION_KEY = "plotpickle.settings.section";\n',
        1,
    )
    anchor = '''  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);'''
    replacement = '''  useEffect(() => {
    function selectRequestedSection(value: string | null) {
      if (value === "collaboration" || value === "ai" || value === "music") setSection(value);
    }
    selectRequestedSection(window.sessionStorage.getItem(SETTINGS_SECTION_KEY));
    window.sessionStorage.removeItem(SETTINGS_SECTION_KEY);
    const handleSectionRequest = (event: Event) => selectRequestedSection((event as CustomEvent<string>).detail);
    window.addEventListener("plotpickle:settings-section", handleSectionRequest);
    return () => window.removeEventListener("plotpickle:settings-section", handleSectionRequest);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);'''
    if anchor not in settings:
        raise SystemExit("Could not find Settings hydration effect")
    settings = settings.replace(anchor, replacement, 1)
    settings_path.write_text(settings)

Path("tests/proposed-primary-menu.test.mjs").write_text('''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the primary menu uses the approved short labels in order", async () => {
  const contract = await source("lib/product-direction.ts");
  const labels = ["Dashboard", "Introduction", "Learn", "Plan", "Write", "Storyboard", "Refine", "Reports", "Settings"];
  let lastIndex = -1;
  for (const label of labels) {
    const index = contract.indexOf(`label: "${label}"`);
    assert.ok(index > lastIndex, `Missing or out-of-order menu label: ${label}`);
    lastIndex = index;
  }
});

test("the application renders the shared shell and command-centre Dashboard behind the splash", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /ApplicationShellHeader/);
  assert.match(page, /DashboardCommandCentre/);
  assert.match(page, /type MainTab = ProductNavigationId/);
  assert.match(page, /useState<MainTab>\\("dashboard"\\)/);
  assert.match(page, /const \\[showLanding, setShowLanding\\] = useState\\(true\\)/);
  assert.equal((page.match(/ref={fileInputRef}/g) ?? []).length, 1);
  assert.doesNotMatch(page, /className="dashboard-actions"/);
  assert.doesNotMatch(page, /const dashboardStatuses/);
});

test("the shared header owns orientation, workflow, project actions and configuration", async () => {
  const shell = await source("app/application-shell-header.tsx");
  for (const zone of ["shell-zone-orientation", "shell-zone-workflow", "shell-zone-project-actions", "shell-zone-configuration"]) assert.ok(shell.includes(zone), `Missing shell zone: ${zone}`);
  assert.match(shell, /onOpenLanding/);
  assert.match(shell, /PROJECT_ACTIONS\\.map/);
  assert.match(shell, /Open the PlotPickle marketing page/);
});

test("the Dashboard command centre has responsive local styling", async () => {
  const css = await source("app/dashboard-command-centre.module.css");
  assert.match(css, /grid-template-columns:250px minmax\\(0,1fr\\)/);
  assert.match(css, /@media\\(max-width:1100px\\)/);
  assert.match(css, /@media\\(max-width:700px\\)/);
  assert.match(css, /tone-green/);
  assert.match(css, /tone-yellow/);
  assert.match(css, /tone-red/);
});
''')

print("Issue #113 integration patch applied.")
