from __future__ import annotations

import json
import re
from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, source: str) -> None:
    Path(path).write_text(source, encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise SystemExit(f"Expected source block not found: {label}")
    return source.replace(old, new, 1)


# Dashboard hosts status only. Configuration panels move into Settings.
path = "app/layout.tsx"
source = read(path)
source = source.replace('import ConfigurationDashboardHost from "./configuration-dashboard-host";\n', "", 1)
source = source.replace("        <ConfigurationDashboardHost />\n", "", 1)
write(path, source)

# Independent Settings targets and component-owned configuration surfaces.
path = "app/settings-panel.tsx"
source = read(path)
source = replace_once(
    source,
    'import LegacySettingsPanel from "./settings-panel-legacy";\n',
    'import LegacySettingsPanel from "./settings-panel-legacy";\nimport WritingAssistantConsole from "./writing-assistant-console";\nimport MediaRoutingPanel from "./media-routing-panel";\nimport H3NativePanel from "./h3-native-panel";\n',
    "settings component imports",
)
source = replace_once(
    source,
    'type SettingsTarget = LegacySection | "sitemap";\n',
    'type ComponentSection = "ollama" | "openai" | "minimax" | "comfyui";\ntype SettingsTarget = LegacySection | ComponentSection | "sitemap";\n',
    "settings target union",
)
helper_anchor = '''  function openSitemapWorkspace(id: string) {
    window.dispatchEvent(new CustomEvent("plotpickle:navigate-workspace", { detail: id }));
  }
'''
helper = '''  function openSitemapWorkspace(id: string) {
    window.dispatchEvent(new CustomEvent("plotpickle:navigate-workspace", { detail: id }));
  }

  function openComponentTarget(value: string) {
    const normalized = value.toLowerCase();
    const target: ComponentSection = normalized.includes("ollama")
      ? "ollama"
      : normalized.includes("minimax")
        ? "minimax"
        : normalized.includes("comfy")
          ? "comfyui"
          : "openai";
    const next = itemForTarget(target);
    if (!next) return;
    setPlayhouseView("advanced");
    setActiveId(next.item.id);
    if (next.system) setExpandedSystem(next.system.id);
    internalTarget.current = target;
    window.sessionStorage.setItem(SETTINGS_SECTION_KEY, target);
    window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: target }));
  }
'''
source = replace_once(source, helper_anchor, helper, "component target helper")
render_anchor = '''          {activeItem.href ? (
            <section className={styles.routeCard}>
'''
render = '''          {activeItem.target === "ollama" ? (
            <div className={styles.embeddedMode} id="settings-component-ollama">
              <WritingAssistantConsole onManage={openComponentTarget} focusProvider="ollama" />
            </div>
          ) : activeItem.target === "openai" ? (
            <div className={styles.embeddedMode} id="settings-component-openai">
              <LegacySettingsPanel
                project={project}
                onProjectChange={onProjectChange}
                connections={connections}
                onConnectionChange={onConnectionChange}
                forcedSection="ai"
                forcedProvider="openai"
              />
              <WritingAssistantConsole onManage={openComponentTarget} focusProvider="openai" />
            </div>
          ) : activeItem.target === "minimax" ? (
            <div className={styles.embeddedMode} id="settings-component-minimax">
              <LegacySettingsPanel
                project={project}
                onProjectChange={onProjectChange}
                connections={connections}
                onConnectionChange={onConnectionChange}
                forcedSection="ai"
                forcedProvider="minimax"
              />
              <WritingAssistantConsole onManage={openComponentTarget} focusProvider="minimax" />
            </div>
          ) : activeItem.target === "comfyui" ? (
            <div className={styles.embeddedMode} id="settings-component-comfyui">
              <MediaRoutingPanel onManage={openComponentTarget} />
              <H3NativePanel />
            </div>
          ) : activeItem.href ? (
            <section className={styles.routeCard}>
'''
source = replace_once(source, render_anchor, render, "independent component renders")
write(path, source)

# Legacy provider form can be mounted as a focused OpenAI or MiniMax section.
path = "app/settings-panel-legacy.tsx"
source = read(path)
source = replace_once(
    source,
    '''export default function SettingsPanel({
  project,
  onProjectChange,
  connections,
  onConnectionChange,
}: {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  connections: ConnectionStatusSnapshot;
  onConnectionChange: () => void | Promise<void>;
}) {
  const [section, setSection] = useState<SettingsSection>("general");
''',
    '''export default function SettingsPanel({
  project,
  onProjectChange,
  connections,
  onConnectionChange,
  forcedSection,
  forcedProvider,
}: {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  connections: ConnectionStatusSnapshot;
  onConnectionChange: () => void | Promise<void>;
  forcedSection?: SettingsSection;
  forcedProvider?: PlotPickleSettings["ai"]["provider"];
}) {
  const [section, setSection] = useState<SettingsSection>(forcedSection ?? "general");
''',
    "legacy focused props",
)
source = replace_once(
    source,
    '''  useEffect(() => {
    function selectRequestedSection(value: string | null) {
''',
    '''  useEffect(() => {
    if (forcedSection) {
      setSection(forcedSection);
      return;
    }
    function selectRequestedSection(value: string | null) {
''',
    "legacy forced section",
)
source = source.replace("  }, []);\n\n  useEffect(() => {\n    const timer = window.setTimeout(() => {", "  }, [forcedSection]);\n\n  useEffect(() => {\n    const timer = window.setTimeout(() => {", 1)
provider_effect_anchor = '''  const liveProvider = settings.ai.provider !== "disabled" && settings.ai.provider !== "manual";
  const connectionMatchesProvider = aiConnection.provider === settings.ai.provider;
'''
provider_effect = '''  const liveProvider = settings.ai.provider !== "disabled" && settings.ai.provider !== "manual";
  const connectionMatchesProvider = aiConnection.provider === settings.ai.provider;

  useEffect(() => {
    if (!hydrated || !forcedProvider || settings.ai.provider === forcedProvider) return;
    const nextPreset = providerPresets.find((item) => item.kind === forcedProvider);
    setSettings((current) => ({
      ...current,
      ai: {
        provider: forcedProvider,
        baseUrl: nextPreset?.defaultConfig.baseUrl ?? "",
        textModel: nextPreset?.defaultConfig.models.text ?? "",
        imageModel: nextPreset?.defaultConfig.models.image ?? "",
        videoModel: nextPreset?.defaultConfig.models.video ?? "",
      },
    }));
    setSessionKey("");
    setNotice("");
  }, [forcedProvider, hydrated, settings.ai.provider]);
'''
source = replace_once(source, provider_effect_anchor, provider_effect, "forced provider effect")
source = replace_once(
    source,
    "                {providerPresets.map((item) => (\n",
    "                {providerPresets.filter((item) => !forcedProvider || item.kind === forcedProvider).map((item) => (\n",
    "focused provider cards",
)
source = source.replace(
    '<SectionHeading eyebrow="Story & Art" title="Explore ideas and develop visuals only when you choose." description="Optional LLM and text-to-image assistance can support story ideas, plot points, character designs, storyboards and concept art. PlotPickle\'s complete visual storyworld remains usable with no AI connection." />',
    '<SectionHeading eyebrow={forcedProvider ? `${preset?.label || forcedProvider} settings` : "Story & Art"} title={forcedProvider ? `Configure and test ${preset?.label || forcedProvider}.` : "Explore ideas and develop visuals only when you choose."} description="Connection details, models, testing and repair guidance stay inside this provider section. PlotPickle remains usable with no AI connection." />',
    1,
)
write(path, source)

# Writing Assistant can be focused to one provider inside that provider's Settings section.
path = "app/writing-assistant-console.tsx"
source = read(path)
source = replace_once(
    source,
    'export default function WritingAssistantConsole({ onManage }: { onManage: (target: string) => void }) {\n',
    'export default function WritingAssistantConsole({ onManage, focusProvider }: { onManage: (target: string) => void; focusProvider?: ProviderId }) {\n',
    "writing assistant focus prop",
)
source = replace_once(
    source,
    '  const activeProfile = useMemo(() => {\n',
    '  const visibleProviders = focusProvider ? [focusProvider] : providerOrder;\n\n  const activeProfile = useMemo(() => {\n',
    "visible providers",
)
source = source.replace("        {providerOrder.map((provider) => {", "        {visibleProviders.map((provider) => {", 1)
source = replace_once(
    source,
    '''        <article data-state={status?.activeProvider === "disabled" ? "off" : "optional"} data-active={status?.activeProvider === "disabled" || undefined}>
          <button type="button" className={styles.providerButton} onClick={() => void selectProvider("disabled")} disabled={working || !status}>
            <span className={styles.providerLight} aria-hidden="true" />
            <span><strong>Off</strong><small>Use PlotPickle manually without text generation.</small></span>
            <em>{status?.activeProvider === "disabled" ? "Selected" : "Available"}</em>
          </button>
        </article>
''',
    '''        {!focusProvider ? (
          <article data-state={status?.activeProvider === "disabled" ? "off" : "optional"} data-active={status?.activeProvider === "disabled" || undefined}>
            <button type="button" className={styles.providerButton} onClick={() => void selectProvider("disabled")} disabled={working || !status}>
              <span className={styles.providerLight} aria-hidden="true" />
              <span><strong>Off</strong><small>Use PlotPickle manually without text generation.</small></span>
              <em>{status?.activeProvider === "disabled" ? "Selected" : "Available"}</em>
            </button>
          </article>
        ) : null}
''',
    "focused off card",
)
source = source.replace(
    '<h2 id="writing-assistant-title">Writing Assistant</h2>',
    '<h2 id="writing-assistant-title">{focusProvider ? `${providerCopy[focusProvider].label} Settings` : "Writing Assistant"}</h2>',
    1,
)
write(path, source)

# Dashboard is read-only red/yellow/green with one internal Settings link per component.
path = "app/setup-connections-dashboard.tsx"
source = read(path)
source = source.replace('import { requestConnectionStatusRefresh } from "./use-connection-status";\n', "", 1)
source = source.replace('type SetupTone = "green" | "grey" | "yellow" | "red";', 'type SetupTone = "green" | "yellow" | "red";', 1)
source = source.replace('  grey: { symbol: "○", meaning: "Optional and not configured" },\n', "", 1)
source = source.replace('  return "grey";\n}', '  return "yellow";\n}', 1)
source = source.replace('  return optional ? "Optional — not configured" : "Not configured";', '  return optional ? "Setup available" : "Not configured";', 1)
source = source.replace('  const [testing, setTesting] = useState(false);\n', "", 1)
source, count = re.subn(r'\n  async function testAllConnections\(\) \{.*?\n  \}\n', '\n', source, count=1, flags=re.S)
if count != 1:
    raise SystemExit("Test-all function not found")
source = source.replace('            settingsSection: "ai",\n', '            settingsSection: "ollama",\n', 1)
source = source.replace('            settingsSection: "comfyui",\n', '            settingsSection: "comfyui",\n', 1)
source = source.replace('          ? "yellow"\n          : "grey";', '          ? "yellow"\n          : "yellow";', 1)
source = source.replace('          : "Optional — not configured";', '          : "Setup available";', 1)
source = replace_once(
    source,
    '''        <button type="button" onClick={() => { void testAllConnections(); }} disabled={testing}>
          {testing ? "Testing connections…" : "Test all connections"}
        </button>
''',
    '',
    "dashboard test-all button",
)
source = source.replace(
    '          <span>PlotPickle works locally without any optional account. Keep this dashboard open while you connect services. Each light updates after its live test: green means verified and usable, yellow means one setup step remains.</span>',
    '          <span>A car-dashboard view of PlotPickle. Green is ready, yellow needs setup or testing, and red means a previously working component has failed. Open the exact Settings section to make changes.</span>',
    1,
)
source = source.replace(
    '            {row.links?.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>)}\n',
    '',
    1,
)
source = source.replace('Configure in PlotPickle', 'Open settings', 1)
write(path, source)

# Split taxonomy entries into stable component targets.
path = "config/settings-system-taxonomy.json"
data = json.loads(read(path))
for system in data["systems"]:
    if system["id"] == "local":
        next_items = []
        for item in system["items"]:
            if item["id"] == "local-models":
                next_items.append({
                    "id": "local-ollama",
                    "label": "Ollama",
                    "helpTerm": "Local · Ollama",
                    "description": "Run, select and test a local writing model without leaving the Ollama section.",
                    "status": "optional",
                    "target": "ollama",
                    "examples": ["Ollama service", "Installed LLMs", "Selected writing model", "Local response test"],
                    "mechanics": ["Status", "Model selection", "Test response", "Repair guidance"],
                })
            elif item["id"] == "local-media":
                next_items.append({
                    "id": "local-comfyui",
                    "label": "ComfyUI",
                    "helpTerm": "Local · ComfyUI",
                    "description": "Configure the local server, checkpoints, workflows and live image tests.",
                    "status": "optional",
                    "target": "comfyui",
                    "examples": ["ComfyUI Desktop", "Local checkpoints", "Reviewed workflows", "Native H3"],
                    "mechanics": ["Status", "Endpoint", "Checkpoint", "Test image", "Repair guidance"],
                })
            else:
                next_items.append(item)
        system["items"] = next_items
    if system["id"] == "cloud":
        next_items = []
        for item in system["items"]:
            if item["id"] == "cloud-ai":
                next_items.extend([
                    {
                        "id": "cloud-openai",
                        "label": "OpenAI",
                        "helpTerm": "Cloud · OpenAI",
                        "description": "Configure the OpenAI API account, models and live tests independently.",
                        "status": "optional",
                        "target": "openai",
                        "examples": ["OpenAI API key", "Text model", "Image model", "Live response test"],
                        "mechanics": ["Status", "Configuration", "Test/update", "Repair guidance"],
                    },
                    {
                        "id": "cloud-minimax",
                        "label": "MiniMax",
                        "helpTerm": "Cloud · MiniMax",
                        "description": "Configure MiniMax text, image and H3 video models independently.",
                        "status": "optional",
                        "target": "minimax",
                        "examples": ["MiniMax API key", "M3 text", "image-01", "H3 video"],
                        "mechanics": ["Status", "Configuration", "Paid test consent", "Repair guidance"],
                    },
                ])
            else:
                next_items.append(item)
        system["items"] = next_items
    if system["id"] == "auth":
        for item in system["items"]:
            if item["id"] == "auth-api-keys":
                item["label"] = "OpenAI Credentials"
                item["helpTerm"] = "Auth · OpenAI Credentials"
                item["description"] = "Save, test or remove the OpenAI API key without placing it in a project."
                item["target"] = "openai"
write(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")

# Update old source-contract tests and add the new architecture regression.
path = "tests/issue-256-setup-connections-dashboard.test.mjs"
source = read(path)
source = re.sub(
    r'test\("issue #256 exposes safe direct account and service setup destinations".*?\n\}\);\n',
    '''test("issue #256 exposes one direct internal Settings route per component", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const target of ["ollama", "comfyui", "github", "google", "buzz", "storage"]) {
    assert.ok(setup.includes(`settingsSection: "${target}"`), `Setup Dashboard is missing Settings target: ${target}`);
  }
  assert.doesNotMatch(setup, /target="_blank" rel="noreferrer"/);
  assert.doesNotMatch(setup, /nsec1|sk-[A-Za-z0-9]|privateKey|accessToken|refreshToken/);
});
''',
    source,
    count=1,
    flags=re.S,
)
source = source.replace('    "Optional and not configured",\n', '', 1)
source = source.replace('    "Test all connections",\n', '', 1)
source = source.replace('    "requestConnectionStatusRefresh",\n', '', 1)
source = source.replace('  assert.match(host, /createPortal/);\n  assert.match(host, /#dashboard-setup/);\n  assert.match(host, /test all connections/i);\n', '  assert.match(host, /createPortal/);\n  assert.doesNotMatch(layout, /ConfigurationDashboardHost/);\n', 1)
source = source.replace('  assert.match(layout, /ConfigurationDashboardHost/);\n', '', 1)
source = source.replace('  assert.match(ordering, /configuration-details-open/);\n', '', 1)
source = source.replace('    "Cloud image generation · OpenAI or another provider",\n', '    "Cloud images & video · OpenAI, MiniMax or another provider",\n', 1)
write(path, source)

path = "tests/issue-258-creative-compute-paths.test.mjs"
source = read(path)
source = source.replace('    source("app/configuration-dashboard-host.tsx"),', '    source("app/settings-panel.tsx"),', 2)
source = source.replace('  assert.match(host, /MediaRoutingPanel/);', '  assert.match(host, /MediaRoutingPanel/);', 1)
source = source.replace('  assert.match(host, /H3NativePanel/);', '  assert.match(host, /H3NativePanel/);', 1)
write(path, source)

new_test = '''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issues #329-#333 keep Dashboard read-only and tri-colour", async () => {
  const [layout, dashboard] = await Promise.all([
    source("app/layout.tsx"),
    source("app/setup-connections-dashboard.tsx"),
  ]);
  assert.doesNotMatch(layout, /ConfigurationDashboardHost/);
  assert.match(dashboard, /type SetupTone = "green" \| "yellow" \| "red"/);
  assert.doesNotMatch(dashboard, /"grey"|Test all connections|<input|<select|<textarea/);
  assert.match(dashboard, /Open settings/);
});

test("issues #327-#331 provide stable independent component sections", async () => {
  const [settings, legacy, assistant, taxonomyText] = await Promise.all([
    source("app/settings-panel.tsx"),
    source("app/settings-panel-legacy.tsx"),
    source("app/writing-assistant-console.tsx"),
    source("config/settings-system-taxonomy.json"),
  ]);
  for (const target of ["ollama", "openai", "minimax", "comfyui"]) {
    assert.ok(settings.includes(`activeItem.target === "${target}"`) || settings.includes(`target === "${target}"`), `Missing component section: ${target}`);
    assert.ok(taxonomyText.includes(`"target": "${target}"`), `Missing taxonomy target: ${target}`);
  }
  assert.match(settings, /WritingAssistantConsole/);
  assert.match(settings, /MediaRoutingPanel/);
  assert.match(settings, /H3NativePanel/);
  assert.match(legacy, /forcedSection/);
  assert.match(legacy, /forcedProvider/);
  assert.match(assistant, /focusProvider/);
});
'''
write("tests/issue-333-dashboard-settings-separation.test.mjs", new_test)

path = "tests/issue-256-setup-connections-dashboard.test.mjs"
source = read(path)
marker = 'import "./issue-278-writing-assistant-console.test.mjs";\n'
if 'issue-333-dashboard-settings-separation' not in source:
    source = source.replace(marker, marker + 'import "./issue-333-dashboard-settings-separation.test.mjs";\n', 1)
write(path, source)

print("Issue #333 migration applied")
