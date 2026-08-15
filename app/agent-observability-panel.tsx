"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./agent-observability-panel.module.css";

type TraceEvent = {
  at: string;
  type: string;
  label: string;
  detail?: string;
};

type AgentTrace = {
  id: string;
  agentId: string;
  provider: string;
  runtimeProvider: string;
  model: string;
  modelRole: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "running" | "success" | "error";
  inputChars: number;
  historyMessages: number;
  outputChars: number;
  structured: boolean;
  error: string;
  events: TraceEvent[];
};

type TracePayload = {
  ok: boolean;
  retention: string;
  maximumTraces: number;
  privacy: {
    promptsStored: boolean;
    responsesStored: boolean;
    hiddenReasoningStored: boolean;
    operationalMetadataOnly: boolean;
  };
  summary: {
    traces: number;
    running: number;
    failures: number;
    averageLatencyMs: number;
  };
  traces: AgentTrace[];
};

const AGENT_NAMES: Record<string, string> = {
  "curriculum-guide": "Sage Brinewick",
  "foundations-planner": "Foundations Planner",
  "wyrmwood-rival-director": "Master Oaken-Vague",
  "wyrmwood-curriculum-evaluator": "Wyrmwood Evaluator",
};

function displayAgent(id: string) {
  return AGENT_NAMES[id] || id.replaceAll("-", " ");
}

function displayTime(value: string) {
  if (!value) return "now";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AgentObservabilityPanel() {
  const [payload, setPayload] = useState<TracePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/writing-assistant/traces", { cache: "no-store" });
      const data = await response.json() as TracePayload & { message?: string };
      if (!response.ok || !data.ok) throw new Error(data.message || "Agent activity is unavailable.");
      setPayload(data);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent activity is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const clear = useCallback(async () => {
    try {
      const response = await fetch("/api/writing-assistant/traces", { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.message || "Could not clear agent activity.");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not clear agent activity.");
    }
  }, [refresh]);

  const traces = payload?.traces || [];
  const successCount = useMemo(() => traces.filter((trace) => trace.status === "success").length, [traces]);

  return (
    <section className={styles.panel} aria-labelledby="agent-activity-title">
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>Runtime · Agent Observability</p>
          <h2 id="agent-activity-title">Agent Activity</h2>
          <p className={styles.intro}>See which PlotPickle agent ran, which model handled it, how long it took, and the operational steps in the run.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
          <button type="button" onClick={() => void clear()} disabled={!traces.length}>Clear session</button>
        </div>
      </div>

      <div className={styles.summary} aria-label="Agent activity summary">
        <div><strong>{payload?.summary.traces ?? 0}</strong><span>session runs</span></div>
        <div><strong>{successCount}</strong><span>completed</span></div>
        <div><strong>{payload?.summary.failures ?? 0}</strong><span>failed</span></div>
        <div><strong>{payload?.summary.averageLatencyMs ?? 0} ms</strong><span>average latency</span></div>
      </div>

      <p className={styles.privacy}>Operational metadata only. PlotPickle does not store prompts, responses, or hidden model reasoning in this activity log. Traces remain in server memory for the current app session only.</p>

      {error ? <p className={styles.error} role="status">{error}</p> : null}
      {!error && !traces.length ? <p className={styles.empty}>No agent runs yet. Ask Sage, draft a Foundations field, or play Wyrmwood and the run will appear here.</p> : null}

      <div className={styles.traceList}>
        {traces.map((trace) => (
          <details className={styles.trace} key={trace.id}>
            <summary>
              <span className={`${styles.status} ${styles[trace.status]}`}>{trace.status}</span>
              <strong>{displayAgent(trace.agentId)}</strong>
              <span>{trace.runtimeProvider} · {trace.model}</span>
              <span>{trace.durationMs ? `${trace.durationMs} ms` : "running"}</span>
              <time dateTime={trace.startedAt}>{displayTime(trace.startedAt)}</time>
            </summary>
            <div className={styles.traceBody}>
              <dl className={styles.metadata}>
                <div><dt>Agent</dt><dd>{trace.agentId}</dd></div>
                <div><dt>Provider</dt><dd>{trace.provider}</dd></div>
                <div><dt>Runtime</dt><dd>{trace.runtimeProvider}</dd></div>
                <div><dt>Model role</dt><dd>{trace.modelRole}</dd></div>
                <div><dt>Output</dt><dd>{trace.outputChars} chars</dd></div>
                <div><dt>Format</dt><dd>{trace.structured ? "structured" : "text"}</dd></div>
              </dl>
              {trace.error ? <p className={styles.traceError}>{trace.error}</p> : null}
              <ol className={styles.timeline}>
                {trace.events.map((event, index) => (
                  <li key={`${trace.id}-${index}-${event.type}`}>
                    <time dateTime={event.at}>{displayTime(event.at)}</time>
                    <div><strong>{event.label}</strong>{event.detail ? <span>{event.detail}</span> : null}</div>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
