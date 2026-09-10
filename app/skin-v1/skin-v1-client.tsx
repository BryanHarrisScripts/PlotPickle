"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { browserProfileAuthGateway } from "../../adapters/experience/browser-profile-auth-gateway";
import type { ExperienceIntent, ExperienceSurfaceId } from "../../core/contracts/experience";
import {
  executeAuthenticateHumanIntent,
  executeCompleteFirstHumanProfileSetupIntent,
  executeCreateFirstHumanProfileIntent,
  readLogonViewModel,
  type FirstProfileRecovery,
  type LogonViewModel,
} from "../../lib/experience/logon-use-case";
import { deriveExperienceSurfaceTopology, executeOpenSurfaceIntent } from "../../lib/experience/surface-registry";
import DashboardBbsPanel, { type DashboardBbsItem } from "./dashboard-bbs-panel";

const CommunitySkinHost = lazy(() => import("../_components/community/community-skin-host"));
const LocalAiSkinHost = lazy(() => import("./local-ai-skin-host"));
const NodeSkinPanel = lazy(() => import("./node-skin-panel"));
const ProfileSkinPanel = lazy(() => import("./profile-skin-panel"));

const PROFILE_MENU = [
  { id: "profile", label: "PROFILE", description: "YOUR PROFILE", enabled: true, shortcut: "P" },
  { id: "local-ai", label: "LOCAL STORY MODE", description: "LOCAL WRITING / IMAGES / VIDEO", enabled: true, shortcut: "L" },
  { id: "node", label: "NODE", description: "NODE INFO", enabled: true, shortcut: "N" },
] as const;

const LOADING_VIEW: LogonViewModel = {
  surface: "LOGON",
  state: "loading",
  configured: false,
  accessMode: null,
  profiles: [],
  activeProfile: null,
  requiresBootstrapProof: false,
  message: null,
};

const DASHBOARD_MENU: readonly DashboardBbsItem[] = [
  { id: "community", shortcut: "C", label: "Community", description: "Talk, Share & Collaborate With Writers" },
  { id: "library", shortcut: "L", label: "Story Library", description: "Load Your Stories" },
  { id: "plan", shortcut: "P", label: "Outline", description: "Shape Story Structure & Narrative Direction", group: "PLANNING & STRUCTURING" },
  { id: "storyboard", shortcut: "S", label: "Storyboard", description: "Visualize Scenes Before You Write", group: "PLANNING & STRUCTURING" },
  { id: "previs", shortcut: "V", label: "Previs", description: "Preview Shots, Timing & Camera Motion", group: "PLANNING & STRUCTURING" },
  { id: "write", shortcut: "W", label: "Script Writer", description: "Write Scenes, Dialogue & Action Blocks", group: "PRODUCTION & DRAFTING" },
  { id: "edit", shortcut: "E", label: "Editorial", description: "Review & Improve Screenplay Flow", group: "PRODUCTION & DRAFTING" },
  { id: "feedback", shortcut: "F", label: "Script Feedback", description: "Gather Reader Notes & Reactions", group: "PRODUCTION & DRAFTING" },
  { id: "refine", shortcut: "R", label: "Refine & Polish", description: "Enhance Dialogue & Story Choices", group: "PRODUCTION & DRAFTING" },
  { id: "reports", shortcut: "A", label: "Script Analytics", description: "Review Story Health & Coverage Reports", group: "PROJECT MANAGEMENT" },
  { id: "settings", shortcut: "O", label: "Options & Settings", description: "Configure PlotPickle Tools & API Keys", group: "PROJECT MANAGEMENT" },
  { id: "profile", shortcut: "U", label: "User Profile", description: "Manage Identity, Credits & Preferences", group: "PROJECT MANAGEMENT" },
  { id: "learn", shortcut: "1", label: "Writer's Craft", description: "Learn Storytelling Essentials (Screenplay Writing)", group: "INTERACTIVE & LEARNING" },
  { id: "wyrmwood", shortcut: "2", label: "Wyrmwood Game", description: "Practice Narrative Craft Through Play", group: "INTERACTIVE & LEARNING" },
  { id: "story", shortcut: "3", label: "Story", description: "The Unwritten Story Game Engine", group: "INTERACTIVE & LEARNING" },
];

