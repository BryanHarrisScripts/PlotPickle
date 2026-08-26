"use client";

import { useEffect, useState } from "react";
import { authenticatedProfileFetch } from "../core/auth/profile-request-browser";
import styles from "./buzz-settings.module.css";
import liveStyles from "./buzz-live-health-card.module.css";

type RoundTripState = "idle" | "testing" | "passed" | "failed";
type HealthResult = {
  ok: boolean;
  roundTrip: boolean;
  room?: string;
  sentAt?: string;
  receivedAt?: string;
  message: string;
};
type LocalActorHealth = {
  actorId: string;
  status: "ready" | "working" | "degraded" | "unavailable" | "unknown";
  stale: boolean;
  summary: string;
  occurredAt: string;
};
type LocalBackboneResult = {
  ok: boolean;
  localBackbone?: {
    overall: "ready" | "working" | "degraded" | "unavailable" | "unknown";
    actorCount: number;
    actors: LocalActorHealth[];
    recentEvidenceCount: number;
    verifiedEvidenceCount: number;
    improvementCandidateCount: number;
    checkedAt: string;
  };
  message: string;
};
type StoryBridgeDiagnostics = {
  ok: boolean;
  checkedAt: string;
  transport: { ready: boolean; message: string };
  humanIdentity: { ready: boolean; displayName: string; message: string };
  agentSigners: { ready: boolean; requiredCount: number; boundCount: number; tamsinReady: boolean };
  storyBridge: { ready: boolean; profileScoped: boolean; message: string };
  message?: string;
};

type DiagnosticRow = {
  label: string;
  ready: boolean;
  value: string;
  detail: string;
};

