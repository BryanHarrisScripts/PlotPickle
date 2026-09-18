"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PLOTPICKLE_OPEN_PROFILE_EVENT } from "../navigation/global-shortcuts";
import styles from "./uat-guide-panel.module.css";

type GuideEvent = {
  at?: string;
  label?: string;
  detail?: string;
  surface?: string;
  state?: string;
};

type GuideStatus = {
  runId?: string;
  status?: "running" | "pass" | "fail";
  startedAt?: string;
  completedAt?: string;
  current?: {
    agent?: string;
    check?: string;
    surface?: string;
    storyAddress?: string;
    state?: string;
  };
  events?: GuideEvent[];
  evidence?: {
    verificationInbox?: string;
    webmcp?: string;
    findings?: string;
    afterglow?: string;
  };
};

type Payload = {
  enabled: boolean;
  status: GuideStatus | null;
  canMirrorWindows: boolean;
  isolation: string;
  providerSpendAllowed: boolean;
  verificationInbox: string;
  message?: string;
};

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "UAT Guide request failed.");
  return body;
}

async function csrfToken() {
  const response = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" });
  const body = await json<{ authenticated: boolean; csrfToken: string | null }>(response);
  if (!body.authenticated || !body.csrfToken) throw new Error("PROFILE_UNLOCK_REQUIRED");
  return body.csrfToken;
}

async function ensureLocalStoryMode() {
  const response = await fetch("/api/story-mode/policy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "local" }),
  });
  const body = await response.json() as { ok?: boolean; mode?: string; message?: string };
  if (!response.ok || !body.ok || body.mode !== "local") throw new Error(body.message || "PlotPickle could not switch Story Mode to Local.");
  window.dispatchEvent(new CustomEvent("plotpickle:story-mode-policy-change", { detail: "local" }));
}

