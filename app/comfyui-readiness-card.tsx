"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./comfyui-readiness-card.module.css";

type RoutingStatus = {
  readonly comfyui?: { readonly baseUrl?: string };
};

type Management = {
  readonly adapter?: "comfy-mcp" | "direct-api";
  readonly ready?: boolean;
  readonly mcpInstalled?: boolean;
  readonly mcpVersion?: string;
  readonly comfyCliInstalled?: boolean;
  readonly comfyCliVersion?: string;
  readonly minimumComfyCliVersion?: string;
  readonly message?: string;
};

type Hardware = {
  readonly gpuName?: string;
  readonly totalVramMb?: number | null;
  readonly freeVramMb?: number | null;
};

type Diagnostic = {
  readonly reachable?: boolean;
  readonly serviceReady?: boolean;
  readonly connectionState?: string;
  readonly baseUrl?: string;
  readonly version?: string;
  readonly checkpoints?: readonly string[];
  readonly imageNodesReady?: boolean;
  readonly missingImageNodes?: readonly string[];
  readonly missingWorkflowNodes?: readonly string[];
  readonly error?: string;
  readonly capabilityError?: string;
  readonly repairGuidance?: string;
  readonly management?: Management;
  readonly hardware?: Hardware;
};

type DiagnosticResponse = { readonly comfyui?: Diagnostic };

const ROUTING_STATUS_API = "/api/media-routing/status";
const DIAGNOSTICS_API = "/api/provider-diagnostics/comfyui";
const DEFAULT_COMFY_URL = "http://127.0.0.1:8188";

async function jsonRequest<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || `PlotPickle returned ${response.status}.`);
  return value;
}

function formatVram(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "Unknown";
  return `${(value / 1024).toFixed(value >= 10_240 ? 0 : 1)} GB`;
}

function readinessLabel(diagnostic: Diagnostic) {
  if (diagnostic.serviceReady && diagnostic.imageNodesReady && diagnostic.checkpoints?.length) return "Ready for local images";
  if (diagnostic.reachable) return "Running · setup needed";
  if (diagnostic.management?.ready) return "Installed · not running";
  if (diagnostic.management?.mcpInstalled) return "Management setup incomplete";
  return "Not connected";
}

function readinessDetail(diagnostic: Diagnostic) {
  if (diagnostic.capabilityError) return diagnostic.capabilityError;
  if (diagnostic.error) return diagnostic.error;
  if (diagnostic.serviceReady) return "The local ComfyUI API is responding. Use the detailed controls below to choose a checkpoint and run a real image test.";
  return diagnostic.repairGuidance || diagnostic.management?.message || "PlotPickle has not confirmed a ready local ComfyUI service yet.";
}

export default function ComfyUiReadinessCard() {
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");

  async function refresh() {
    setLoading(true);
    setFailure("");
    try {
      const routing = await jsonRequest<RoutingStatus>(ROUTING_STATUS_API);
      const baseUrl = routing.comfyui?.baseUrl || DEFAULT_COMFY_URL;
      const result = await jsonRequest<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl });
      setDiagnostic(result.comfyui || null);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "PlotPickle could not check ComfyUI readiness.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const label = useMemo(() => diagnostic ? readinessLabel(diagnostic) : "Checking…", [diagnostic]);
  const managementLabel = diagnostic?.management?.ready
    ? `Comfy MCP ready${diagnostic.management.mcpVersion ? ` · ${diagnostic.management.mcpVersion}` : ""}`
    : diagnostic?.management?.mcpInstalled
      ? "Comfy MCP found · setup incomplete"
      : "Direct ComfyUI support";

  return (
    <section className={styles.card} aria-label="ComfyUI readiness summary" data-comfy-readiness={diagnostic?.connectionState || "unknown"}>
      <header>
        <div>
          <p>Local image readiness</p>
          <h2>ComfyUI</h2>
        </div>
        <strong data-ready={Boolean(diagnostic?.serviceReady)}>{loading ? "Checking…" : label}</strong>
      </header>

      {failure ? <p className={styles.problem} role="status">{failure}</p> : diagnostic ? (
        <>
          <p className={styles.detail}>{readinessDetail(diagnostic)}</p>
          <dl className={styles.facts}>
            <div><dt>Management</dt><dd>{managementLabel}</dd></div>
            <div><dt>Local API</dt><dd>{diagnostic.reachable ? `Responding${diagnostic.version ? ` · ${diagnostic.version}` : ""}` : "Not responding"}</dd></div>
            <div><dt>GPU</dt><dd>{diagnostic.hardware?.gpuName || "Not reported"}</dd></div>
            <div><dt>VRAM</dt><dd>{formatVram(diagnostic.hardware?.freeVramMb)} free · {formatVram(diagnostic.hardware?.totalVramMb)} total</dd></div>
            <div><dt>Checkpoints</dt><dd>{diagnostic.checkpoints?.length ?? 0} detected</dd></div>
            <div><dt>Image nodes</dt><dd>{diagnostic.imageNodesReady ? "Ready" : diagnostic.missingImageNodes?.length ? `Missing ${diagnostic.missingImageNodes.length}` : "Not verified"}</dd></div>
          </dl>
          <p className={styles.boundary}>{diagnostic.management?.message || "Comfy MCP is optional. PlotPickle keeps the direct local ComfyUI route available."}</p>
        </>
      ) : <p className={styles.detail}>No ComfyUI diagnostic was returned.</p>}

      <footer>
        <button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Checking…" : "Refresh readiness"}</button>
        <span>Use the controls below to start, configure or test ComfyUI. PlotPickle never switches to a paid provider automatically.</span>
      </footer>
    </section>
  );
}
