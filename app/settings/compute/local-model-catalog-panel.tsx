"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./model-catalog-panel.module.css";

type Role = "fast" | "quality";
type CatalogFilter = "all" | "vision" | "coding" | "fits";

type CatalogModel = {
  id: string;
  family: string;
  parameterSize: string;
  quantization: string;
  contextTokens: number;
  capabilities: Record<string, boolean>;
  metadataSource: string;
  fit: { id: string; label: string; workingSetGb: number };
  throughput: { source: string; mid: number; low: number; high: number };
};

type RuntimeStatus = {
  ok: boolean;
  settings: {
    modelOverrides: Partial<Record<"fast" | "quality" | "deep" | "vision" | "repair", string>>;
  };
  roles: {
    fast: { selected: string };
    quality: { selected: string };
  };
  activeRuntime: {
    label: string;
    reachable: boolean;
  };
  modelCatalog: CatalogModel[];
  message?: string;
};

const FILTER_LABELS: Record<CatalogFilter, string> = {
  all: "All models",
  fits: "Fits this computer",
  vision: "Vision capable",
  coding: "Coding / tools",
};

function capabilityNames(model: CatalogModel) {
  return Object.entries(model.capabilities).flatMap(([name, enabled]) => enabled ? [name] : []);
}

function matchesFilter(model: CatalogModel, filter: CatalogFilter) {
  if (filter === "all") return true;
  if (filter === "fits") return model.fit.id !== "does-not-fit" && model.fit.id !== "unknown";
  const capabilities = capabilityNames(model).map((value) => value.toLowerCase());
  if (filter === "vision") return capabilities.some((value) => value.includes("vision") || value.includes("image"));
  return capabilities.some((value) => value.includes("coding") || value.includes("code") || value.includes("tool"));
}

function searchableText(model: CatalogModel) {
  return [
    model.id,
    model.family,
    model.parameterSize,
    model.quantization,
    model.fit.label,
    model.metadataSource,
    ...capabilityNames(model),
  ].join(" ").toLowerCase();
}

export default function LocalModelCatalogPanel() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [notice, setNotice] = useState("Loading the local model catalog…");
  const [working, setWorking] = useState("");

  const refresh = useCallback(async (announce = false) => {
    try {
      const response = await fetch("/api/local-ai/runtime", { cache: "no-store" });
      const body = await response.json() as RuntimeStatus;
      if (!response.ok || !body.ok) throw new Error(body.message || "The local model catalog is unavailable.");
      setStatus(body);
      setNotice(announce ? `Local model catalog refreshed at ${new Date().toLocaleTimeString()}.` : "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local model catalog is unavailable.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (status?.modelCatalog || []).filter((model) => {
      if (!matchesFilter(model, filter)) return false;
      return !normalizedQuery || searchableText(model).includes(normalizedQuery);
    });
  }, [filter, query, status]);

  async function assign(role: Role, model: string) {
    if (!status || working) return;
    setWorking(`${role}:${model}`);
    setNotice(`Assigning ${model} to ${role === "fast" ? "Sage" : "PLAN"}…`);
    try {
      const response = await fetch("/api/local-ai/runtime/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelOverrides: {
            ...status.settings.modelOverrides,
            [role]: model,
          },
        }),
      });
      const body = await response.json() as RuntimeStatus;
      if (!response.ok || !body.ok) throw new Error(body.message || "The local model choice could not be saved.");
      setStatus(body);
      setNotice(`${model} is now selected for ${role === "fast" ? "Sage" : "PLAN"}. Run the existing Sage/PLAN test before relying on the new model.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local model choice could not be saved.");
    } finally {
      setWorking("");
    }
  }

  const total = status?.modelCatalog.length || 0;
  const visible = filtered.slice(0, 60);

  return (
    <section className={styles.panel} data-model-catalog="local" aria-labelledby="local-model-catalog-title">
      <header className={styles.heading}>
        <div>
          <p>Local model catalog</p>
          <h3 id="local-model-catalog-title">Choose from the models this computer actually reports.</h3>
          <span>The count comes from the current local runtime inventory. Nothing here creates a second model registry.</span>
        </div>
        <button type="button" onClick={() => void refresh(true)}>Refresh</button>
      </header>

      <div className={styles.controls}>
        <label>
          <span>Search models</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Qwen, Llama, vision, 7B…" />
        </label>
        <label>
          <span>Filter</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as CatalogFilter)}>
            {(Object.keys(FILTER_LABELS) as CatalogFilter[]).map((value) => <option value={value} key={value}>{FILTER_LABELS[value]}</option>)}
          </select>
        </label>
        <strong>{filtered.length} of {total} model{total === 1 ? "" : "s"}</strong>
      </div>

      <p className={styles.notice} role="status">{notice}</p>

      {!status?.activeRuntime.reachable ? (
        <div className={styles.empty}>Start Ollama, LM Studio, llama.cpp, or another configured local runtime, then refresh this catalog.</div>
      ) : null}

      <div className={styles.list}>
        {visible.map((model) => {
          const capabilities = capabilityNames(model);
          const sageSelected = status?.roles.fast.selected === model.id;
          const planSelected = status?.roles.quality.selected === model.id;
          return (
            <article className={styles.card} key={model.id}>
              <header><strong>{model.id}</strong><span>{model.fit.label || "Fit unknown"}</span></header>
              <p>{model.parameterSize || "Size unknown"}{model.quantization ? ` · ${model.quantization}` : ""}{model.contextTokens ? ` · ${Math.round(model.contextTokens / 1024)}K context` : ""}</p>
              <p>{model.throughput.mid ? `${model.throughput.mid} tok/s ${model.throughput.source === "measured" ? "measured" : "estimated"}` : "Speed estimate unavailable"}{model.fit.workingSetGb ? ` · ${model.fit.workingSetGb.toFixed(1)} GB working set` : ""}</p>
              <small>{capabilities.length ? capabilities.join(" · ") : "No special capability metadata reported"}</small>
              <div className={styles.actions}>
                <button type="button" disabled={Boolean(working) || sageSelected} onClick={() => void assign("fast", model.id)}>{sageSelected ? "Sage selected" : "Use for Sage"}</button>
                <button type="button" disabled={Boolean(working) || planSelected} onClick={() => void assign("quality", model.id)}>{planSelected ? "PLAN selected" : "Use for PLAN"}</button>
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length > visible.length ? <p className={styles.limit}>Showing the first {visible.length} matches. Refine the search or filter to narrow a large catalog.</p> : null}
      {status && !filtered.length ? <div className={styles.empty}>No current local models match this search/filter.</div> : null}
    </section>
  );
}