function time(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function UatGuidePanel({ mode }: { readonly mode: "settings" | "dashboard" }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [startPending, setStartPending] = useState(false);
  const [mirrorWindows, setMirrorWindows] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await json<Payload>(await fetch("/api/auth/uat-guide", { credentials: "same-origin", cache: "no-store" }));
      setPayload(next);
      if (next.status) setStartPending(false);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "UAT Guide is unavailable.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (payload?.status?.status !== "running" && !startPending) return;
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [payload?.status?.status, refresh, startPending]);

  const recentEvents = useMemo(() => (payload?.status?.events || []).slice(-8).reverse(), [payload?.status?.events]);

  function requestProfileUnlock() {
    window.dispatchEvent(new Event(PLOTPICKLE_OPEN_PROFILE_EVENT));
    setMessage("Story Mode is LOCAL. Unlock your Human profile, then select Show Start UAT Guide again.");
  }

  async function setEnabled(enabled: boolean) {
    setBusy(true);
    try {
      if (enabled) {
        await ensureLocalStoryMode();
        setMessage("UAT uses Local Story Mode. PlotPickle switched Story Mode to LOCAL automatically.");
      }
      const csrf = await csrfToken();
      await json(await fetch("/api/auth/uat-guide", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": csrf },
        body: JSON.stringify({ action: "set-enabled", enabled }),
      }));
      await refresh();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "UAT preference could not be saved.";
      if (detail === "PROFILE_UNLOCK_REQUIRED" || /session is invalid or expired|unlock a human profile/i.test(detail)) requestProfileUnlock();
      else setMessage(detail);

    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      await ensureLocalStoryMode();
      setMessage("UAT uses Local Story Mode. PlotPickle switched Story Mode to LOCAL automatically.");
      const csrf = await csrfToken();
      const response = await fetch("/api/auth/uat-guide", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": csrf },
        body: JSON.stringify({ action: "start", mirrorWindows: payload?.canMirrorWindows && mirrorWindows }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok && response.status !== 409) throw new Error(body.message || "UAT Guide could not start.");
      setStartPending(true);
      setMessage(body.message || "UAT Guide started.");
      await refresh();
    } catch (error) {
      setStartPending(false);
      const detail = error instanceof Error ? error.message : "UAT Guide could not start.";
      if (detail === "PROFILE_UNLOCK_REQUIRED" || /session is invalid or expired|unlock a human profile/i.test(detail)) requestProfileUnlock();
      else setMessage(detail);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "dashboard" && !payload?.enabled) return null;

  if (mode === "settings") {
    return (
      <section className={styles.settings} aria-labelledby="uat-tools-title" data-uat-guide-settings="profile-owned">
        <div>
          <p>QUALITY / HUMAN UAT</p>
          <h3 id="uat-tools-title">UAT tools</h3>
          <span>Enable the local acceptance guide for this Human profile. UAT automatically switches Story Mode to LOCAL before it runs, so the default acceptance pass cannot spend cloud-provider credits. The scanner still uses a separate synthetic Human and never inherits this profile&apos;s private story, cookies or credentials.</span>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={payload?.enabled ?? false}
            disabled={busy}
            onChange={(event) => void setEnabled(event.currentTarget.checked)}
          />
          <span><strong>Show Start UAT Guide</strong><small>Selecting this automatically switches Story Mode to Local. If your Human session needs renewal, PlotPickle opens Profile unlock instead of disabling this control.</small></span>
        </label>
        {message ? <p className={styles.message} role="status">{message}</p> : null}
      </section>
    );
  }

  const status = payload?.status;
  const running = status?.status === "running";
  const resultLabel = status?.status === "pass" ? "PASS" : status?.status === "fail" ? "NEEDS ATTENTION" : running ? "RUNNING" : "READY";

  return (
    <section className={styles.panel} aria-labelledby="uat-guide-title" data-uat-guide="human-facing">
      <header className={styles.heading}>
        <div>
          <p>QUALITY / UAT GUIDE</p>
          <h2 id="uat-guide-title">Start UAT</h2>
          <span>Run the isolated Writer-to-Screen acceptance pass and see what PlotPickle is checking in plain language. Starting UAT automatically switches Story Mode to LOCAL.</span>
        </div>
        <strong data-state={status?.status || "ready"}>{resultLabel}</strong>
      </header>

      <div className={styles.actions}>
        <button type="button" onClick={() => void start()} disabled={busy || running || startPending}>
          {running ? "UAT RUNNING" : busy || startPending ? "STARTING…" : "START UAT GUIDE"}
        </button>
        {payload?.canMirrorWindows ? (
          <label>
            <input type="checkbox" checked={mirrorWindows} onChange={(event) => setMirrorWindows(event.currentTarget.checked)} disabled={running} />
            <span>Mirror status in a Windows command window</span>
          </label>
        ) : null}
        <Link href={payload?.verificationInbox || "/verification-inbox"}>Verification Inbox</Link>
      </div>

      <div className={styles.current} aria-live="polite">
        <span><b>Agent</b>{status?.current?.agent || "UAT Guide"}</span>
        <span><b>Current check</b>{status?.current?.check || "Ready to start"}</span>
        <span><b>Surface</b>{status?.current?.surface || "Not started"}</span>
        <span><b>Story address</b>{status?.current?.storyAddress || "Block 17 / Mini-Block 1"}</span>
      </div>

      <p className={styles.boundary}>Synthetic Human isolation · no Human cookies or credentials · no private story reads · no provider spend · deterministic verification owns PASS/FAIL.</p>
      {message ? <p className={styles.message} role="status">{message}</p> : null}

      {recentEvents.length ? (
        <ol className={styles.events} aria-label="Recent UAT Guide events">
          {recentEvents.map((event, index) => (
            <li key={`${event.at || "event"}-${index}`}>
              <time dateTime={event.at}>{time(event.at)}</time>
              <div><strong>{event.label || "UAT event"}</strong>{event.detail ? <span>{event.detail}</span> : null}</div>
              <b>{event.state || "RUNNING"}</b>
            </li>
          ))}
        </ol>
      ) : null}

      {status?.evidence ? (
        <details className={styles.evidence}>
          <summary>Evidence references</summary>
          <code>{status.evidence.webmcp}</code>
          <code>{status.evidence.findings}</code>
          <code>{status.evidence.afterglow}</code>
        </details>
      ) : null}
    </section>
  );
}
