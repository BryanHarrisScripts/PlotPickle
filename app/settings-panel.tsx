"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import type { ConnectionStatusSnapshot } from "@/lib/connection-status";
import taxonomySource from "../config/settings-system-taxonomy.json";
import BuzzSettingsPanel from "./buzz-settings-panel";
import GitHubCollaboration from "./github-collaboration";
import LegacySettingsPanel from "./settings-panel-legacy";
import WritingAssistantConsole from "./writing-assistant-console";
import MediaRoutingPanel from "./media-routing-panel";
import H3NativePanel from "./h3-native-panel";
import SettingsSitemap from "./settings-sitemap";
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
type ComponentSection = "ollama" | "openai" | "minimax" | "comfyui";
type SettingsTarget = LegacySection | ComponentSection | "sitemap";
type SettingsStatus = "installed" | "configure" | "planned" | "optional";
type SettingsItem = {
  id: string;
  label: string;
  helpTerm: string;
  description: string;
  status: SettingsStatus;
  target?: SettingsTarget;
  href?: string;
  examples?: string[];
  mechanics?: string[];
};
type SettingsSystem = {
  id: string;
  label: string;
  helpTerm: string;
  description: string;
  status: SettingsStatus;
  section: string;
  items: SettingsItem[];
};
type SettingsTaxonomy = {
  version: number;
  groups: Array<{ id: string; label: string; description: string }>;
  systems: SettingsSystem[];
};
type SettingsView = "playhouse" | "advanced";

type Props = {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  connections: ConnectionStatusSnapshot;
  onConnectionChange: () => void | Promise<void>;
};

const STATUS_LABELS: Record<SettingsStatus, string> = {
  installed: "Included",
  configure: "Configure",
  planned: "Planned",
  optional: "Optional",
};

const PLAYHOUSE_SYSTEMS = new Set(["workspace", "local", "collab", "auth"]);

function firstItem(taxonomy: SettingsTaxonomy) {
  return taxonomy.systems[0]?.items[0] ?? null;
}

function itemById(taxonomy: SettingsTaxonomy, id: string) {
  for (const system of taxonomy.systems) {
    const item = system.items.find((candidate) => candidate.id === id);
    if (item) return { item, system };
  }
  return null;
}

