"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, PROJECT_LIBRARY_CHANGED_EVENT } from "@/core/storage/project-library-browser";
import { PLOTPICKLE_VERSION } from "@/lib/runtime/application-version";
import {
  clearProfilePrivateBrowser,
  flushProfilePrivateWrites,
  getProfilePrivateSaveState,
  persistActiveProfileProject,
  PROFILE_PRIVATE_SAVE_STATE_EVENT,
} from "@/core/storage/profile-private-browser";
import CommunityPublicConversationsRail from "./_components/community/community-public-conversations-rail";
import {
  PLOTPICKLE_OPEN_NODE_EVENT,
  PLOTPICKLE_OPEN_PROFILE_EVENT,
  WORKFLOW_SHORTCUTS,
  globalShortcutBlocked,
  shortcutForKey,
  type GlobalShortcut,
  type RootWorkspace,
} from "./navigation/global-shortcuts";
import styles from "./plotpickle-workspace-shell.module.css";

export type { RootWorkspace } from "./navigation/global-shortcuts";

export const ROOT_NAV_ITEMS = WORKFLOW_SHORTCUTS;

type NodeLifecycle = { readonly state: string; readonly lastError: string; readonly inProgress: boolean };
type NodeStatus = {
  readonly node: { readonly id: string; readonly shortId: string };
  readonly lifecycle: NodeLifecycle;
  readonly launcher: { readonly browserOwnership: string; readonly shutdownSignalConfigured: boolean };
};
type ProfileStatus = { readonly authenticated: boolean; readonly profile: { readonly displayName: string } | null; readonly csrfToken: string | null };
type TopologyStatus = { readonly currentNode?: { readonly readiness?: string; readonly capabilities?: readonly string[] } };

const NODE_CONTROL_HEADERS = { "Content-Type": "application/json", "X-PlotPickle-Node-Control": "confirmed" } as const;

async function responseJson(response: Response) {
  try { return await response.json() as Record<string, unknown>; }
  catch (error) {
    if (!response.ok) return {};
    throw new Error("PlotPickle returned an unreadable local response.", { cause: error });
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const value = await responseJson(response);
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "PlotPickle Node control is unavailable.");
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
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "The Human session could not be released.");
}

