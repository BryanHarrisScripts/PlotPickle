"use client";

import { useEffect, useState } from "react";
import { requestConnectionStatusRefresh } from "../../use-connection-status";
import styles from "./ai-provider-setup-panel.module.css";

type ProviderState = {
  configured?: boolean;
  ready?: boolean;
  baseUrl?: string;
  model?: string;
  verifiedAt?: string;
  latencyMs?: number;
  error?: string;
};

type StatusResponse = {
  providers?: { gemini?: ProviderState };
  message?: string;
};

type SaveResponse = {
  ok?: boolean;
  baseUrl?: string;
  model?: string;
  verifiedAt?: string;
  latencyMs?: number;
  message?: string;
};

const STATUS_API = "/api/writing-assistant/status";
const PROVIDER_API = "/api/writing-assistant/provider";
const TEST_API = "/api/writing-assistant/test";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-3.7-flash";

export default function GeminiProviderSetupPanel() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [textModel, setTextModel] = useState(DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [ready, setReady] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState("");
  const [latencyMs, setLatencyMs] = useState(0);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("Checking Google Gemini setup…");

  function announceRefresh() {
    requestConnectionStatusRefresh();
    window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
  }

  useEffect(() => {
    let active = true;
    void fetch(STATUS_API, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as StatusResponse;
        if (!response.ok) throw new Error(body.message || "Gemini status could not be checked.");
        if (!active) return;
        const current = body.providers?.gemini;
        setConfigured(Boolean(current?.configured));
        setReady(Boolean(current?.ready));
        if (current?.baseUrl) setBaseUrl(current.baseUrl);
        if (current?.model) setTextModel(current.model);
        setVerifiedAt(current?.verifiedAt || "");
        setLatencyMs(current?.latencyMs || 0);
        setNotice(current?.configured
          ? current.ready
            ? "Google Gemini is configured and has passed its writing response test."
            : current.error || "Google Gemini is configured but needs a successful response test."
          : "Enter your Gemini API key, then save and test the connection.");
      })
      .catch((error) => { if (active) setNotice(error instanceof Error ? error.message : "Gemini status could not be checked."); });
    return () => { active = false; };
  }, []);

  async function saveAndTest() {
    if (working) return;
    if (!configured && !apiKey.trim()) {
      setNotice("Enter the Gemini API key owned by the current user before testing.");
      return;
    }
    setWorking(true);
    setNotice("Saving and testing Google Gemini…");
    try {
      const response = await fetch(PROVIDER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gemini", baseUrl, textModel, apiKey }),
      });
      const body = await response.json() as SaveResponse;
      if (!response.ok || !body.ok) throw new Error(body.message || "Google Gemini could not be connected.");
      setApiKey("");
      setConfigured(true);
      setReady(true);
      setVerifiedAt(body.verifiedAt || "");
      setLatencyMs(body.latencyMs || 0);
      setNotice("Google Gemini connected successfully. The API key stays in protected local credential storage and is never displayed here.");
      announceRefresh();
    } catch (error) {
      setReady(false);
      setNotice(error instanceof Error ? error.message : "Google Gemini could not be connected.");
    } finally {
      setWorking(false);
    }
  }

  async function testAgain() {
    if (working || !configured) return;
    setWorking(true);
    setNotice("Testing the saved Google Gemini writing connection…");
    try {
      const response = await fetch(TEST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gemini" }),
      });
      const body = await response.json() as SaveResponse;
      if (!response.ok || !body.ok) throw new Error(body.message || "The saved Gemini connection could not be verified.");
      setReady(true);
      setVerifiedAt(body.verifiedAt || "");
      setLatencyMs(body.latencyMs || 0);
      setNotice("Google Gemini connected successfully.");
      announceRefresh();
    } catch (error) {
      setReady(false);
      setNotice(error instanceof Error ? error.message : "Google Gemini could not be verified.");
    } finally {
      setWorking(false);
    }
  }

  const checked = verifiedAt ? new Date(verifiedAt) : null;
  const checkedLabel = !checked ? "Not tested" : Number.isNaN(checked.valueOf()) ? verifiedAt : checked.toLocaleString();

  return (
    <section className={styles.panel} data-ai-provider-setup="gemini" aria-labelledby="gemini-provider-setup-title">
      <header>
        <div>
          <p>Provider Cloud · Writing</p>
          <h2 id="gemini-provider-setup-title">Google Gemini</h2>
          <span>Connect Gemini through Google&apos;s OpenAI-compatible writing endpoint. This first slice enables Writing/Reasoning only; image and video routes remain unchanged.</span>
        </div>
        <strong data-ready={ready}>{ready ? "Ready" : configured ? "Test needed" : "Setup needed"}</strong>
      </header>
      <div className={styles.grid}>
        <label><span>API key</span><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={configured ? "Leave blank to keep saved key" : "Enter Gemini API key"} /></label>
        <label><span>Writing model</span><input value={textModel} onChange={(event) => setTextModel(event.target.value)} spellCheck={false} /></label>
      </div>
      <details>
        <summary>Connection details · advanced</summary>
        <p>Most users should keep the Google endpoint below unchanged. PlotPickle stores the provider identity separately from this connection mechanism.</p>
        <div className={styles.grid}>
          <label><span>OpenAI-compatible endpoint</span><input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} /></label>
        </div>
      </details>
      <div className={styles.actions}>
        <button type="button" onClick={() => void saveAndTest()} disabled={working}>{working ? "Checking…" : "Save & test connection"}</button>
        <button type="button" onClick={() => void testAgain()} disabled={working || !configured}>Test saved connection</button>
      </div>
      <p className={styles.notice} role="status">{notice}</p>
      <footer>
        <span>Last successful test: {checkedLabel}{latencyMs ? ` · ${latencyMs} ms` : ""}</span>
        <span>Choosing Gemini as the active Writing route remains a separate explicit action. PlotPickle never silently switches to paid cloud use.</span>
      </footer>
    </section>
  );
}