function nextIntentId() {
  return globalThis.crypto?.randomUUID?.() ?? `intent-${Date.now()}`;
}

export default function SkinV1Client() {
  const [view, setView] = useState<LogonViewModel>(LOADING_VIEW);
  const [locator, setLocator] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [credential, setCredential] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [bootstrapProof, setBootstrapProof] = useState("");
  const [recovery, setRecovery] = useState<FirstProfileRecovery | null>(null);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileSelectedIndex, setProfileSelectedIndex] = useState(0);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [localAiOpen, setLocalAiOpen] = useState(false);
  const [nodeOpen, setNodeOpen] = useState(false);
  const localAiHeadingRef = useRef<HTMLHeadingElement>(null);
  const [dashboardSelection, setDashboardSelection] = useState(0);
  const [activeSurface, setActiveSurface] = useState<ExperienceSurfaceId>("DASHBOARD");
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const dashboardMenuRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const profileItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    void readLogonViewModel(browserProfileAuthGateway)
      .then((next) => {
        setView(next);
        if (next.profiles.length === 1) setLocator(next.profiles[0].profileId);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : String(cause));
        setView({ ...LOADING_VIEW, state: "unavailable", message: "LOGON unavailable" });
      });
  }, []);

  const topology = useMemo(
    () => deriveExperienceSurfaceTopology({ authenticated: view.state === "authenticated" }),
    [view.state],
  );

  useEffect(() => {
    if (localAiOpen) localAiHeadingRef.current?.focus();
    else if (nodeOpen || userProfileOpen) return;
    else if (profileMenuOpen) profileItemRefs.current[profileSelectedIndex]?.focus();
    else if (activeSurface === "COMMUNITY") returnButtonRef.current?.focus();
    else if (view.state === "authenticated") dashboardMenuRefs.current[dashboardSelection]?.focus();
  }, [activeSurface, view.state, dashboardSelection, profileMenuOpen, profileSelectedIndex, userProfileOpen, localAiOpen, nodeOpen]);

  function openSurface(surfaceId: ExperienceSurfaceId) {
    const result = executeOpenSurfaceIntent({
      type: "OpenSurface", intentId: nextIntentId(), surfaceId, baseRevision: null,
    }, { authenticated: view.state === "authenticated" });
    if (result.outcome === "accepted") setActiveSurface(surfaceId);
  }

  function activateDashboardItem(index: number) {
    setDashboardSelection(index);
    if (DASHBOARD_MENU[index]?.id === "profile") {
      setProfileSelectedIndex(0);
      setUserProfileOpen(false);
      setLocalAiOpen(false);
      setNodeOpen(false);
      setProfileMenuOpen(true);
    }
    if (DASHBOARD_MENU[index]?.id === "community") openSurface("COMMUNITY");
  }

  function closeProfileMenu() {
    setUserProfileOpen(false);
    setLocalAiOpen(false);
    setNodeOpen(false);
    setProfileMenuOpen(false);
  }

  function selectProfileItem(index: number) {
    const normalized = (index + PROFILE_MENU.length) % PROFILE_MENU.length;
    setProfileSelectedIndex(normalized);
    window.requestAnimationFrame(() => profileItemRefs.current[normalized]?.focus());
  }

  function activateProfileItem(index: number) {
    const item = PROFILE_MENU[index];
    if (!item) return;
    setProfileSelectedIndex(index);
    if (item.id === "profile") setUserProfileOpen(true);
    if (item.id === "local-ai") setLocalAiOpen(true);
    if (item.id === "node") setNodeOpen(true);
  }

  function handleProfileKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1) {
      const shortcut = event.key.toUpperCase();
      const shortcutIndex = PROFILE_MENU.findIndex((item) => item.shortcut === shortcut);
      if (shortcutIndex >= 0) {
        event.preventDefault();
        selectProfileItem(shortcutIndex);
        activateProfileItem(shortcutIndex);
        return;
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectProfileItem(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectProfileItem(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectProfileItem(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectProfileItem(PROFILE_MENU.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateProfileItem(index);
    }
  }

  function moveDashboardSelection(index: number) {
    const bounded = (index + DASHBOARD_MENU.length) % DASHBOARD_MENU.length;
    setDashboardSelection(bounded);
    dashboardMenuRefs.current[bounded]?.focus();
  }

  function dashboardMenuKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveDashboardSelection(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveDashboardSelection(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveDashboardSelection(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      moveDashboardSelection(DASHBOARD_MENU.length - 1);
    }
  }

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const intent: Extract<ExperienceIntent, { type: "AuthenticateHuman" }> = {
      type: "AuthenticateHuman",
      intentId: nextIntentId(),
      locator,
      baseRevision: null,
    };

    try {
      const resolved = await executeAuthenticateHumanIntent({ intent, credential, gateway: browserProfileAuthGateway });
      setCredential("");
      setView(resolved.view);
      if (resolved.result.outcome !== "accepted") setError(resolved.result.reason || "LOGON rejected");
    } finally {
      setBusy(false);
    }
  }

  async function createFirstProfile(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const intent: Extract<ExperienceIntent, { type: "CreateFirstHumanProfile" }> = {
      type: "CreateFirstHumanProfile",
      intentId: nextIntentId(),
      displayName,
      baseRevision: null,
    };

    try {
      const resolved = await executeCreateFirstHumanProfileIntent({
        intent,
        credential,
        confirmation,
        bootstrapProof,
        gateway: browserProfileAuthGateway,
      });
      setView(resolved.view);
      if (resolved.result.outcome !== "accepted" || !resolved.recovery) {
        setError(resolved.result.reason || "PROFILE creation rejected");
        return;
      }
      setRecovery(resolved.recovery);
      setRecoverySaved(false);
      setConfirmation("");
      setBootstrapProof("");
    } finally {
      setBusy(false);
    }
  }

  async function completeFirstProfileSetup() {
    if (!recovery) return;
    setBusy(true);
    setError("");
    const intent: Extract<ExperienceIntent, { type: "CompleteFirstHumanProfileSetup" }> = {
      type: "CompleteFirstHumanProfileSetup",
      intentId: nextIntentId(),
      profileId: recovery.profile.profileId,
      baseRevision: null,
    };

    try {
      const resolved = await executeCompleteFirstHumanProfileSetupIntent({
        intent,
        credential,
        recoverySaved,
        gateway: browserProfileAuthGateway,
      });
      setView(resolved.view);
      if (resolved.result.outcome !== "accepted") {
        setError(resolved.result.reason || "PROFILE setup incomplete");
        return;
      }
      setRecovery(null);
      setRecoverySaved(false);
      setCredential("");
      setDisplayName("");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSessionAfterProfileAction() {
    const next = await readLogonViewModel(browserProfileAuthGateway);
    setView(next);
    if (next.profiles.length === 1) setLocator(next.profiles[0].profileId);
    if (next.state !== "authenticated") {
      closeProfileMenu();
      setActiveSurface("DASHBOARD");
    }
  }

  if (view.state === "authenticated") {
    const selectedMenuItem = DASHBOARD_MENU[dashboardSelection] ?? DASHBOARD_MENU[0];
    const businessUseCase = localAiOpen ? "LOCAL STORY MODE" : nodeOpen ? "NODE" : userProfileOpen ? "USER PROFILE" : profileMenuOpen ? "PROFILE" : activeSurface;
    return (
      <main className="pp-skin-v1-home" data-experience-surface={topology.activeSurfaces.includes(activeSurface) ? activeSurface : topology.defaultSurface}>
        <header className="pp-skin-v1-bar">
          <strong>PLOTPICKLE</strong>
          <span>{businessUseCase}</span>
          <span>SKIN V1</span>
          {activeSurface === "COMMUNITY" ? (
            <button className="pp-skin-v1-return" ref={returnButtonRef} type="button" onClick={() => openSurface("DASHBOARD")}>Back to Dashboard</button>
          ) : null}
        </header>

        {profileMenuOpen ? (
          localAiOpen ? (
            <section aria-label="Local Story Mode setup" onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); setLocalAiOpen(false); }
            }}>
              <div className="pp-skin-v1-bbs-banner">
                <h1 ref={localAiHeadingRef} tabIndex={-1}>LOCAL STORY MODE</h1>
                <button type="button" className="pp-skin-v1-return" onClick={() => setLocalAiOpen(false)}>Back to Profile</button>
              </div>
              <Suspense fallback={<p role="status">Loading Local Story Mode...</p>}><LocalAiSkinHost /></Suspense>
            </section>
          ) : nodeOpen ? (
            <section aria-label="Node information" onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); setNodeOpen(false); }
            }}>
              <div className="pp-skin-v1-bbs-banner">
                <h1>NODE</h1>
                <button type="button" className="pp-skin-v1-return" onClick={() => setNodeOpen(false)}>Back to Profile</button>
              </div>
              <Suspense fallback={<p role="status">Loading Node...</p>}><NodeSkinPanel /></Suspense>
            </section>
          ) : userProfileOpen ? (
            <Suspense fallback={<p role="status">Loading User Profile...</p>}>
              <ProfileSkinPanel onBack={() => setUserProfileOpen(false)} onSessionChanged={refreshSessionAfterProfileAction} />
            </Suspense>
          ) : (
            <section
              className="pp-skin-v1-dashboard"
              aria-label="Profile menu"
              data-skin-menu="profile"
              onKeyDown={(event) => {
                if (event.key === "Escape") { event.preventDefault(); closeProfileMenu(); }
              }}
            >
              <div className="pp-skin-v1-bbs">
                <div className="pp-skin-v1-bbs-banner">
                  <h1>PROFILE</h1>
                  <button type="button" className="pp-skin-v1-return" onClick={closeProfileMenu}>Back to Dashboard</button>
                </div>
                <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label="Profile directory" aria-describedby="profile-menu-status">
                  {PROFILE_MENU.map((item, index) => {
                    const selected = index === profileSelectedIndex;
                    const command = `[${item.shortcut}] ${item.label}`.padEnd(28, " ");
                    const clickDestination = item.id === "profile"
                      ? () => setUserProfileOpen(true)
                      : item.id === "local-ai"
                        ? () => setLocalAiOpen(true)
                        : item.id === "node"
                          ? () => setNodeOpen(true)
                          : () => undefined;
                    return (
                      <button
                        ref={(node) => { profileItemRefs.current[index] = node; }}
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        disabled={!item.enabled}
                        className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item${selected ? " is-selected" : ""}`}
                        data-profile-menu-item={item.id}
                        data-profile-shortcut={item.shortcut}
                        data-profile-connected="true"
                        data-skin-menu-row={item.id}
                        data-skin-menu-shortcut={item.shortcut}
                        data-skin-menu-connected="true"
                        onClick={() => {
                          setProfileSelectedIndex(index);
                          clickDestination();
                        }}
                        onKeyDown={(event) => handleProfileKeyDown(event, index)}
                      >
                        <span className="pp-skin-v1-dashboard-command-line">{command} - {item.description}</span>
                        <span
                          className="pp-skin-v1-dashboard-status-box is-active"
                          aria-label="Connected Profile destination"
                          data-dashboard-status="active"
                          data-skin-menu-indicator="connected"
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="pp-skin-v1-bbs-help" id="profile-menu-status">PROFILE / LOCAL STORY MODE / NODE CONNECTED — UP/DOWN OR SHORTCUT KEY: SELECT / ENTER: OPEN</p>
              </div>
            </section>
          )
        ) : activeSurface === "COMMUNITY" ? (
          <section aria-label="PlotPickle Community">
            <Suspense fallback={<p role="status">Loading Community...</p>}><CommunitySkinHost /></Suspense>
          </section>
        ) : (
          <DashboardBbsPanel
            items={DASHBOARD_MENU}
            selectedIndex={dashboardSelection}
            onActivate={activateDashboardItem}
            onKeyDown={dashboardMenuKeyDown}
            setItemRef={(index, node) => { dashboardMenuRefs.current[index] = node; }}
          />
        )}

        <footer className="pp-skin-v1-status">
          <span>BUSINESS USE CASE: {businessUseCase}</span>
          <span>SELECTED: {selectedMenuItem.label}</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="pp-skin-v1-logon" data-experience-surface="LOGON">
      <section className="pp-skin-v1-panel">
        <header className="pp-skin-v1-title">
          <strong>PLOTPICKLE</strong>
          <span>SKIN V1 / LOGON</span>
        </header>

        {view.state === "loading" ? <p>INITIALIZING LOGON...</p> : null}
        {view.state === "unavailable" ? <p role="alert">{view.message || error || "LOGON unavailable"}</p> : null}

        {recovery ? (
          <div className="pp-skin-v1-message">
            <p>RECOVERY SECRET / SAVE THIS NOW</p>
            <output className="pp-skin-v1-recovery">{recovery.recoverySecret}</output>
            <button type="button" onClick={() => void navigator.clipboard.writeText(recovery.recoverySecret)}>COPY SECRET</button>
            <label className="pp-skin-v1-check">
              <input type="checkbox" checked={recoverySaved} onChange={(event) => setRecoverySaved(event.target.checked)} />
              <span>I SAVED THE RECOVERY SECRET.</span>
            </label>
            {error ? <p role="alert">{error}</p> : null}
            <button type="button" disabled={busy || !recoverySaved} onClick={() => void completeFirstProfileSetup()}>
              {busy ? "ENTERING..." : "ENTER PLOTPICKLE"}
            </button>
          </div>
        ) : null}

        {!recovery && view.state === "setup" ? (
          <form onSubmit={createFirstProfile}>
            <p>CREATE FIRST HUMAN PROFILE</p>
            <label>
              <span>NAME</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={120} required autoFocus />
            </label>
            {view.requiresBootstrapProof ? (
              <label>
                <span>SERVER BOOTSTRAP PROOF</span>
                <input type="password" value={bootstrapProof} onChange={(event) => setBootstrapProof(event.target.value)} autoComplete="off" required />
              </label>
            ) : null}
            <label>
              <span>PASSPHRASE</span>
              <input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} autoComplete="new-password" required />
            </label>
            <label>
              <span>CONFIRM PASSPHRASE</span>
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required />
            </label>
            <small>12+ CHARACTERS. NUMERIC-ONLY PASSPHRASES ARE NOT ACCEPTED.</small>
            {error ? <p role="alert">{error}</p> : null}
            <button type="submit" disabled={busy}>{busy ? "CREATING..." : "CREATE PROFILE"}</button>
          </form>
        ) : null}

        {!recovery && view.state === "locked" ? (
          <form onSubmit={authenticate}>
            {view.profiles.length ? (
              <label>
                <span>PROFILE</span>
                <select value={locator} onChange={(event) => setLocator(event.target.value)} required autoFocus>
                  <option value="">SELECT PROFILE</option>
                  {view.profiles.map((profile) => (
                    <option key={profile.profileId} value={profile.profileId}>{profile.displayName}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                <span>PROFILE</span>
                <input value={locator} onChange={(event) => setLocator(event.target.value)} autoComplete="username" required autoFocus />
              </label>
            )}
            <label>
              <span>PASSPHRASE</span>
              <input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} autoComplete="current-password" required />
            </label>
            {error ? <p role="alert">{error}</p> : null}
            <button type="submit" disabled={busy}>{busy ? "ENTERING..." : "ENTER"}</button>
          </form>
        ) : null}

        <footer className="pp-skin-v1-status">
          <span>BUSINESS USE CASE: LOGON</span>
          <span>HARNESS AUTHORITY: CONNECTED</span>
        </footer>
      </section>
    </main>
  );
}
