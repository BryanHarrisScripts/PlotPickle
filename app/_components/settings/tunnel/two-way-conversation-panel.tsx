"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedProfileFetch } from "../../../../core/auth/profile-request-browser";
import styles from "./two-way-conversation-panel.module.css";

type Observation = {
  code: string;
  questionId?: string;
  sourceHead?: string;
  sourceChannel?: "main" | "candidate";
  question?: string;
  answer?: string | null;
  plotpickleToChatgpt?: "VERIFIED" | "UNPROVEN";
  chatgptToPlotpickle?: "VERIFIED" | "UNPROVEN";
  deliveryAcknowledgedAt?: number | null;
  answerReceivedAt?: number | null;
};
const ENDPOINT = "/api/factory/conversation";
export default function TwoWayConversationTest() {
  const [observation, setObservation] = useState<Observation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const requestRevision = ++revision.current;
    try {
      const response = await authenticatedProfileFetch(ENDPOINT, { cache: "no-store" });
      const body = await response.json() as Observation;
      if (!response.ok) throw Error(body.code || "GATEWAY_OBSERVATION_UNAVAILABLE");
      if (requestRevision !== revision.current) return;
      setObservation(body);
      setError("");
    } catch (failure) {
      if (requestRevision !== revision.current) return;
      setObservation(null);
      setError(failure instanceof Error ? failure.message : "GATEWAY_OBSERVATION_UNAVAILABLE");
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (observation?.code !== "PENDING") return;
    const timer = window.setInterval(() => { void refresh(); }, 3000);
    return () => window.clearInterval(timer);
  }, [observation?.code, refresh]);
  async function test() {
    if (busy) return;
    const requestRevision = ++revision.current;
    setBusy(true);
    setObservation(null);
    setError("");
    try {
      const response = await authenticatedProfileFetch(ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", requestId: crypto.randomUUID().replaceAll("-", "") }),
      });
      const body = await response.json() as Observation;
      if (!response.ok) throw Error(body.code || "GATEWAY_TEST_UNVERIFIED");
      if (requestRevision !== revision.current) return;
      setObservation(body);
    } catch (failure) {
      if (requestRevision !== revision.current) return;
      setError(failure instanceof Error ? failure.message : "GATEWAY_TEST_UNVERIFIED");
    } finally { setBusy(false); }
  }
  return <section className={styles.root} aria-label="Two-way conversation test">
    <h3>Test the ChatGPT conversation</h3>
    <p>Send a question from PlotPickle and verify the connected client&apos;s reply. Keep the ChatGPT conversation active to read and answer the pending test.</p>
    <div className={styles.actions}>
      <button type="button" disabled={busy || observation?.code === "PENDING"} onClick={() => void test()}>
        {busy ? "Creating test…" : "Test Two-Way Conversation"}
      </button>
      <button type="button" disabled={busy} onClick={() => void refresh()}>Recheck conversation</button>
    </div>
    <div className={styles.indicators} role="status">
      <span data-direction="plotpickle-to-chatgpt" data-state={observation?.plotpickleToChatgpt || "UNPROVEN"}>
        PlotPickle → ChatGPT: {observation?.plotpickleToChatgpt === "VERIFIED" ? "Delivery acknowledged" : "Unproven"}
      </span>
      <span data-direction="chatgpt-to-plotpickle" data-state={observation?.chatgptToPlotpickle || "UNPROVEN"}>
        ChatGPT → PlotPickle: {observation?.chatgptToPlotpickle === "VERIFIED" ? "Reply saved and read back" : "Unproven"}
      </span>
    </div>
    {observation?.sourceHead ? <p className={styles.identity}>{observation.sourceChannel === "candidate" ? "PR TEST" : "MAIN"} · {observation.sourceHead}</p> : null}
    {observation?.code === "PENDING" ? <p>Waiting for the connected ChatGPT conversation to receive and answer this question.</p> : null}
    {observation?.code === "EXPIRED_UNANSWERED" ? <p>No answer arrived before this test expired. Start a new test when the connection is available.</p> : null}
    {observation?.questionId ? <details>
      <summary>Conversation receipt · {observation.code}</summary>
      <p className={styles.identity}>Question {observation.questionId}</p>
      <p>{observation.question}</p>
      {observation.answer ? <blockquote>{observation.answer}</blockquote> : null}
      {observation.answerReceivedAt ? <p>Reply received {new Date(observation.answerReceivedAt).toLocaleString()}</p> : null}
    </details> : null}
    {error || (observation && !["NO_TEST", "PENDING", "ANSWERED", "EXPIRED_UNANSWERED"].includes(observation.code))
      ? <p role="alert">Conversation not verified. {error || observation?.code}</p> : null}
    <small>Receipts verify the authenticated connected client for the displayed commit. A completed test does not enable background delivery.</small>
  </section>;
}
