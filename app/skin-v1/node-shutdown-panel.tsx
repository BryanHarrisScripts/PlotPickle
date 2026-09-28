"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "@/core/storage/project-library-browser";
import {
  clearProfilePrivateBrowser,
  flushProfilePrivateWrites,
  persistActiveProfileProject,
} from "@/core/storage/profile-private-browser";

type NodeStatus = {
  readonly lifecycle: {
    readonly state: string;
    readonly lastError: string;
    readonly inProgress: boolean;
  };
};

type ProfileStatus = {
  readonly authenticated: boolean;
  readonly csrfToken: string | null;
  readonly profiles?: readonly { readonly profileId: string; readonly displayName: string; readonly status: string }[];
};

const NODE_CONTROL_HEADERS = {
  "Content-Type": "application/json",
  "X-PlotPickle-Node-Control": "confirmed",
} as const;

async function responseJson(response: Response) {
  try {
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    if (!response.ok) return {};
    throw new Error("PlotPickle returned an unreadable local response.", { cause: error });
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const value = await responseJson(response);
  if (!response.ok) {
    throw new Error(typeof value.message === "string" ? value.message : "PlotPickle Node control is unavailable.");
  }
  return value as T;
}

async function nodeAction(action: string, payload: Record<string, unknown> = {}) {
  return parseJson<NodeStatus & { readonly shutdownToken?: string }>(await fetch("/api/system/node-control", {
    method: "POST",
    credentials: "same-origin",
    headers: NODE_CONTROL_HEADERS,
    body: JSON.stringify({ action, ...payload }),
  }));
}

async function logoutHumanProfile(csrfToken: string) {
  const response = await fetch("/api/auth/profile", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": csrfToken },
    body: JSON.stringify({ action: "logout" }),
  });
  const value = await responseJson(response);
  if (!response.ok) {
    throw new Error(typeof value.message === "string" ? value.message : "The Human session could not be released.");
  }
}

