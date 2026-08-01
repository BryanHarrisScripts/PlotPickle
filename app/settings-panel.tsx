"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import type { ConnectionStatusSnapshot } from "@/lib/connection-status";
import taxonomySource from "../config/settings-system-taxonomy.json";
import BuzzSettingsPanel from "./buzz-settings-panel";
import GitHubCollaboration from "./github-collaboration";
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

type PlayhouseView = "overview" | "local" | "writers-room" | "repository" | "advanced";
type BuzzModeStatus = "checking" | "ready" | "setup" | "unavailable";

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

function viewForTarget(target: string | null): PlayhouseView | null {
  if (target === "buzz") return "writers-room";
  if (target === "github") return "repository";
  if (target === "local" || target === "storage") return "local";
  return target ? "advanced" : null;
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
  const [playhouseView, setPlayhouseView] = useState<PlayhouseView>("overview");
  const [buzzModeStatus, setBuzzModeStatus] = useState<BuzzModeStatus>("checking");
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
      const requestedView = viewForTarget(target);
      if (requestedView) setPlayhouseView(requestedView);
      const next = itemForTarget(target);
      if (!next) return;
      setActiveId(next.item.id);
      if (next.system) setExpandedSystem(next.system.id);
    };
    window.addEventListener("plotpickle:settings-section", handleSectionRequest);

    const timer = window.setTimeout(() => {
      const requested = window.sessionStorage.getItem(SETTINGS_SECTION_KEY);
      const requestedEntry = itemForTarget(requested);
      setPlayhouseView(viewForTarget(requested) ?? "overview");
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

  useEffect(() => {
    if (!ready || playhouseView !== "overview") return;
    let cancelled = false;
    void fetch("/api/local-buzz/status", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Buzz status unavailable");
        const body = await response.json() as {
          connection?: { identityVerified?: boolean };
          relay?: { reachable?: boolean };
          cli?: { available?: boolean };
        };
        if (!cancelled) setBuzzModeStatus(body.connection?.identityVerified && body.relay?.reachable && body.cli?.available ? "ready" : "setup");
      })
      .catch(() => { if (!cancelled) setBuzzModeStatus("unavailable"); });
    return () => { cancelled = true; };
  }, [playhouseView, ready]);

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

  function openAdvancedTarget(target: LegacySection) {
    const next = itemForTarget(target);
    setPlayhouseView("advanced");
    if (!next) return;
    setActiveId(next.item.id);
    if (next.system) setExpandedSystem(next.system.id);
  }

  if (!ready) return <div className={styles.loading}>Preparing Settings…</div>;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p>Playhouse modes</p>
        <h1>Choose how PlotPickle works today.</h1>
        <span>Start locally, add a Buzz Writers’ Room, or connect GitHub and optional remote compute. The PPF remains official story canon in every mode.</span>
      </header>

      <nav className={styles.modeNav} aria-label="Playhouse operating modes">
        {([
          ["overview", "Compare roles"],
          ["local", "Local Story"],
          ["writers-room", "Writers’ Room"],
          ["repository", "Cloud Collab"],
        ] as Array<[PlayhouseView, string]>).map(([id, label]) => (
          <button type="button" key={id} className={playhouseView === id ? styles.activeMode : undefined} onClick={() => setPlayhouseView(id)}>{label}</button>
        ))}
        <button type="button" className={playhouseView === "advanced" ? styles.activeMode : styles.advancedMode} onClick={() => setPlayhouseView("advanced")}>Other settings</button>
      </nav>

      {playhouseView === "overview" ? (
        <main className={styles.modeContent}>
          <header className={styles.modeHeading}>
            <div><p>One PlotPickle · three modes</p><h2>Compare the complete story workflow.</h2><span>PlotPickle is installed locally in every mode. Afterglow, your own story, Learning and the PPF remain available as you add Buzz or GitHub.</span></div>
          </header>
          <div className={styles.modeTableWrap}>
            <table className={styles.modeTable}>
              <thead><tr><th>Compare</th><th><strong>Local Story Mode</strong><span>Private local creation</span><button type="button" onClick={() => setPlayhouseView("local")}>Open local setup</button></th><th><strong>Writers’ Room Mode</strong><span>Buzz community collaboration</span><button type="button" onClick={() => setPlayhouseView("writers-room")}>Open Writers’ Room setup</button></th><th><strong>Cloud Collab Mode</strong><span>GitHub history and optional remote compute</span><button type="button" onClick={() => setPlayhouseView("repository")}>Open cloud setup</button></th></tr></thead>
              <tbody>
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
        </main>
      ) : null}

      {playhouseView === "local" ? (
        <main className={styles.modeContent}>
          <header className={styles.modeHeading}><div><p>Mode 1</p><h2>Local Story Mode</h2><span>The complete PlotPickle learning and writing workflow with no external collaboration service.</span></div><button type="button" onClick={() => setPlayhouseView("overview")}>Back to modes</button></header>
          <div className={styles.requirementGrid}>
            <article><span>Required</span><h3>PlotPickle Runtime</h3><p>The local Playhouse server and packaged web application.</p><strong>Installed</strong></article>
            <article><span>Required</span><h3>PPF project files</h3><p>Your official story remains in local human-readable project storage.</p><strong>{connections.items.storage.state === "connected" ? "Ready" : "Check storage"}</strong></article>
            <article><span>Recommended</span><h3>Rolling backups</h3><p>Recoverable local revisions under the current Windows user.</p><strong>{connections.items.backups.state === "connected" ? "Ready" : "Available"}</strong></article>
          </div>
          <section className={styles.modeDecision}><div><p>Nothing else to connect</p><h3>Local Story Mode is ready now.</h3><span>Buzz, GitHub, Google and AI providers remain optional and disconnected.</span></div><button type="button" onClick={() => openAdvancedTarget("storage")}>Storage & backup settings</button></section>
        </main>
      ) : null}

      {playhouseView === "writers-room" ? (
        <main className={styles.modeContent}>
          <header className={styles.modeHeading}><div><p>Mode 2</p><h2>Writers’ Room Mode</h2><span>Connect only the Buzz pieces needed for community discussion and feedback. The PPF remains official canon.</span></div><button type="button" onClick={() => setPlayhouseView("overview")}>Back to modes</button></header>
          <div className={styles.embeddedMode}><BuzzSettingsPanel /></div>
        </main>
      ) : null}

      {playhouseView === "repository" ? (
        <main className={styles.modeContent}>
          <header className={styles.modeHeading}><div><p>Mode 3</p><h2>Cloud Collab Mode</h2><span>Connect GitHub for history and owner-reviewed proposals, then add remote compute only when it is useful.</span></div><button type="button" onClick={() => setPlayhouseView("overview")}>Back to modes</button></header>
          <section className={styles.connectionSummary} data-state={connections.items.github.state}>
            <div><span>GitHub connection</span><h3>{connections.items.github.identity || "No repository connected"}</h3><p>{connections.items.github.detail}</p></div>
            <strong>{connections.items.github.state === "connected" ? "Ready" : connections.items.github.state === "configured" ? "Configured" : "Setup needed"}</strong>
          </section>
          <div className={styles.embeddedMode}>
            <GitHubCollaboration project={project} onChange={onProjectChange} onConnectionChange={() => void onConnectionChange()} surface="repository-setup" />
          </div>
        </main>
      ) : null}

      {playhouseView === "advanced" ? <div className={styles.layout}>
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
      </div> : null}
    </div>
  );
}
