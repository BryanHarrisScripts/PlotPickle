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

const CommunitySkinHost = lazy(() => import("../_components/community/community-skin-host"));
const LocalAiSkinHost = lazy(() => import("./local-ai-skin-host"));
const NodeSkinPanel = lazy(() => import("./node-skin-panel"));
const ProfileSkinPanel = lazy(() => import("./profile-skin-panel"));

const PROFILE_MENU = [
  { id: "profile", label: "PROFILE", description: "YOUR PROFILE", enabled: true },
  { id: "local-ai", label: "LOCAL AI", description: "LOCAL CONFIGURATIONS", enabled: true },
  { id: "node", label: "NODE", description: "NODE INFO", enabled: true },
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

type DashboardMenuItem = Readonly<{
  id: string;
  label: string;
  description: string;
  groupStart?: boolean;
}>;

const DASHBOARD_MENU: readonly DashboardMenuItem[] = [
  { id: "dashboard", label: "Dashboard", description: "Your PlotPickle command centre" },
  { id: "community", label: "Community", description: "Talk, share, collaborate with others", groupStart: true },
  { id: "library", label: "Library", description: "Browse stories and learning resources" },
  { id: "plan", label: "Plan", description: "Shape story structure and direction", groupStart: true },
  { id: "storyboard", label: "Storyboard", description: "Visualize scenes before you write" },
  { id: "previs", label: "Previs", description: "Preview shots, timing and motion" },
  { id: "write", label: "Write", description: "Write scenes, dialogue and action", groupStart: true },
  { id: "edit", label: "Edit", description: "Review and improve the screenplay" },
  { id: "feedback", label: "Feedback", description: "Gather notes, decisions and reactions" },
  { id: "refine", label: "Refine", description: "Polish story choices with purpose" },
  { id: "reports", label: "Reports", description: "Review story health and readiness", groupStart: true },
  { id: "settings", label: "Settings", description: "Configure PlotPickle tools and connections" },
  { id: "profile", label: "Profile", description: "Manage your identity and preferences" },
  { id: "learn", label: "Learn - Education", description: "Learn PlotPickle and story craft", groupStart: true },
  { id: "wyrmwood", label: "Wyrmwood - Learning Game", description: "Practice story craft through play" },
  { id: "story", label: "Story - The Unwritten", description: "Explore the unwritten story experience" },
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
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [localAiOpen, setLocalAiOpen] = useState(false);
  const [nodeOpen, setNodeOpen] = useState(false);
  const profileMenuHeadingRef = useRef<HTMLHeadingElement>(null);
  const localAiHeadingRef = useRef<HTMLHeadingElement>(null);
  const [dashboardSelection, setDashboardSelection] = useState(0);
  const [activeSurface, setActiveSurface] = useState<ExperienceSurfaceId>("DASHBOARD");
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const dashboardMenuRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
    else if (profileMenuOpen) profileMenuHeadingRef.current?.focus();
    else if (activeSurface === "COMMUNITY") returnButtonRef.current?.focus();
    else if (view.state === "authenticated") dashboardMenuRefs.current[dashboardSelection]?.focus();
  }, [activeSurface, view.state, dashboardSelection, profileMenuOpen, userProfileOpen, localAiOpen, nodeOpen]);

  function openSurface(surfaceId: ExperienceSurfaceId) {
    const result = executeOpenSurfaceIntent({
      type: "OpenSurface", intentId: nextIntentId(), surfaceId, baseRevision: null,
    }, { authenticated: view.state === "authenticated" });
    if (result.outcome === "accepted") setActiveSurface(surfaceId);
  }

  function activateDashboardItem(index: number) {
    setDashboardSelection(index);
    if (DASHBOARD_MENU[index]?.id === "profile") {
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
    const businessUseCase = localAiOpen ? "LOCAL AI" : nodeOpen ? "NODE" : userProfileOpen ? "USER PROFILE" : profileMenuOpen ? "PROFILE" : activeSurface;
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
            <section aria-label="Local AI setup" onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); setLocalAiOpen(false); }
            }}>
              <div className="pp-skin-v1-bbs-banner">
                <h1 ref={localAiHeadingRef} tabIndex={-1}>LOCAL AI</h1>
                <button type="button" className="pp-skin-v1-return" onClick={() => setLocalAiOpen(false)}>Back to Profile</button>
              </div>
              <Suspense fallback={<p role="status">Loading Local AI...</p>}><LocalAiSkinHost /></Suspense>
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
            <section className="pp-skin-v1-dashboard" aria-label="Profile menu" onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); closeProfileMenu(); }
            }}>
              <div className="pp-skin-v1-bbs">
                <div className="pp-skin-v1-bbs-banner">
                  <h1 ref={profileMenuHeadingRef} tabIndex={-1}>PROFILE</h1>
                  <button type="button" className="pp-skin-v1-return" onClick={closeProfileMenu}>Back to Dashboard</button>
                </div>
                <div className="pp-skin-v1-menu" aria-describedby="profile-menu-status">
                  {PROFILE_MENU.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.enabled}
                      className="pp-skin-v1-menu-item pp-skin-v1-submenu-item"
                      onClick={item.id === "profile" ? () => setUserProfileOpen(true) : item.id === "local-ai" ? () => setLocalAiOpen(true) : item.id === "node" ? () => setNodeOpen(true) : undefined}
                    >
                      <span aria-hidden="true">&gt;</span>
                      <span className="pp-skin-v1-menu-label">{item.label}</span>
                      <small className="pp-skin-v1-menu-description">{item.description}</small>
                    </button>
                  ))}
                </div>
                <p className="pp-skin-v1-bbs-help" id="profile-menu-status">PROFILE / LOCAL AI / NODE CONNECTED</p>
              </div>
            </section>
          )
        ) : activeSurface === "COMMUNITY" ? (
          <section aria-label="PlotPickle Community">
            <Suspense fallback={<p role="status">Loading Community...</p>}><CommunitySkinHost /></Suspense>
          </section>
        ) : <section className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs" aria-label="PlotPickle Dashboard">
          <div className="pp-skin-v1-bbs">
            <div className="pp-skin-v1-bbs-banner" aria-hidden="true">
              <span>*** PLOTPICKLE BBS ***</span>
              <span>DASHBOARD</span>
            </div>

            <div className="pp-skin-v1-menu" role="listbox" aria-label="Dashboard menu">
              {DASHBOARD_MENU.map((item, index) => {
                const selected = index === dashboardSelection;
                return (
                  <button
                    key={item.id}
                    ref={(node) => { dashboardMenuRefs.current[index] = node; }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    className={`pp-skin-v1-menu-item${selected ? " is-selected" : ""}${item.groupStart ? " is-group-start" : ""}`}
                    data-dashboard-menu-item={item.id}
                    onClick={() => activateDashboardItem(index)}
                    onKeyDown={(event) => dashboardMenuKeyDown(event, index)}
                  >
                    <span className="pp-skin-v1-menu-cursor" aria-hidden="true">{selected ? ">" : " "}</span>
                    <span className="pp-skin-v1-menu-label">{item.label}</span>
                    <small className="pp-skin-v1-menu-description">{item.description}</small>
                  </button>
                );
              })}
            </div>

            <div className="pp-skin-v1-bbs-help">
              <span>UP/DOWN: SELECT</span>
              <span>ENTER: OPEN COMMUNITY / PROFILE</span>
              <span>OTHER MENU ITEMS ARE NOT CONNECTED YET</span>
            </div>
          </div>
        </section>}

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
