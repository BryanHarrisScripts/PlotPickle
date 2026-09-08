"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { browserProfileAuthGateway } from "../../adapters/experience/browser-profile-auth-gateway";
import type { ExperienceIntent } from "../../core/contracts/experience";
import {
  executeAuthenticateHumanIntent,
  executeCompleteFirstHumanProfileSetupIntent,
  executeCreateFirstHumanProfileIntent,
  readLogonViewModel,
  type FirstProfileRecovery,
  type LogonViewModel,
} from "../../lib/experience/logon-use-case";
import { deriveExperienceSurfaceTopology } from "../../lib/experience/surface-registry";

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
  groupStart?: boolean;
}>;

const DASHBOARD_MENU: readonly DashboardMenuItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "community", label: "Community", groupStart: true },
  { id: "library", label: "Library" },
  { id: "plan", label: "Plan", groupStart: true },
  { id: "storyboard", label: "Storyboard" },
  { id: "previs", label: "Previs" },
  { id: "write", label: "Write", groupStart: true },
  { id: "edit", label: "Edit" },
  { id: "feedback", label: "Feedback" },
  { id: "refine", label: "Refine" },
  { id: "reports", label: "Reports", groupStart: true },
  { id: "settings", label: "Settings" },
  { id: "profile", label: "Profile" },
  { id: "learn", label: "Learn - Education", groupStart: true },
  { id: "wyrmwood", label: "Wyrmwood - Learning Game" },
  { id: "story", label: "Story - The Unwritten" },
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
  const [dashboardSelection, setDashboardSelection] = useState(0);
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

  if (view.state === "authenticated") {
    const selectedMenuItem = DASHBOARD_MENU[dashboardSelection] ?? DASHBOARD_MENU[0];
    return (
      <main className="pp-skin-v1-home" data-experience-surface={topology.defaultSurface}>
        <header className="pp-skin-v1-bar">
          <strong>PLOTPICKLE</strong>
          <span>DASHBOARD</span>
          <span>SKIN V1</span>
        </header>

        <section className="pp-skin-v1-dashboard" aria-label="PlotPickle Dashboard">
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
                    onClick={() => setDashboardSelection(index)}
                    onKeyDown={(event) => dashboardMenuKeyDown(event, index)}
                  >
                    <span className="pp-skin-v1-menu-cursor" aria-hidden="true">{selected ? ">" : " "}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pp-skin-v1-bbs-help">
              <span>UP/DOWN: SELECT</span>
              <span>ENTER: SELECT</span>
              <span>MENU ITEMS ARE NOT CONNECTED YET</span>
            </div>
          </div>
        </section>

        <footer className="pp-skin-v1-status">
          <span>BUSINESS USE CASE: DASHBOARD</span>
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