function NodeControl() {
  const [node, setNode] = useState<NodeStatus | null>(null);
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [topology, setTopology] = useState<TopologyStatus | null>(null);
  const [projectTitle, setProjectTitle] = useState("No active project");
  const [save, setSave] = useState(getProfilePrivateSaveState());
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [nodeStatus, profileStatus, topologyStatus] = await Promise.all([
      fetch("/api/system/node-control", { credentials: "same-origin", cache: "no-store" }).then((result) => parseJson<NodeStatus>(result)),
      fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" }).then((result) => parseJson<ProfileStatus>(result)),
      fetch("/api/system/node-topology", { credentials: "same-origin", cache: "no-store" }).then((result) => parseJson<TopologyStatus>(result)),
    ]);
    setNode(nodeStatus);
    setProfile(profileStatus);
    setTopology(topologyStatus);
    try { setProjectTitle(loadFoundationProject().title || "Untitled Story"); } catch { setProjectTitle("No active project"); }
    setSave(getProfilePrivateSaveState());
  }, []);

  useEffect(() => {
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [refresh]);
  useEffect(() => {
    const projectChanged = () => {
      try { setProjectTitle(loadFoundationProject().title || "Untitled Story"); } catch { setProjectTitle("No active project"); }
      setSave(getProfilePrivateSaveState());
    };
    const saveChanged = () => setSave(getProfilePrivateSaveState());
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, projectChanged);
    window.addEventListener(PROFILE_PRIVATE_SAVE_STATE_EVENT, saveChanged);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, projectChanged);
      window.removeEventListener(PROFILE_PRIVATE_SAVE_STATE_EVENT, saveChanged);
    };
  }, []);
  useEffect(() => {
    const openNode = () => {
      setOpen(true);
      void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    };
    window.addEventListener(PLOTPICKLE_OPEN_NODE_EVENT, openNode);
    return () => window.removeEventListener(PLOTPICKLE_OPEN_NODE_EVENT, openNode);
  }, [refresh]);

  async function shutDown() {
    if (busy || node?.lifecycle.inProgress) return;
    setBusy(true);
    setConfirming(false);
    setError("");
    let shutdownToken = "";
    try {
      const begun = await nodeAction("begin-shutdown");
      shutdownToken = String(begun.shutdownToken || "");
      if (!shutdownToken) throw new Error("PlotPickle did not issue a graceful shutdown proof.");
      setNode(begun);

      await persistActiveProfileProject();
      await flushProfilePrivateWrites();
      setSave(getProfilePrivateSaveState());

      const currentProfile = await parseJson<ProfileStatus>(await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" }));
      if (currentProfile.authenticated) {
        if (!currentProfile.csrfToken) throw new Error("PlotPickle could not verify the active Human session for safe release.");
        await logoutHumanProfile(currentProfile.csrfToken);
      }
      clearProfilePrivateBrowser();
      window.localStorage.removeItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY);

      setNode(await nodeAction("complete-shutdown", { shutdownToken }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      if (shutdownToken) {
        try { setNode(await nodeAction("block-shutdown", { shutdownToken, message })); }
        catch (blockError) {
          try {
            setNode(await parseJson<NodeStatus>(await fetch("/api/system/node-control", { credentials: "same-origin", cache: "no-store" })));
          } catch (refreshError) {
            const detail = refreshError instanceof Error ? refreshError.message : String(refreshError);
            setError(`${message} PlotPickle also could not refresh the blocked Node state: ${detail}`);
          }
          if (blockError instanceof Error) console.warn("PlotPickle could not record the blocked Node state.", blockError);
        }
      }
      setBusy(false);
    }
  }

  const readiness = topology?.currentNode?.readiness || "unknown";
  const capabilities = topology?.currentNode?.capabilities?.filter((item) => !["client", "host"].includes(item)).slice(0, 5).join(", ") || "local core";
  const lifecycle = node?.lifecycle.state || "RUNNING";
  const shutdownDisabled = busy || lifecycle === "SAVING" || lifecycle === "SHUTTING DOWN" || lifecycle === "STOPPED";

  return <div className={styles.nodeControl}>
    <button
      type="button"
      className={styles.nodeButton}
      aria-label={`PlotPickle Node ${node?.node.shortId || "control"}`}
      aria-expanded={open}
      title="Node · Profile home"
      onClick={() => {
        const next = !open;
        setOpen(next);
        if (next) void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
      }}
    >
      <Image className={styles.nodeMark} src="/brand/plotpickle-ouroboros-v3-transparent.png" alt="" width={44} height={44} priority />
      <span>Node</span>
      <small>{node?.node.shortId || "PP-····"}</small>
    </button>

    {open ? <section className={styles.nodePanel} aria-label="PlotPickle Node control panel" data-disable-global-shortcuts="true">
      <header className={styles.nodePanelHeader}><div><small>LOCAL NODE</small><strong>{node?.node.shortId || "PlotPickle Node"}</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Close Node panel">Close</button></header>
      <dl className={styles.nodeRows}>
        <div><dt>Full Node ID</dt><dd className={styles.nodeId}>{node?.node.id || "Loading…"}</dd></div>
        <div><dt>Version</dt><dd>{PLOTPICKLE_VERSION}</dd></div>
        <div><dt>Lifecycle</dt><dd>{lifecycle}</dd></div>
        <div><dt>Active Human</dt><dd>{profile?.profile?.displayName || "Locked"}</dd></div>
        <div><dt>Current project</dt><dd>{projectTitle}</dd></div>
        <div><dt>Save state</dt><dd>{save.state === "saved" ? "Saved" : save.state === "saving" ? "Unsaved changes" : "Unsaved · save blocked"}</dd></div>
        <div><dt>Readiness</dt><dd>{readiness} · {capabilities}</dd></div>
      </dl>
      {node?.launcher.browserOwnership !== "managed-edge-app" ? <p className={styles.nodeWarning}>This session was not opened as a launcher-owned PlotPickle app window. Shutdown will never kill unrelated browser processes.</p> : null}
      {error || node?.lifecycle.lastError ? <p className={styles.nodeError} role="alert">{error || node?.lifecycle.lastError}</p> : null}
      <div className={styles.nodeActions}><button type="button" className={styles.nodeDangerButton} disabled={shutdownDisabled} onClick={() => setConfirming(true)}>{busy ? lifecycle : "Shut Down PlotPickle"}</button></div>
    </section> : null}

    {confirming ? <div className={styles.nodeConfirmBackdrop} role="presentation"><section className={styles.nodeConfirmCard} role="dialog" aria-modal="true" aria-labelledby="plotpickle-node-shutdown-title"><h2 id="plotpickle-node-shutdown-title">Shut down this PlotPickle Node?</h2><p>PlotPickle will save your work, close the current session, stop local services, and close this PlotPickle window.</p><div><button type="button" onClick={() => setConfirming(false)}>Cancel</button><button type="button" className={styles.nodeDangerButton} onClick={() => void shutDown()}>Shut Down PlotPickle</button></div></section></div> : null}
  </div>;
}

export default function PlotPickleWorkspaceShell({
  activeWorkspace,
  activeShortcutId,
  children,
  onNavigate,
}: {
  readonly activeWorkspace: RootWorkspace;
  readonly activeShortcutId?: string;
  readonly children: ReactNode;
  readonly onNavigate: (workspace: RootWorkspace) => void;
}) {
  const router = useRouter();

  const runShortcut = useCallback((shortcut: GlobalShortcut) => {
    if (shortcut.action.kind === "workspace") {
      onNavigate(shortcut.action.workspace);
      return;
    }
    if (shortcut.action.kind === "route") {
      router.push(shortcut.action.href);
      return;
    }
    if (shortcut.action.kind === "node") {
      window.dispatchEvent(new Event(PLOTPICKLE_OPEN_NODE_EVENT));
      return;
    }
    window.dispatchEvent(new Event(PLOTPICKLE_OPEN_PROFILE_EVENT));
  }, [onNavigate, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (globalShortcutBlocked(event)) return;
      const shortcut = shortcutForKey(event.key);
      if (!shortcut) return;
      event.preventDefault();
      runShortcut(shortcut);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runShortcut]);

  return (
    <div className={styles.shell} data-active-workspace={activeWorkspace} data-active-shortcut={activeShortcutId || activeWorkspace}>
      <nav
        aria-label="PlotPickle global workflow"
        className={styles.navigator}
        data-plotpickle-global-nav="v3"
      >
        <NodeControl />

        <div className={styles.scroller}>
          <ol className={styles.list} data-workspace-navigation="true">
            {WORKFLOW_SHORTCUTS.map((item) => {
              const active = activeShortcutId
                ? item.id === activeShortcutId
                : item.action.kind === "workspace" && item.action.workspace === activeWorkspace;
              return (
                <li
                  className={active ? styles.active : undefined}
                  data-workspace-nav-id={item.id}
                  key={item.id}
                >
                  <button
                    aria-current={active ? "page" : undefined}
                    disabled={active}
                    onClick={() => runShortcut(item)}
                    title={`${item.label} · ${item.detail}`}
                    type="button"
                  >
                    <Image alt="" aria-hidden="true" className={styles.relic} height={44} src={item.relic} width={44} />
                    <span className={styles.copy}><strong>{item.label}</strong><small>{item.detail}</small></span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      <div className={styles.workspaceFrame} data-workspace-frame="true">{children}</div>
      {activeWorkspace === "community" ? <CommunityPublicConversationsRail /> : null}
    </div>
  );
}
