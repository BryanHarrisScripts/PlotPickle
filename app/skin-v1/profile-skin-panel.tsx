"use client";

import { useCallback, useEffect, useState } from "react";
import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "../../core/storage/project-library-browser";
import {
  clearProfilePrivateBrowser,
  flushProfilePrivateWrites,
  persistActiveProfileProject,
} from "../../core/storage/profile-private-browser";
import ProfileIdentityPanel from "../profile-access/profile-identity-panel";

type Profile = {
  readonly profileId: string;
  readonly displayName: string;
  readonly avatarRef: string | null;
  readonly status: string;
};

type Status = {
  readonly authenticated: boolean;
  readonly profile: Profile | null;
  readonly csrfToken: string | null;
};

async function readStatus() {
  const response = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" });
  const body = await response.json() as Status & { message?: string };
  if (!response.ok) throw new Error(body.message || "The Profile service is unavailable.");
  return body;
}

async function profileAction(action: "lock" | "switch-profile" | "logout", csrfToken: string) {
  const response = await fetch("/api/auth/profile", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": csrfToken },
    body: JSON.stringify({ action }),
  });
  const body = await response.json() as { message?: string };
  if (!response.ok) throw new Error(body.message || `The ${action} action could not be completed.`);
}

export default function ProfileSkinPanel({
  onBack,
  onSessionChanged,
}: {
  readonly onBack: () => void;
  readonly onSessionChanged: () => Promise<void>;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [notice, setNotice] = useState("LOADING USER PROFILE...");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await readStatus();
    if (!next.authenticated || !next.profile || !next.csrfToken) {
      setStatus(null);
      setNotice("THIS HUMAN PROFILE IS NO LONGER AUTHENTICATED.");
      await onSessionChanged();
      return;
    }
    setStatus(next);
    setNotice("");
  }, [onSessionChanged]);

  useEffect(() => {
    void refresh().catch((cause) => {
      setStatus(null);
      setNotice(cause instanceof Error ? cause.message : "USER PROFILE COULD NOT BE LOADED.");
    });
  }, [refresh]);

  async function leave(action: "lock" | "switch-profile" | "logout") {
    if (!status?.csrfToken || busy) return;
    setBusy(true);
    setNotice(`${action.toUpperCase()}...`);
    try {
      await persistActiveProfileProject().catch(() => undefined);
      await flushProfilePrivateWrites().catch(() => undefined);
      await profileAction(action, status.csrfToken);
      clearProfilePrivateBrowser();
      window.localStorage.removeItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY);
      setStatus(null);
      await onSessionChanged();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "THE PROFILE ACTION FAILED.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pp-skin-v1-profile-surface" aria-label="User Profile" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); onBack(); }
    }}>
      <div className="pp-skin-v1-profile-banner">
        <span>*** PLOTPICKLE BBS ***</span>
        <strong>USER PROFILE</strong>
        <button type="button" className="pp-skin-v1-return" onClick={onBack} disabled={busy}>Back to Profile</button>
      </div>

      {status?.profile && status.csrfToken ? (
        <div className="pp-skin-v1-profile-original">
          <ProfileIdentityPanel
            profile={status.profile}
            csrfToken={status.csrfToken}
            onProfileChanged={refresh}
            onAddProfile={() => setNotice("ADD PROFILE REMAINS A LOGON-GATE ACTION. THIS USER PROFILE WAS NOT CHANGED.")}
            onLock={() => void leave("lock")}
            onSwitchProfile={() => void leave("switch-profile")}
            onLogout={() => void leave("logout")}
          />
        </div>
      ) : (
        <div className="pp-skin-v1-profile-loading" role="status">{notice || "LOADING USER PROFILE..."}</div>
      )}

      {notice && status ? <p className="pp-skin-v1-profile-notice" role="status" aria-live="polite">{notice}</p> : null}
    </section>
  );
}