export default function SettingsPanel({ project, onProjectChange, connections, onConnectionChange }: Props) {
  const taxonomy = taxonomySource as SettingsTaxonomy;
  const defaultItem = firstItem(taxonomy);
  const [activeId, setActiveId] = useState(defaultItem?.id ?? "");
  const [expandedSystem, setExpandedSystem] = useState(taxonomy.systems[0]?.id ?? "");
  const [playhouseView, setPlayhouseView] = useState<SettingsView>("playhouse");
  const [buzzModeStatus, setBuzzModeStatus] = useState<"ready" | "checking" | "setup">("checking");
  const internalTarget = useRef<SettingsTarget | null>(null);

  const visibleSystems = useMemo(
    () => playhouseView === "playhouse"
      ? taxonomy.systems.filter((system) => PLAYHOUSE_SYSTEMS.has(system.id))
      : taxonomy.systems,
    [playhouseView, taxonomy.systems],
  );

  const active = useMemo(() => itemById(taxonomy, activeId), [activeId, taxonomy]);
  const activeItem = active?.item ?? defaultItem!;
  const activeSystem = active?.system ?? taxonomy.systems[0];
  const activeGroupLabel = taxonomy.groups.find((group) => group.id === activeSystem?.section)?.label ?? "Settings";

  function itemForTarget(target: SettingsTarget) {
    for (const system of taxonomy.systems) {
      const item = system.items.find((candidate) => candidate.target === target);
      if (item) return { item, system };
    }
    return null;
  }

  useEffect(() => {
    const requested = window.sessionStorage.getItem(SETTINGS_SECTION_KEY) as SettingsTarget | null;
    if (!requested) return;
    const next = itemForTarget(requested);
    if (!next) return;
    setPlayhouseView("advanced");
    setActiveId(next.item.id);
    setExpandedSystem(next.system.id);
    internalTarget.current = requested;
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const target = (event as CustomEvent<string>).detail as SettingsTarget;
      const next = itemForTarget(target);
      if (!next) return;
      setPlayhouseView("advanced");
      setActiveId(next.item.id);
      setExpandedSystem(next.system.id);
      internalTarget.current = target;
    };
    window.addEventListener("plotpickle:settings-section", handler);
    return () => window.removeEventListener("plotpickle:settings-section", handler);
  }, []);

  useEffect(() => {
    if (!activeItem.target || internalTarget.current === activeItem.target) return;
    internalTarget.current = activeItem.target;
    window.sessionStorage.setItem(SETTINGS_SECTION_KEY, activeItem.target);
    window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: activeItem.target }));
  }, [activeItem.target]);

  useEffect(() => {
    let activeRequest = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/local-buzz/status", { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!response.ok) throw new Error("Buzz status unavailable");
        const body = await response.json() as { connection?: { configured?: boolean; identityVerified?: boolean }; relay?: { reachable?: boolean }; cli?: { available?: boolean } };
        if (!activeRequest) return;
        const ready = Boolean(body.connection?.configured && body.connection.identityVerified && body.relay?.reachable && body.cli?.available);
        setBuzzModeStatus(ready ? "ready" : "setup");
      } catch {
        if (activeRequest) setBuzzModeStatus("setup");
      }
    }, 0);
    return () => {
      activeRequest = false;
      window.clearTimeout(timer);
    };
  }, []);

  function selectItem(item: SettingsItem, system: SettingsSystem) {
    setActiveId(item.id);
    setExpandedSystem(system.id);
    if (item.target) {
      internalTarget.current = item.target;
      window.sessionStorage.setItem(SETTINGS_SECTION_KEY, item.target);
      window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: item.target }));
    }
  }

  function openSitemapWorkspace(id: string) {
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

  const selectedMode = activeItem.id === "workspace-modes";
  const modeRows = [
    {
      label: "What is included",
      local: ["PlotPickle Playhouse", "Afterglow example", "Local project storage", "Learning modules", "Manual workflow"],
      writers: ["Everything in Local Story", "Buzz Community", "Buzz Desktop", "Community rooms", "Community feedback"],
      cloud: ["Everything in Local Story", "GitHub repository", "Story Proposals", "Repository history", "Optional cloud compute"],
    },
    {
      label: "What you configure",
      local: ["Nothing required", "Optional local models", "Optional local media tools"],
      writers: ["Buzz account", "Community membership", "Buzz Desktop identity"],
      cloud: ["GitHub account", "One story repository", "Optional provider keys"],
    },
  ];

  return (
    <section className={styles.page} aria-labelledby="settings-page-title">
      <div className={styles.pageHeading}>
        <div>
          <p>Configuration centre</p>
          <h1 id="settings-page-title">Settings</h1>
          <span>Choose a PlotPickle component, see its current state, then configure and test it without losing your place.</span>
        </div>
        <div className={styles.viewToggle} aria-label="Settings navigation detail">
          <button type="button" className={playhouseView === "playhouse" ? styles.viewActive : ""} onClick={() => setPlayhouseView("playhouse")}>Playhouse</button>
          <button type="button" className={playhouseView === "advanced" ? styles.viewActive : ""} onClick={() => setPlayhouseView("advanced")}>Advanced</button>
        </div>
      </div>

      {selectedMode ? (
        <section className={styles.modeSection} aria-labelledby="settings-modes-title">
          <div className={styles.modeHeading}>
            <p>Three ways to use PlotPickle</p>
            <h2 id="settings-modes-title">Choose the workflow that fits your story.</h2>
            <span>Each mode keeps the local PlotPickle core. Collaboration and external services are added only when you choose them.</span>
          </div>
          <div className={styles.modeComparison}>
            <table className={styles.modeTable}>
              <caption className={styles.visuallyHidden}>PlotPickle mode comparison</caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col"><strong>Local Story Mode</strong><span>Private, local and independent</span></th>
                  <th scope="col"><strong>Writers’ Room Mode</strong><span>Buzz community collaboration</span></th>
                  <th scope="col"><strong>Repository Collaboration Mode</strong><span>GitHub proposals and history</span></th>
                </tr>
              </thead>
              <tbody>
                {modeRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td><ul>{row.local.map((item) => <li key={item}>{item}</li>)}</ul></td>
                    <td><ul>{row.writers.map((item) => <li key={item}>{item}</li>)}</ul></td>
                    <td><ul>{row.cloud.map((item) => <li key={item}>{item}</li>)}</ul></td>
                  </tr>
                ))}
                <tr>
                  <th scope="row"><strong>Status</strong><span>What is active now</span></th>
                  <td><span className={styles.readyStatus}>PlotPickle installed locally</span></td>
                  <td><span className={styles.readyStatus}>PlotPickle installed locally</span><small>{buzzModeStatus === "ready" ? "Buzz connected" : buzzModeStatus === "checking" ? "Checking Buzz" : "Buzz setup optional"}</small></td>
                  <td><span className={styles.readyStatus}>PlotPickle installed locally</span><small>{connections.items.github.state === "connected" ? "GitHub connected" : connections.items.github.state === "configured" ? "GitHub configured" : "GitHub setup optional"}</small></td>
                </tr>
                <tr>
                  <th scope="row"><strong>Primary role</strong><span>The job this mode performs</span></th>
                  <td>Private story creation with the lowest ongoing service cost.</td>
                  <td>Community discussion and canon-safe proposals through Buzz.</td>
                  <td>Reviewed multi-machine history through GitHub, with optional remote AI compute.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>User experience</strong><span>What the writer uses</span></th>
                  <td>PlotPickle Playhouse and local compute.</td>
                  <td>PlotPickle Playhouse, Buzz Community and Buzz Desktop.</td>
                  <td>PlotPickle Playhouse, GitHub and optional cloud compute.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Default storyline</strong><span>The story that flows through the mode</span></th>
                  <td>Afterglow: Reflections of Sentience is loaded locally as the open example, or use your own story.</td>
                  <td>Afterglow or your own story can be discussed through Buzz without making messages canon.</td>
                  <td>Afterglow or your own story can use a GitHub repository for proposals and revision history.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Learning</strong><span>Available in every mode</span></th>
                  <td>Learn workspace, 81 self-paced modules, local guides and Afterglow examples.</td>
                  <td>Same Learn workspace, modules, local guides and Afterglow examples.</td>
                  <td>Same Learn workspace, modules, local guides and Afterglow examples.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>AI &amp; agents</strong><span>Optional assistance</span></th>
                  <td>Local models, compatible providers, manual prompt export or no AI.</td>
                  <td>Local AI choices plus community context; Buzz is not the inference engine.</td>
                  <td>Local or remote AI compute by choice; GitHub remains the review and history layer.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Runtime</strong><span>What runs the experience</span></th>
                  <td>PlotPickle Runtime, Node.js, React and Vite/Vinext.</td>
                  <td>PlotPickle Runtime plus Buzz Desktop, Buzz CLI and the PlotPickle connector.</td>
                  <td>PlotPickle Runtime plus the GitHub connection and optional provider services.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Compute</strong><span>Where processing happens</span></th>
                  <td>Local GPU, CPU, memory and storage.</td>
                  <td>Local PlotPickle compute with Buzz community services for conversation.</td>
                  <td>Local compute by default, with optional remote compute for selected AI tasks.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Data &amp; storage</strong><span>Where the project lives</span></th>
                  <td>PPF, canonical JSON, local assets and rolling backups.</td>
                  <td>Local PPF plus Buzz rooms, messages, huddles and discussion references.</td>
                  <td>Local PPF plus GitHub repository history, branches and Story Proposals.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Collaboration</strong><span>How people contribute</span></th>
                  <td>Not required; the complete workflow works independently.</td>
                  <td>Members, roles, invitations, rooms, messages and canon-safe proposals.</td>
                  <td>Branches, proposals, comparisons, revision history and human-approved merges.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Authentication &amp; API keys</strong><span>Accounts and credentials</span></th>
                  <td>No account required for core use; provider keys remain optional and local.</td>
                  <td>Buzz or BuilderLab account, community membership and encrypted local identity.</td>
                  <td>GitHub sign-in; optional AI provider keys remain outside the PPF.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Connections</strong><span>External systems</span></th>
                  <td>Localhost, installed models, local tools and plugins.</td>
                  <td>Buzz Desktop, BuilderLab Communities and the saved wss:// community address.</td>
                  <td>GitHub repository, branch controls and optional remote AI provider.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Security &amp; control</strong><span>Who can change canon</span></th>
                  <td>Private 127.0.0.1 server; the project stays on this computer.</td>
                  <td>Authorized community access; conversation cannot directly change PPF canon.</td>
                  <td>Repository permissions and human review; only an approved merge changes shared history.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Cost profile</strong><span>How spending is controlled</span></th>
                  <td>Lowest ongoing cost and minimal paid-token usage.</td>
                  <td>Local core first; collaboration is added without replacing local compute.</td>
                  <td>Local work remains available; paid remote compute is used only by choice.</td>
                </tr>
                <tr>
                  <th scope="row"><strong>Best for</strong><span>The strongest fit</span></th>
                  <td>Privacy, self-learning, independent creation and cost control.</td>
                  <td>Writers’ Rooms, community feedback and canon-safe review.</td>
                  <td>Multi-machine work, formal proposals, history and remote collaboration.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={styles.modeDecision}>
            <div><strong>Start local. Add collaboration only when it serves the story.</strong><span>Every mode keeps the complete local PlotPickle workflow.</span></div>
            <button type="button" onClick={() => setPlayhouseView("advanced")}>Open advanced settings</button>
          </div>
        </section>
      ) : (
        <div className={styles.layout}>
          <nav className={styles.navigation} aria-label="Settings systems">
            <section className={styles.quickNavigation} aria-label="Settings navigation mode">
              <p>Navigation</p>
              <button type="button" className={playhouseView === "playhouse" ? styles.quickActive : ""} onClick={() => setPlayhouseView("playhouse")}>Playhouse essentials</button>
              <button type="button" className={playhouseView === "advanced" ? styles.quickActive : ""} onClick={() => setPlayhouseView("advanced")}>All settings</button>
            </section>
            <div className={styles.systemList}>
              {visibleSystems.map((system) => {
                const expanded = expandedSystem === system.id;
                return (
                  <section className={styles.system} key={system.id}>
                    <button
                      type="button"
                      className={expanded ? styles.systemButtonActive : styles.systemButton}
                      aria-expanded={expanded}
                      onClick={() => setExpandedSystem(expanded ? "" : system.id)}
                    >
                      <span><b>{system.label}</b><small>{system.description}</small></span>
                      <em data-status={system.status}>{STATUS_LABELS[system.status]}</em>
                    </button>
                    {expanded ? (
                      <div className={styles.submenu}>
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
          </nav>

          <main className={styles.content}>
            <header className={styles.context}>
              <div>
                <p>{activeGroupLabel}</p>
                <h1>{activeItem.label}</h1>
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

            {activeItem.target === "ollama" ? (
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
              <section className={styles.details}>
                <div>
                  <p>Settings system</p>
                  <h3>{activeItem.label}</h3>
                  <span>{activeItem.description}</span>
                </div>
                {activeItem.examples?.length ? <p>{activeItem.examples.join(" · ")}</p> : null}
                {activeItem.mechanics?.length ? <p>{activeItem.mechanics.join(" · ")}</p> : null}
              </section>
            )}

            <SettingsSitemap activeId={activeItem.id} onOpenWorkspace={openSitemapWorkspace} />
          </main>
        </div>
      )}
    </section>
  );
}