export default function NodeShutdownPanel({ onCancel }: { readonly onCancel: () => void }) {
  const [node, setNode] = useState<NodeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [profileBlocked, setProfileBlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockReady, setUnlockReady] = useState(false);
  const [profiles, setProfiles] = useState<NonNullable<ProfileStatus["profiles"]>>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [passphrase, setPassphrase] = useState("");

  useEffect(() => {
    void fetch("/api/system/node-control", { credentials: "same-origin", cache: "no-store" })
      .then((response) => parseJson<NodeStatus>(response))
      .then(setNode)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  async function shutDown() {
    if (busy || !node || node.lifecycle.inProgress) return;
    setBusy(true);
    setError("");
    setProfileBlocked(false);
    setUnlockReady(false);
    let shutdownToken = "";

    try {
      const begun = await nodeAction("begin-shutdown");
      shutdownToken = String(begun.shutdownToken || "");
      if (!shutdownToken) throw new Error("PlotPickle did not issue a graceful shutdown proof.");
      setNode(begun);

      const currentProfile = await parseJson<ProfileStatus>(await fetch("/api/auth/profile", {
        credentials: "same-origin",
        cache: "no-store",
      }));
      if (!currentProfile.authenticated || !currentProfile.csrfToken) {
        throw new Error("The Human profile is locked.");
      }
      await persistActiveProfileProject(currentProfile.csrfToken);
      await flushProfilePrivateWrites();
      await logoutHumanProfile(currentProfile.csrfToken);

      clearProfilePrivateBrowser();
      window.localStorage.removeItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY);
      setNode(await nodeAction("complete-shutdown", { shutdownToken }));
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      const locked = /Human profile is locked/i.test(detail);
      const message = locked
        ? "Shutdown is blocked because the active Human Profile is locked. Your work was not discarded. Unlock it here, then try Shut Down again."
        : detail;
      setProfileBlocked(locked);
      if (locked) {
        void fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" })
          .then((response) => parseJson<ProfileStatus>(response))
          .then((status) => {
            const available = (status.profiles || []).filter((item) => item.status === "active");
            setProfiles(available);
            const previous = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
            setSelectedProfileId(available.find((item) => item.profileId === previous)?.profileId || (available.length === 1 ? available[0].profileId : ""));
          })
          .catch((failure) => setError(failure instanceof Error ? failure.message : String(failure)));
      }
      setError(message);
      if (shutdownToken) {
        try {
          setNode(await nodeAction("block-shutdown", { shutdownToken, message }));
        } catch (blockError) {
          try {
            setNode(await parseJson<NodeStatus>(await fetch("/api/system/node-control", {
              credentials: "same-origin",
              cache: "no-store",
            })));
          } catch {
            // Preserve the original shutdown failure as the writer-facing error.
          }
          if (blockError instanceof Error) {
            console.warn("PlotPickle could not record the blocked Node state.", blockError);
          }
        }
      }
      setBusy(false);
    }
  }

  async function unlockProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unlocking || busy || !profileBlocked || !selectedProfileId || !passphrase) return;
    setUnlocking(true);
    setError("");
    try {
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", locator: selectedProfileId, password: passphrase }),
      });
      await parseJson<ProfileStatus>(response);
      const verified = await parseJson<ProfileStatus>(await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" }));
      if (!verified.authenticated || !verified.csrfToken) throw new Error("Profile unlock could not be verified. PlotPickle remains running.");
      window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, selectedProfileId);
      setPassphrase("");
      setProfileBlocked(false);
      setUnlockReady(true);
      setError("");
      setNode(await parseJson<NodeStatus>(await fetch("/api/system/node-control", { credentials: "same-origin", cache: "no-store" })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The profile could not be unlocked. PlotPickle remains running.");
    } finally {
      setUnlocking(false);
    }
  }

  const lifecycle = node?.lifecycle.state || "CHECKING";
  const shutdownDisabled = busy || unlocking || profileBlocked || !node || node.lifecycle.inProgress || ["SAVING", "SHUTTING DOWN", "STOPPED"].includes(lifecycle);

  return (
    <section aria-label="Shut Down Node" data-dashboard-review-surface="shutdown-node">
      <div className="pp-skin-v1-bbs-banner">
        <h1>SHUT DOWN NODE</h1>
        <button type="button" className="pp-skin-v1-return" onClick={onCancel} disabled={busy}>Back to Dashboard</button>
      </div>

      <div className="pp-skin-v1-bbs" data-skin-reference-panel="standard" style={{ padding: "var(--pp-skin-space-5)" }}>
        <h2 style={{ marginTop: 0 }}>Shut down this PlotPickle Node?</h2>
        <p>PlotPickle will save your work, close the current session, stop local services, and close this PlotPickle window.</p>
        <p>This shuts down PlotPickle only. It does not shut down or restart Windows.</p>
        <p role="status" aria-live="polite">NODE LIFECYCLE: {lifecycle}</p>
        {error || node?.lifecycle.lastError ? <p role="alert">{error || node?.lifecycle.lastError}</p> : null}
        {unlockReady ? <p role="status">Profile unlocked successfully. Shutdown is ready.</p> : null}
        {profileBlocked ? <form onSubmit={(event) => void unlockProfile(event)}>
          <label>Human Profile <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} required disabled={unlocking}>
            <option value="">Select profile</option>
            {profiles.map((item) => <option key={item.profileId} value={item.profileId}>{item.displayName}</option>)}
          </select></label>
          <label>Passphrase <input type="password" autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} required disabled={unlocking} /></label>
          <button type="submit" className="pp-skin-v1-return" disabled={unlocking || !selectedProfileId || !passphrase}>{unlocking ? "Unlocking…" : "Unlock Profile"}</button>
        </form> : null}
        <div style={{ display: "flex", gap: "var(--pp-skin-space-3)", flexWrap: "wrap" }}>
          <button type="button" className="pp-skin-v1-return" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="pp-skin-v1-return" onClick={() => void shutDown()} disabled={shutdownDisabled}>
            {busy ? lifecycle : "Shut Down Node"}
          </button>
        </div>
      </div>
    </section>
  );
}
