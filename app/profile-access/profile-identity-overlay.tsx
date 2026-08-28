"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PLOTPICKLE_OPEN_PROFILE_EVENT } from "../navigation/global-shortcuts";
import ProfileIdentityPanel from "./profile-identity-panel";
import styles from "./profile-identity-overlay.module.css";

type Profile = { readonly profileId: string; readonly displayName: string; readonly avatarRef: string | null; readonly status: string };
type Status = {
  readonly authenticated: boolean;
  readonly profile: Profile | null;
  readonly csrfToken: string | null;
};

const AUTH_READY_SELECTOR = '[aria-label="Active PlotPickle Human"]';

export default function ProfileIdentityOverlay() {
  const [boundaryReady, setBoundaryReady] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("The Profile service is unavailable.");
    const next = await response.json() as Status;
    setStatus(next.authenticated && next.profile ? next : null);
  }, []);

  useEffect(() => {
    const update = () => setBoundaryReady(Boolean(document.querySelector(AUTH_READY_SELECTOR)));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!boundaryReady) { setStatus(null); return; }
    void refresh().catch(() => setStatus(null));
  }, [boundaryReady, refresh]);

  useEffect(() => {
    const openProfile = () => {
      if (!boundaryReady) return;
      if (detailsRef.current) detailsRef.current.open = true;
      void refresh().catch(() => setStatus(null));
    };
    window.addEventListener(PLOTPICKLE_OPEN_PROFILE_EVENT, openProfile);
    return () => window.removeEventListener(PLOTPICKLE_OPEN_PROFILE_EVENT, openProfile);
  }, [boundaryReady, refresh]);

  function dispatch(action: "add-profile" | "lock" | "switch-profile" | "logout") {
    window.dispatchEvent(new CustomEvent("plotpickle:profile-action", { detail: action }));
  }

  if (!boundaryReady || !status?.profile || !status.csrfToken) return null;

  return (
    <div className={styles.overlay} aria-label="PlotPickle Profile">
      <details className={styles.details} ref={detailsRef} data-disable-global-shortcuts="true">
        <summary className={styles.trigger} title="Profile · H">Profile</summary>
        <div className={styles.surface}>
          <ProfileIdentityPanel
            profile={status.profile}
            csrfToken={status.csrfToken}
            onProfileChanged={refresh}
            onAddProfile={() => dispatch("add-profile")}
            onLock={() => dispatch("lock")}
            onSwitchProfile={() => dispatch("switch-profile")}
            onLogout={() => dispatch("logout")}
          />
        </div>
      </details>
    </div>
  );
}
