"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { browserProfileAuthGateway } from "../../adapters/experience/browser-profile-auth-gateway";
import type { ExperienceIntent } from "../../core/contracts/experience";
import {
  executeAuthenticateHumanIntent,
  readLogonViewModel,
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
  message: null,
};

function nextIntentId() {
  return globalThis.crypto?.randomUUID?.() ?? `intent-${Date.now()}`;
}

export default function SkinV1Client() {
  const [view, setView] = useState<LogonViewModel>(LOADING_VIEW);
  const [locator, setLocator] = useState("");
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readLogonViewModel(browserProfileAuthGateway)
      .then((next) => {
        setView(next);
        if (!locator && next.profiles.length === 1) setLocator(next.profiles[0].profileId);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : String(cause));
        setView({ ...LOADING_VIEW, state: "unavailable", message: "LOGON unavailable" });
      });
  }, [locator]);

  const topology = useMemo(
    () => deriveExperienceSurfaceTopology({ authenticated: view.state === "authenticated" }),
    [view.state],
  );

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
      const resolved = await executeAuthenticateHumanIntent({
        intent,
        credential,
        gateway: browserProfileAuthGateway,
      });
      setCredential("");
      setView(resolved.view);
      if (resolved.result.outcome !== "accepted") setError(resolved.result.reason || "LOGON rejected");
    } finally {
      setBusy(false);
    }
  }

  if (view.state === "authenticated") {
    return (
      <main className="pp-skin-v1-home" data-experience-surface={topology.defaultSurface}>
        <header className="pp-skin-v1-bar">
          <strong>PLOTPICKLE</strong>
          <span>HOME</span>
          <span>SKIN V1</span>
        </header>
        <section className="pp-skin-v1-blank" aria-label="PlotPickle Home">
          <p>HOME</p>
        </section>
        <footer className="pp-skin-v1-status">
          <span>EXPERIENCE CONTRACT: ONLINE</span>
          <span>ACTIVE SURFACE: {topology.defaultSurface}</span>
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

        {view.state === "locked" && !view.configured ? (
          <div className="pp-skin-v1-message">
            <p>NO HUMAN PROFILE CONFIGURED.</p>
            <p>INITIAL PROFILE CREATION HAS NOT YET BEEN MIGRATED TO THE HEADLESS EXPERIENCE LAYER.</p>
            <a href="/?skin=legacy">OPEN LEGACY SKIN FOR PROFILE SETUP</a>
          </div>
        ) : null}

        {view.state === "locked" && view.configured ? (
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
              <input
                type="password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                autoComplete="current-password"
                required
              />
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
