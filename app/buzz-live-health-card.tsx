"use client";

import { useEffect, useState } from "react";
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

export default function BuzzLiveHealthCard() {
  const [roundTripState, setRoundTripState] = useState<RoundTripState>("idle");
  const [result, setResult] = useState<HealthResult | null>(null);
  const [localHealth, setLocalHealth] = useState<LocalBackboneResult | null>(null);

  async function refreshLocalHealth() {
    try {
      const response = await fetch("/api/local-buzz/live-health", { cache: "no-store" });
      const body = await response.json() as LocalBackboneResult;
      setLocalHealth(body);
    } catch (error) {
      setLocalHealth({ ok: false, message: error instanceof Error ? error.message : "Local coordination health could not be loaded." });
    }
  }

  useEffect(() => {
    void refreshLocalHealth();
  }, []);

  async function testLiveBuzz() {
    setRoundTripState("testing");
    setResult(null);
    try {
      const response = await fetch("/api/local-buzz/live-health", { method: "POST", headers: { "Content-Type": "application/json" } });
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
    }
  }

  const copy = roundTripState === "testing"
    ? { title: "Testing live BUZZ connection", tone: "Testing", detail: "PlotPickle is signing a Gatehouse probe and reading that exact message back." }
    : roundTripState === "passed"
      ? { title: "Guildhall reachable", tone: "Live", detail: result?.message || "Signed test message received from BUZZ." }
      : roundTripState === "failed"
        ? { title: "Round-trip failed", tone: "Needs attention", detail: result?.message || "PlotPickle could not prove a signed BUZZ round trip." }
        : { title: "Live BUZZ connection not tested yet", tone: "Not tested yet", detail: "Room setup and relay reachability are not enough. Run one signed send-and-read test to prove BUZZ is actually working on this computer." };

  const badgeState = roundTripState === "passed" ? "connected" : roundTripState === "testing" ? "connecting" : roundTripState === "failed" ? "degraded" : "detected";
  const local = localHealth?.localBackbone;
  const localTone = local?.overall || "unknown";
  const localSummary = local
    ? `${local.actorCount} active evidence source${local.actorCount === 1 ? "" : "s"} · ${local.recentEvidenceCount} recent event${local.recentEvidenceCount === 1 ? "" : "s"} · ${local.verifiedEvidenceCount} verified`
    : localHealth?.message || "No local coordination evidence has been observed yet.";

  return <section className={`${styles.statusCard} ${liveStyles.statusCard}`} aria-labelledby="buzz-live-health-title">
    <div>
      <p>BUZZ · Live connection</p>
      <h2 id="buzz-live-health-title">{copy.title}</h2>
      <p>{copy.detail}</p>
      {result?.receivedAt ? <small>Signed test message received {new Date(result.receivedAt).toLocaleString()} via {result.room || "Gatehouse"}.</small> : null}
      <div data-buzz-local-backbone="true">
        <p><strong>Local coordination: {localTone}</strong></p>
        <small>{localSummary}</small>
        {local?.actors.some((actor) => actor.stale) ? <small> Stale presence is shown as unknown rather than online.</small> : null}
      </div>
      <div className={`${styles.actions} ${liveStyles.actions}`}>
        <button type="button" disabled={roundTripState === "testing"} onClick={() => void testLiveBuzz()}>
          {roundTripState === "testing" ? "Testing live BUZZ…" : "Test live BUZZ connection"}
        </button>
        <button type="button" onClick={() => void refreshLocalHealth()}>Refresh local coordination</button>
      </div>
    </div>
    <div className={`${styles.statusBadge} ${liveStyles.statusBadge}`} data-state={badgeState} role="status" aria-live="polite"><i aria-hidden="true" /><b>{copy.tone}</b></div>
  </section>;
}
