import { readFile, writeFile } from "node:fs/promises";

const path = "app/settings-panel.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import LegacySettingsPanel from "./settings-panel-legacy";\nimport styles from "./settings-system-navigation.module.css";',
  'import LegacySettingsPanel from "./settings-panel-legacy";\nimport SettingsSitemap from "./settings-sitemap";\nimport styles from "./settings-system-navigation.module.css";',
  "Sitemap import",
);

replaceOnce(
  '  | "privacy"\n  | "about";\n\ntype PlayhouseView = "overview" | "local" | "writers-room" | "repository" | "advanced";',
  '  | "privacy"\n  | "about";\n\ntype SettingsTarget = LegacySection | "sitemap";\n\ntype PlayhouseView = "overview" | "local" | "writers-room" | "repository" | "sitemap" | "advanced";',
  "Sitemap view type",
);

replaceOnce(
  "  target?: LegacySection;",
  "  target?: SettingsTarget;",
  "Sitemap target type",
);

replaceOnce(
  'function viewForTarget(target: string | null): PlayhouseView | null {\n  if (target === "buzz") return "writers-room";',
  'function viewForTarget(target: string | null): PlayhouseView | null {\n  if (target === "sitemap") return "sitemap";\n  if (target === "buzz") return "writers-room";',
  "Sitemap view routing",
);

replaceOnce(
  '  function selectItem(item: NavigationItem, system: SystemGroup | null) {\n    setActiveId(item.id);\n    if (system) setExpandedSystem(system.id);\n    if (!item.target) return;',
  '  function selectItem(item: NavigationItem, system: SystemGroup | null) {\n    setActiveId(item.id);\n    if (system) setExpandedSystem(system.id);\n    if (item.target === "sitemap") {\n      window.sessionStorage.setItem(SETTINGS_SECTION_KEY, item.target);\n      setPlayhouseView("sitemap");\n      return;\n    }\n    if (!item.target) return;',
  "Sitemap item selection",
);

replaceOnce(
  '  function openAdvancedTarget(target: LegacySection) {\n    const next = itemForTarget(target);\n    setPlayhouseView("advanced");\n    if (!next) return;\n    setActiveId(next.item.id);\n    if (next.system) setExpandedSystem(next.system.id);\n  }\n\n  if (!ready)',
  '  function openAdvancedTarget(target: LegacySection) {\n    const next = itemForTarget(target);\n    setPlayhouseView("advanced");\n    if (!next) return;\n    setActiveId(next.item.id);\n    if (next.system) setExpandedSystem(next.system.id);\n  }\n\n  function openSitemapSettingsItem(id: string) {\n    const next = itemForId(id);\n    if (next.item.target === "sitemap") {\n      setPlayhouseView("sitemap");\n      return;\n    }\n    setPlayhouseView("advanced");\n    setActiveId(next.item.id);\n    if (next.system) setExpandedSystem(next.system.id);\n    if (next.item.target && next.item.target !== "sitemap") {\n      internalTarget.current = next.item.target;\n      window.sessionStorage.setItem(SETTINGS_SECTION_KEY, next.item.target);\n      window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: next.item.target }));\n    }\n  }\n\n  function openSitemapWorkspace(id: string) {\n    window.dispatchEvent(new CustomEvent("plotpickle:navigate-workspace", { detail: id }));\n  }\n\n  if (!ready)',
  "Sitemap opening actions",
);

replaceOnce(
  '        ))}\n        <button type="button" className={playhouseView === "advanced" ? styles.activeMode : styles.advancedMode}',
  '        ))}\n        <button type="button" className={playhouseView === "sitemap" ? styles.activeMode : undefined} onClick={() => setPlayhouseView("sitemap")}>Sitemap</button>\n        <button type="button" className={playhouseView === "advanced" ? styles.activeMode : styles.advancedMode}',
  "Sitemap mode button",
);

replaceOnce(
  '      {playhouseView === "advanced" ? <div className={styles.layout}>',
  '      {playhouseView === "sitemap" ? (\n        <SettingsSitemap\n          taxonomy={taxonomy}\n          connections={connections}\n          buzzStatus={buzzModeStatus}\n          onOpenWorkspace={(id) => openSitemapWorkspace(id)}\n          onOpenSettingsItem={openSitemapSettingsItem}\n          onOpenSettingsOverview={() => setPlayhouseView("overview")}\n        />\n      ) : null}\n\n      {playhouseView === "advanced" ? <div className={styles.layout}>',
  "Sitemap workspace render",
);

for (const contract of [
  'import SettingsSitemap from "./settings-sitemap";',
  'type SettingsTarget = LegacySection | "sitemap";',
  'playhouseView === "sitemap"',
  'plotpickle:navigate-workspace',
  '<SettingsSitemap',
]) {
  if (!source.includes(contract)) throw new Error(`Missing post-patch contract: ${contract}`);
}

await writeFile(path, source, "utf8");
