"use client";

import { useEffect, useState } from "react";
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
    let shutdownToken = "";

    try {
      const begun = await nodeAction("begin-shutdown");
      shutdownToken = String(begun.shutdownToken || "");
      if (!shutdownToken) throw new Error("PlotPickle did not issue a graceful shutdown proof.");
      setNode(begun);

      await persistActiveProfileProject();
      await flushProfilePrivateWrites();

      const currentProfile = await parseJson<ProfileStatus>(await fetch("/api/auth/profile", {
        credentials: "same-origin",
        cache: "no-store",
      }));
      if (currentProfile.authenticated) {
        if (!currentProfile.csrfToken) {
          throw new Error("PlotPickle could not verify the active Human session for safe release.");
        }
        await logoutHumanProfile(currentProfile.csrfToken);
      }

      clearProfilePrivateBrowser();
      window.localStorage.removeItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY);
      setNode(await nodeAction("complete-shutdown", { shutdownToken }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
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

  const lifecycle = node?.lifecycle.state || "CHECKING";
  const shutdownDisabled = busy || !node || node.lifecycle.inProgress || ["SAVING", "SHUTTING DOWN", "STOPPED"].includes(lifecycle);

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
