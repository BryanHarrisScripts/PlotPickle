"use client";

import { useState } from "react";
import styles from "./buzz-settings.module.css";

type RoundTripState = "idle" | "testing" | "passed" | "failed";
type HealthResult = {
  ok: boolean;
  roundTrip: boolean;
  room?: string;
  sentAt?: string;
  receivedAt?: string;
  message: string;
};

export default function BuzzLiveHealthCard() {
  const [roundTripState, setRoundTripState] = useState<RoundTripState>("idle");
  const [result, setResult] = useState<HealthResult | null>(null);

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

  return <section className={styles.statusCard} aria-labelledby="buzz-live-health-title">
    <div>
      <p>BUZZ · Live connection</p>
      <h2 id="buzz-live-health-title">{copy.title}</h2>
      <p>{copy.detail}</p>
      {result?.receivedAt ? <small>Signed test message received {new Date(result.receivedAt).toLocaleString()} via {result.room || "Gatehouse"}.</small> : null}
      <div className={styles.actions}>
        <button type="button" disabled={roundTripState === "testing"} onClick={() => void testLiveBuzz()}>
          {roundTripState === "testing" ? "Testing live BUZZ…" : "Test live BUZZ connection"}
        </button>
      </div>
    </div>
    <div className={styles.statusBadge} data-state={badgeState} role="status" aria-live="polite"><i aria-hidden="true" /><b>{copy.tone}</b></div>
  </section>;
}
