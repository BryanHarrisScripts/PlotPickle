"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./model-catalog-panel.module.css";

type Provider = "openai" | "minimax";
type Capability = "writing" | "images" | "video";
type CatalogResponse = {
  ok: boolean;
  provider: Provider;
  configured: boolean;
  capability: Capability | "";
  selected: string;
  models: string[];
  count: number;
  source: "provider" | "configured";
  discoveryError: string;
  message?: string;
};

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "minimax", label: "MiniMax" },
];

const CAPABILITY_LABEL: Record<Capability, string> = {
  writing: "Writing",
  images: "Images",
  video: "Video",
};

function ProviderCatalog({ provider, label, capability }: { provider: Provider; label: string; capability: Capability }) {
  const [status, setStatus] = useState<CatalogResponse | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState("");

  const refresh = useCallback(async (announce = false) => {
    try {
      const response = await fetch(`/api/ai-model-catalog?provider=${encodeURIComponent(provider)}&capability=${encodeURIComponent(capability)}`, { cache: "no-store" });
      const body = await response.json() as CatalogResponse;
      if (!response.ok || !body.ok) throw new Error(body.message || `${label} model catalog could not be loaded.`);
      setStatus(body);
      if (announce) setNotice(`${label} model catalog refreshed at ${new Date().toLocaleTimeString()}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${label} model catalog could not be loaded.`);
    }
  }, [capability, label, provider]);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const models = status?.models || [];
    return normalized ? models.filter((model) => model.toLowerCase().includes(normalized)) : models;
  }, [query, status]);

  async function select(model: string) {
    if (working) return;
    setWorking(model);
    setNotice(`Selecting ${model} for ${CAPABILITY_LABEL[capability].toLowerCase()}…`);
    try {
      const response = await fetch("/api/ai-model-catalog/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, capability, model }),
      });
      const body = await response.json() as CatalogResponse;
      if (!response.ok || !body.ok) throw new Error(body.message || "The model choice could not be saved.");
      setStatus(body);
      setNotice(`${model} is selected for ${label} ${CAPABILITY_LABEL[capability].toLowerCase()}. Its previous readiness proof was cleared; run the existing provider test before using it.`);
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The model choice could not be saved.");
    } finally {
      setWorking("");
    }
  }

  const total = status?.count || 0;
  const visible = filtered.slice(0, 60);

  return (
    <article className={styles.provider} data-model-catalog-provider={provider}>
      <header>
        <div><strong>{label}</strong><span>{status?.configured ? "Connected provider" : "Provider setup required"}</span></div>
        <button type="button" onClick={() => void refresh(true)}>Refresh</button>
      </header>

      {status?.selected ? <p className={styles.selected}>Current {CAPABILITY_LABEL[capability].toLowerCase()} model: <strong>{status.selected}</strong></p> : null}

      {!status?.configured ? (
        <div className={styles.empty}>Connect {label} below first. PlotPickle will not request a live model catalog without that provider's protected credential.</div>
      ) : (
        <>
          <div className={styles.controlsSingle}>
            <label>
              <span>Search {label} models</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${total} reported model${total === 1 ? "" : "s"}…`} />
            </label>
            <strong>{filtered.length} of {total}</strong>
          </div>
          {status.discoveryError ? <p className={styles.warning}>{status.discoveryError}</p> : null}
          <div className={styles.compactList}>
            {visible.map((model) => (
              <button
                type="button"
                key={model}
                disabled={Boolean(working) || status.selected === model}
                data-selected={status.selected === model}
                onClick={() => void select(model)}
              >
                <span>{model}</span><strong>{status.selected === model ? "Selected" : `Use for ${CAPABILITY_LABEL[capability]}`}</strong>
              </button>
            ))}
          </div>
          {filtered.length > visible.length ? <p className={styles.limit}>Showing the first {visible.length} matches. Refine the search to narrow the provider catalog.</p> : null}
          {!filtered.length ? <div className={styles.empty}>No reported models match this search. The manual model-ID fallback remains available in provider setup below.</div> : null}
        </>
      )}
      <p className={styles.notice} role="status">{notice}</p>
    </article>
  );
}

export default function CloudModelCatalogPanel({ capability }: { capability: Capability }) {
  return (
    <section className={styles.panel} data-model-catalog="cloud" aria-labelledby="cloud-model-catalog-title">
      <header className={styles.heading}>
        <div>
          <p>Cloud model catalog</p>
          <h3 id="cloud-model-catalog-title">Choose a model after you connect the provider.</h3>
          <span>PlotPickle asks the connected provider for its current model IDs where the adapter supports discovery. Counts are derived at runtime; there is no hardcoded catalog size.</span>
        </div>
      </header>
      <div className={styles.providerGrid}>
        {PROVIDERS.map((item) => <ProviderCatalog key={item.id} provider={item.id} label={item.label} capability={capability} />)}
      </div>
      <footer className={styles.boundary}>Choosing a model changes configuration only. It does not run a paid generation, change the active provider route, or expose the saved API key.</footer>
    </section>
  );
}