export default function BuzzLiveHealthCard() {
  const [roundTripState, setRoundTripState] = useState<RoundTripState>("idle");
  const [result, setResult] = useState<HealthResult | null>(null);
  const [localHealth, setLocalHealth] = useState<LocalBackboneResult | null>(null);
  const [diagnostics, setDiagnostics] = useState<StoryBridgeDiagnostics | null>(null);
  const [diagnosticError, setDiagnosticError] = useState("");
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);

  async function refreshLocalHealth() {
    try {
      const response = await authenticatedProfileFetch("/api/local-buzz/live-health", { cache: "no-store" });
      const body = await response.json() as LocalBackboneResult;
      setLocalHealth(body);
    } catch (error) {
      setLocalHealth({ ok: false, message: error instanceof Error ? error.message : "Local coordination health could not be loaded." });
    }
  }

  async function refreshDiagnostics() {
    setDiagnosticBusy(true);
    try {
      const response = await authenticatedProfileFetch("/api/story-workflow/buzz-bridge", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "diagnostics" }),
      });
      const body = await response.json() as StoryBridgeDiagnostics;
      if (!response.ok || !body.ok) throw new Error(body.message || `Story Bridge diagnostics returned ${response.status}.`);
      setDiagnostics(body);
      setDiagnosticError("");
    } catch (error) {
      setDiagnostics(null);
      setDiagnosticError(error instanceof Error ? error.message : "Story Bridge diagnostics could not be loaded.");
    } finally {
      setDiagnosticBusy(false);
    }
  }

  useEffect(() => {
    void refreshLocalHealth();
    void refreshDiagnostics();
    const timer = window.setInterval(() => void refreshDiagnostics(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function testLiveBuzz() {
    setRoundTripState("testing");
    setResult(null);
    try {
      const response = await authenticatedProfileFetch("/api/local-buzz/live-health", { method: "POST", headers: { "Content-Type": "application/json" } });
      const body = await response.json() as HealthResult;
      setResult(body);
      setRoundTripState(response.ok && body.roundTrip ? "passed" : "failed");
    } catch (error) {
      setResult({
        ok: false,
        roundTrip: false,
        message: error instanceof Error ? error.message : "PlotPickle could not run the BUZZ live test.",
      });
      setRoundTripState("failed");
    } finally {
      void refreshLocalHealth();
      void refreshDiagnostics();
    }
  }

  const diagnosticRows: DiagnosticRow[] = diagnostics ? [
    {
      label: "Community Transport",
      ready: diagnostics.transport.ready,
      value: diagnostics.transport.ready ? "Ready" : "Offline",
      detail: diagnostics.transport.message,
    },
    {
      label: "Human Identity",
      ready: diagnostics.humanIdentity.ready,
      value: diagnostics.humanIdentity.ready ? "Verified" : "Not verified",
      detail: diagnostics.humanIdentity.displayName
        ? `${diagnostics.humanIdentity.displayName} · ${diagnostics.humanIdentity.message}`
        : diagnostics.humanIdentity.message,
    },
    {
      label: "Agent Signers",
      ready: diagnostics.agentSigners.ready,
      value: `${diagnostics.agentSigners.boundCount}/${diagnostics.agentSigners.requiredCount} ready`,
      detail: diagnostics.agentSigners.tamsinReady
        ? "Tamsin Hearthquill and the required public BUZZ signer bindings are checked from the same Story Bridge runtime."
        : "Tamsin Hearthquill does not have a usable public signer binding on this runtime.",
    },
    {
      label: "Story Bridge",
      ready: diagnostics.storyBridge.ready,
      value: diagnostics.storyBridge.ready ? "Ready" : "Blocked",
      detail: diagnostics.storyBridge.message,
    },
  ] : [];
  const integrationReady = Boolean(diagnostics)
    && diagnosticRows.length === 4
    && diagnosticRows.every((row) => row.ready);
  const title = diagnosticBusy && !diagnostics
    ? "Checking BUZZ integration"
    : integrationReady
      ? "BUZZ integration ready"
      : "BUZZ integration needs attention";
  const badgeState = diagnosticBusy && !diagnostics ? "connecting" : integrationReady ? "connected" : "degraded";
  const badgeLabel = diagnosticBusy && !diagnostics ? "Checking" : integrationReady ? "Ready" : "Not ready";
  const local = localHealth?.localBackbone;
  const localTone = local?.overall || "unknown";
  const localSummary = local
    ? `${local.actorCount} active evidence source${local.actorCount === 1 ? "" : "s"} · ${local.recentEvidenceCount} recent event${local.recentEvidenceCount === 1 ? "" : "s"} · ${local.verifiedEvidenceCount} verified`
    : localHealth?.message || "No local coordination evidence has been observed yet.";
  const roundTripCopy = roundTripState === "testing"
    ? "Testing signed send-and-read round trip…"
    : roundTripState === "passed"
      ? result?.message || "Signed test message received from BUZZ."
      : roundTripState === "failed"
        ? result?.message || "Signed BUZZ round trip failed."
        : "Use the signed round-trip test when you want deeper proof than the automatic read-only diagnostics.";

  return <section className={`${styles.statusCard} ${liveStyles.statusCard}`} aria-labelledby="buzz-live-health-title" data-buzz-diagnostics="true">
    <div>
      <p>BUZZ · Diagnostics</p>
      <h2 id="buzz-live-health-title">{title}</h2>
      <p>These lights use the same active-Human Story Bridge path as Afterglow. They refresh automatically every 60 seconds without posting probe messages.</p>
      {diagnosticError ? <p className={liveStyles.errorText}>{diagnosticError}</p> : null}
      <div className={liveStyles.diagnosticGrid} aria-label="BUZZ integration diagnostics">
        {diagnosticRows.map((row) => (
          <article key={row.label} className={liveStyles.diagnosticRow} data-state={row.ready ? "connected" : "degraded"}>
            <div><span>{row.label}</span><strong>{row.value}</strong><small>{row.detail}</small></div>
            <i aria-hidden="true" />
          </article>
        ))}
        {!diagnostics && !diagnosticError ? <p>Reading the active BUZZ integration path…</p> : null}
      </div>
      {diagnostics?.checkedAt ? <small>Last checked {new Date(diagnostics.checkedAt).toLocaleTimeString()}.</small> : null}

      <div className={liveStyles.proofBlock}>
        <p><strong>Signed live proof</strong></p>
        <small>{roundTripCopy}</small>
        {result?.receivedAt ? <small> Signed test message received {new Date(result.receivedAt).toLocaleString()} via {result.room || "Great Hall"}.</small> : null}
      </div>

      <div data-buzz-local-backbone="true" className={liveStyles.proofBlock}>
        <p><strong>Local coordination: {localTone}</strong></p>
        <small>{localSummary}</small>
        {local?.actors.some((actor) => actor.stale) ? <small> Stale presence is shown as unknown rather than online.</small> : null}
      </div>

      <div className={`${styles.actions} ${liveStyles.actions}`}>
        <button type="button" disabled={roundTripState === "testing"} onClick={() => void testLiveBuzz()}>
          {roundTripState === "testing" ? "Testing live BUZZ…" : "Test signed BUZZ round trip"}
        </button>
        <button type="button" disabled={diagnosticBusy} onClick={() => void refreshDiagnostics()}>{diagnosticBusy ? "Refreshing…" : "Refresh diagnostics"}</button>
        <button type="button" onClick={() => void refreshLocalHealth()}>Refresh local coordination</button>
      </div>
    </div>
    <div className={`${styles.statusBadge} ${liveStyles.statusBadge}`} data-state={badgeState} role="status" aria-live="polite"><i aria-hidden="true" /><b>{badgeLabel}</b></div>
  </section>;
}
