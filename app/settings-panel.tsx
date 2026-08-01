"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import type { ConnectionStatusSnapshot } from "@/lib/connection-status";
import taxonomySource from "../config/settings-system-taxonomy.json";
import BuzzSettingsPanel from "./buzz-settings-panel";
import LegacySettingsPanel from "./settings-panel-legacy";
import styles from "./settings-system-navigation.module.css";

const SETTINGS_SECTION_KEY = "plotpickle.settings.section";

type LegacySection =
  | "general"
  | "appearance"
  | "project-defaults"
  | "storage"
  | "ai"
  | "github"
  | "plugins"
  | "google"
  | "buzz"
  | "privacy"
  | "about";

type SystemStatus = "installed" | "configure" | "optional" | "planned" | "reference";

type NavigationItem = {
  id: string;
  label: string;
  helpTerm: string;
  description: string;
  status: SystemStatus;
  target?: LegacySection;
  href?: string;
  examples?: string[];
  mechanics?: string[];
};

type SystemGroup = {
  id: string;
  label: string;
  description: string;
  items: NavigationItem[];
};

type SettingsSystemTaxonomy = {
  schemaVersion: number;
  groupLabel: string;
  helpText: string;
  workspace: NavigationItem[];
  systems: SystemGroup[];
};

const taxonomy = taxonomySource as SettingsSystemTaxonomy;
const allItems = [
  ...taxonomy.workspace.map((item) => ({ item, system: null as SystemGroup | null })),
  ...taxonomy.systems.flatMap((system) => system.items.map((item) => ({ item, system }))),
];

const STATUS_LABELS: Record<SystemStatus, string> = {
  installed: "Installed",
  configure: "Configure",
  optional: "Optional",
  planned: "Planned",
  reference: "Reference",
};

function itemForTarget(target: string | null) {
  return allItems.find((entry) => entry.item.target === target) ?? null;
}

function itemForId(id: string) {
  return allItems.find((entry) => entry.item.id === id) ?? allItems[0];
}

function SystemDetails({ item }: { item: NavigationItem }) {
  const hasExamples = Boolean(item.examples?.length);
  const hasMechanics = Boolean(item.mechanics?.length);

  return (
    <section className={styles.details} aria-labelledby="settings-system-detail-title">
      <div>
        <p>{item.status === "planned" ? "Planned system" : "System reference"}</p>
        <h3 id="settings-system-detail-title">{item.label}</h3>
        <span>{item.description}</span>
      </div>
      {hasExamples ? (
        <div className={styles.detailBlock}>
          <h4>Included here</h4>
          <ul>{item.examples?.map((example) => <li key={example}>{example}</li>)}</ul>
        </div>
      ) : null}
      {hasMechanics ? (
        <div className={styles.detailBlock}>
          <h4>Mechanics</h4>
          <ul>{item.mechanics?.map((mechanic) => <li key={mechanic}>{mechanic}</li>)}</ul>
        </div>
      ) : null}
      <div className={styles.boundary}>
        <strong>{item.status === "planned" ? "No configuration is active yet." : "This is an installed-system reference."}</strong>
        <p>{item.status === "planned"
          ? "PlotPickle names the system now so installation, permissions and testing can be planned without implying that a connector already exists."
          : "Use the exact help term shown above when reporting an installation, package or compatibility problem."}</p>
      </div>
    </section>
  );
}

