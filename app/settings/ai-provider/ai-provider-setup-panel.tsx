"use client";

import { useEffect, useMemo, useState } from "react";
import { providerPresets } from "../../../lib/runtime/ai/providers";
import { requestConnectionStatusRefresh } from "../../use-connection-status";
import styles from "./ai-provider-setup-panel.module.css";

type ProviderId = "openai" | "minimax";
type ConnectionResponse = {
  available?: boolean;
  saved?: boolean;
  provider?: string;
  baseUrl?: string;
  textModel?: string;
  imageModel?: string;
  videoModel?: string;
  checkedAt?: string;
  message?: string;
};

type ProviderForm = {
  baseUrl: string;
  textModel: string;
  imageModel: string;
  videoModel: string;
};

const API = "/api/local-ai/connection";

export default function AiProviderSetupPanel({ provider }: { provider: ProviderId }) {
  const preset = useMemo(() => providerPresets.find((item) => item.kind === provider), [provider]);
  const label = provider === "openai" ? "OpenAI" : "MiniMax";
  const [form, setForm] = useState<ProviderForm>({
    baseUrl: preset?.defaultConfig.baseUrl || "",
    textModel: preset?.defaultConfig.models.text || "",
    imageModel: preset?.defaultConfig.models.image || "",
    videoModel: preset?.defaultConfig.models.video || "",
  });
  const [apiKey, setApiKey] = useState("");
  const [savedForProvider, setSavedForProvider] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("Checking the saved provider connection…");
  const checkedDate = checkedAt ? new Date(checkedAt) : null;
  const checkedLabel = !checkedDate
    ? "Not tested"
    : Number.isNaN(checkedDate.valueOf())
      ? checkedAt
      : checkedDate.toLocaleString();

  function announceRefresh() {
    requestConnectionStatusRefresh();
    window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
  }

  useEffect(() => {
    let active = true;
    void fetch(API, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) throw new Error("The local AI connection gateway is unavailable.");
        const current = await response.json() as ConnectionResponse;
        if (!response.ok) throw new Error(current.message || "Provider status could not be checked.");
        if (!active) return;
        const matches = current.saved && current.provider === provider;
        setSavedForProvider(Boolean(matches));
        if (matches) {
          setForm({
            baseUrl: current.baseUrl || preset?.defaultConfig.baseUrl || "",
            textModel: current.textModel || preset?.defaultConfig.models.text || "",
            imageModel: current.imageModel || preset?.defaultConfig.models.image || "",
            videoModel: current.videoModel || preset?.defaultConfig.models.video || "",
          });
          setCheckedAt(current.checkedAt || "");
          setNotice(`${label} is saved. The API key stays protected and is never displayed here.`);
        } else {
          setNotice(`Enter your ${label} API key, review the models, then save and test.`);
        }
      })
      .catch((error) => { if (active) setNotice(error instanceof Error ? error.message : "Provider status could not be checked."); });
    return () => { active = false; };
  }, [label, preset, provider]);

  function update(key: keyof ProviderForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveAndTest() {
    if (working) return;
    if (!savedForProvider && !apiKey.trim()) {
      setNotice(`Enter the ${label} API key owned by the current user before testing.`);
      return;
    }
    setWorking(true);
    setNotice(`Saving and testing ${label}…`);
    try {
      const response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...form, apiKey }),
      });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error("The local AI connection gateway is unavailable.");
      const result = await response.json() as ConnectionResponse;
      if (!response.ok) throw new Error(result.message || "The provider connection could not be updated.");
      setApiKey("");
      setSavedForProvider(true);
      setCheckedAt(result.checkedAt || "");
      setNotice(`${label} connected successfully. PlotPickle kept the credential in protected local storage.`);
      announceRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${label} could not be connected.`);
    } finally {
      setWorking(false);
    }
  }

  async function testAgain() {
    if (working || !savedForProvider) return;
    setWorking(true);
    setNotice(`Testing the saved ${label} connection…`);
    try {
      const response = await fetch(`${API}/check`, { method: "POST", headers: { Accept: "application/json" } });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error("The local AI connection gateway is unavailable.");
      const result = await response.json() as ConnectionResponse;
      if (!response.ok) throw new Error(result.message || "The saved provider connection could not be verified.");
      setCheckedAt(result.checkedAt || "");
      setNotice(`${label} connected successfully.`);
      announceRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${label} could not be verified.`);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className={styles.panel} data-ai-provider-setup={provider} aria-labelledby={`${provider}-provider-setup-title`}>
      <header>
        <div><p>Exact provider setup</p><h2 id={`${provider}-provider-setup-title`}>{label}</h2><span>{preset?.description}</span></div>
        <strong data-ready={savedForProvider}>{savedForProvider ? "Configured" : "Setup needed"}</strong>
      </header>
      <div className={styles.grid}>
        <label><span>Server address</span><input value={form.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} spellCheck={false} /></label>
        <label><span>API key</span><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={savedForProvider ? "Leave blank to keep saved key" : `Enter ${label} API key`} /></label>
        <label><span>Text model</span><input value={form.textModel} onChange={(event) => update("textModel", event.target.value)} spellCheck={false} /></label>
        <label><span>Image model</span><input value={form.imageModel} onChange={(event) => update("imageModel", event.target.value)} spellCheck={false} /></label>
        <label><span>Video model</span><input value={form.videoModel} onChange={(event) => update("videoModel", event.target.value)} spellCheck={false} /></label>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => void saveAndTest()} disabled={working}>{working ? "Checking…" : "Save & test"}</button>
        <button type="button" onClick={() => void testAgain()} disabled={working || !savedForProvider}>Test saved connection</button>
      </div>
      <p className={styles.notice} role="status">{notice}</p>
      <footer><span>Last successful test: {checkedLabel}</span><span>Cloud requests use the user-owned provider account. PlotPickle never silently falls back to a paid route.</span></footer>
    </section>
  );
}
