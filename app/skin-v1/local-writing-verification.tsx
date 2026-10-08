"use client";

import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";
import { useCallback, useEffect, useState } from "react";

type LocalQualityStatus = {
  configured?: boolean;
  ready?: boolean;
  model?: string;
  runtime?: string;
  baseUrl?: string;
  verifiedAt?: string;
  error?: string;
  role?: string;
};
type RoutingStatus = {
  ok?: boolean;
  text?: {
    selected?: string;
    options?: Record<string, LocalQualityStatus & { locality?: string }>;
  };
  message?: string;
};
type TestResult = {
  ok?: boolean;
  model?: string;
  runtimeProvider?: string;
  modelRole?: string;
  text?: string;
  verifiedAt?: string;
  message?: string;
};

const surface: React.CSSProperties = {
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  background: "var(--pp-skin-surface-1)",
  padding: "var(--pp-skin-space-4)",
  color: "var(--pp-skin-ink)",
};
const action: React.CSSProperties = {
  minHeight: "var(--pp-skin-control-height)",
  borderRadius: "var(--pp-skin-radius)",
  padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)",
  background: "var(--pp-skin-surface-0)",
  color: "var(--pp-skin-ink)",
  cursor: "pointer",
};

export default function LocalWritingVerificationPanel() {
  const [quality, setQuality] = useState<LocalQualityStatus | null>(null);
  const [selected, setSelected] = useState("");
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ai-routing/status", { cache: "no-store" });
      const body = await response.json() as RoutingStatus;
      if (!response.ok || !body.ok) throw new Error(body.message || "Writing readiness cannot be read.");
      setQuality(body.text?.options?.local ?? null);
      setSelected(body.text?.selected ?? "");
    } catch (error) {
      setQuality(null);
      setNotice(error instanceof Error ? error.message : "Writing readiness cannot be read.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener("plotpickle:setup-status-refresh", onRefresh);
    return () => window.removeEventListener("plotpickle:setup-status-refresh", onRefresh);
  }, [refresh]);

  async function testWriting() {
    if (checking) return;
    setChecking(true);
    setNotice("Testing the exact Local Quality model with a real text request…");
    setPreview("");
    try {
      const response = await fetch("/api/writing-assistant/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "local", modelRole: "quality" }),
      });
      const body = await response.json() as TestResult;
      if (!response.ok || !body.ok || !body.text?.trim() || body.modelRole !== "quality") {
        throw new Error(body.message || "The Quality model did not return verified writing.");
      }
      setNotice(`Verified response from ${body.runtimeProvider || "local runtime"} · ${body.model || "model"}.`);
      setPreview(body.text.slice(0, 400));
    } catch (error) {
      setNotice(`Writing test failed: ${error instanceof Error ? error.message : "The model could not answer."}`);
    } finally {
      setChecking(false);
      await refresh();
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
    }
  }

  const ready = quality?.ready === true;
  return (
    <section style={surface} data-local-writing-verification="quality" aria-label="Local Writing model verification">
      <h3 style={{ margin: "0 0 var(--pp-skin-space-2)" }}>Local Writing — actual model and proof</h3>
      <p style={{ margin: "0 0 var(--pp-skin-space-3)", color: "var(--pp-skin-ink-soft)" }}>
        The Bubble Agent uses this local text-only <strong>Quality</strong> model, not an SDXL image model, LTX video model, or a discovered but untested slot.
      </p>
      <dl style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(180px, 2fr)", gap: "var(--pp-skin-space-2)", margin: "0 0 var(--pp-skin-space-3)" }}>
        <dt>Runtime</dt><dd style={{ margin: 0 }}>{quality?.runtime || "Not detected"}</dd>
        <dt>Model</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{quality?.model || "No suitable Quality text model"}</dd>
        <dt>Endpoint</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{quality?.baseUrl || "Not available"}</dd>
        <dt>Writing status</dt><dd style={{ margin: 0 }}><strong>{ready ? "READY — response verified" : quality?.configured ? "TEST NEEDED / BLOCKED" : "SETUP NEEDED"}</strong></dd>
        <dt>Last verified</dt><dd style={{ margin: 0 }}>{quality?.verifiedAt ? new Date(quality.verifiedAt).toLocaleString() : "No successful test for this exact model"}</dd>
        <dt>Hybrid selection</dt><dd style={{ margin: 0 }}>{selected || "No selection"} (selection does not change during testing)</dd>
      </dl>
      {!ready ? <p role="status">{quality?.error || "A successful response test is required before this model can generate Bubble narration."}</p> : null}
      <button type="button" style={action} disabled={checking} onClick={() => void testWriting()}>
        {checking ? "Testing Writing…" : "Test Writing"}
      </button>
      {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
      {preview ? <p><strong>Model response:</strong> {preview}</p> : null}
      <p style={{ color: "var(--pp-skin-ink-soft)", marginBottom: 0 }}>
        Hardware detection and automatic model ranking are separate from verified Writing. See advanced runtime inventory to inspect other capabilities.
      </p>
    </section>
  );
}