export default function SettingsPanel({
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
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState(taxonomy.workspace[0].id);
  const [expandedSystem, setExpandedSystem] = useState(taxonomy.systems[0].id);
  const internalTarget = useRef<string | null>(null);

  useEffect(() => {
    const handleSectionRequest = (event: Event) => {
      const target = (event as CustomEvent<string>).detail;
      if (internalTarget.current === target) {
        internalTarget.current = null;
        return;
      }
      const next = itemForTarget(target);
      if (!next) return;
      setActiveId(next.item.id);
      if (next.system) setExpandedSystem(next.system.id);
    };
    window.addEventListener("plotpickle:settings-section", handleSectionRequest);

    const timer = window.setTimeout(() => {
      const requested = window.sessionStorage.getItem(SETTINGS_SECTION_KEY);
      const requestedEntry = itemForTarget(requested);
      const initial = requestedEntry ?? itemForId(taxonomy.workspace[0].id);
      setActiveId(initial.item.id);
      if (initial.system) setExpandedSystem(initial.system.id);
      if (initial.item.target) window.sessionStorage.setItem(SETTINGS_SECTION_KEY, initial.item.target);
      setReady(true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("plotpickle:settings-section", handleSectionRequest);
    };
  }, []);

  const activeEntry = useMemo(() => itemForId(activeId), [activeId]);
  const activeItem = activeEntry.item;
  const activeGroupLabel = activeEntry.system?.label ?? "Workspace";

  function selectItem(item: NavigationItem, system: SystemGroup | null) {
    setActiveId(item.id);
    if (system) setExpandedSystem(system.id);
    if (!item.target) return;
    internalTarget.current = item.target;
    window.sessionStorage.setItem(SETTINGS_SECTION_KEY, item.target);
    window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: item.target }));
  }

  function selectSystem(system: SystemGroup) {
    const opening = expandedSystem !== system.id;
    setExpandedSystem(opening ? system.id : "");
    if (opening && system.items.length) selectItem(system.items[0], system);
  }

  if (!ready) return <div className={styles.loading}>Preparing Settings…</div>;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p>Settings</p>
        <h1>Configure PlotPickle by system.</h1>
        <span>Workspace holds personal preferences. Systems holds every app, service, repository, credential, package or runtime that may need configuration, installation or support.</span>
      </header>

      <div className={styles.layout}>
        <nav className={styles.menu} aria-label="PlotPickle Settings systems">
          <section className={styles.menuGroup} aria-labelledby="settings-workspace-heading">
            <h2 id="settings-workspace-heading">Workspace</h2>
            <div className={styles.workspaceItems}>
              {taxonomy.workspace.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={activeItem.id === item.id ? styles.activeItem : styles.menuItem}
                  aria-current={activeItem.id === item.id ? "page" : undefined}
                  onClick={() => selectItem(item, null)}
                >
                  <b>{item.label}</b>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.menuGroup} aria-labelledby="settings-systems-heading">
            <h2 id="settings-systems-heading">{taxonomy.groupLabel}</h2>
            <p className={styles.helpText}>{taxonomy.helpText}</p>
            <div className={styles.systemList}>
              {taxonomy.systems.map((system) => {
                const expanded = expandedSystem === system.id;
                const systemActive = activeEntry.system?.id === system.id;
                return (
                  <section className={systemActive ? styles.activeSystem : styles.system} key={system.id}>
                    <button
                      type="button"
                      className={styles.systemButton}
                      aria-expanded={expanded}
                      aria-controls={`settings-system-${system.id}`}
                      onClick={() => selectSystem(system)}
                    >
                      <span><b>{system.label}</b><small>{system.description}</small></span>
                      <em>{expanded ? "Close" : "Open"}</em>
                    </button>
                    {expanded ? (
                      <div className={styles.submenu} id={`settings-system-${system.id}`}>
                        {system.items.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            className={activeItem.id === item.id ? styles.activeSubmenuItem : styles.submenuItem}
                            aria-current={activeItem.id === item.id ? "page" : undefined}
                            onClick={() => selectItem(item, system)}
                          >
                            <span><b>{item.label}</b><small>{item.description}</small></span>
                            <em data-status={item.status}>{STATUS_LABELS[item.status]}</em>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </section>
        </nav>

        <main className={styles.content}>
          <header className={styles.context}>
            <div>
              <p>{activeGroupLabel}</p>
              <h2>{activeItem.label}</h2>
              <span>{activeItem.description}</span>
            </div>
            <div className={styles.contextMeta}>
              <span data-status={activeItem.status}>{STATUS_LABELS[activeItem.status]}</span>
              <code>{activeItem.helpTerm}</code>
            </div>
          </header>

          {activeItem.examples?.length ? (
            <div className={styles.scope} aria-label={`${activeItem.label} examples`}>
              {activeItem.examples.slice(0, 6).map((example) => <span key={example}>{example}</span>)}
            </div>
          ) : null}

          {activeItem.href ? (
            <section className={styles.routeCard}>
              <div><p>Separate configuration workspace</p><h3>{activeItem.label}</h3><span>{activeItem.description}</span></div>
              <a href={activeItem.href}>Open {activeItem.label}</a>
              {activeItem.mechanics?.length ? <p>{activeItem.mechanics.join(" · ")}</p> : null}
            </section>
          ) : activeItem.target === "buzz" ? (
            <BuzzSettingsPanel />
          ) : activeItem.target ? (
            <div className={styles.legacy}>
              <LegacySettingsPanel
                project={project}
                onProjectChange={onProjectChange}
                connections={connections}
                onConnectionChange={onConnectionChange}
              />
            </div>
          ) : (
            <SystemDetails item={activeItem} />
          )}
        </main>
      </div>
    </div>
  );
}
