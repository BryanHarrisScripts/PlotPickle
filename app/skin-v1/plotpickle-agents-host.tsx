"use client";

import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";

import { useCallback, useEffect, useState } from "react";
import ResponsibilityRunActivity from "../responsibility-run-activity";

type ProviderId = "local" | "ollama" | "openai" | "minimax" | "gemini";
type ProviderOption = {
  id: ProviderId;
  label: string;
  configured: boolean;
  ready: boolean;
  model: string;
  locality: "local" | "cloud";
};
type AgentSystem = "PlotPickle" | "BUZZ" | "External Developer";
type ProviderOwnership = "plotpickle-configurable" | "buzz-managed" | "deterministic" | "plotpickle-uat" | "repository-handoff" | "external-developer" | "plotpickle-fixed";
type AgentOption = {
  agentId: string;
  roleId: string | null;
  profileId: string | null;
  displayName: string;
  title: string;
  responsibility: string;
  requestedCapabilityRole: string | null;
  system: AgentSystem;
  providerOwnership: ProviderOwnership;
  providerLabel: string;
  configurable: boolean;
};
type AgentComputeStatus = {
  ok: boolean;
  defaultProvider: ProviderId | "active";
  activeProvider: ProviderId | "disabled";
  overrides: Record<string, ProviderId>;
  providers: ProviderOption[];
  agents: AgentOption[];
  message?: string;
};

const shell: React.CSSProperties = {
  minHeight: "100vh",
  padding: "var(--pp-skin-space-4) clamp(10px, 2vw, var(--pp-skin-space-6)) var(--pp-skin-space-7)",
  background: "var(--pp-skin-fill-panel)",
  color: "var(--pp-skin-ink)",
  fontFamily: "var(--pp-skin-font-ui)",
};
const panel: React.CSSProperties = {
  marginBottom: "var(--pp-skin-space-4)",
  padding: "var(--pp-skin-space-4)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  background: "var(--pp-skin-surface-1)",
  boxShadow: "var(--pp-skin-inset-highlight)",
};
const tableCell: React.CSSProperties = {
  padding: "var(--pp-skin-space-3)",
  borderBottom: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  textAlign: "left",
  verticalAlign: "top",
};

export default function PlotPickleAgentsHost() {
  const [status, setStatus] = useState<AgentComputeStatus | null>(null);
  const [notice, setNotice] = useState("Checking PlotPickle Agent compute…");

  const refresh = useCallback(async (announce = false) => {
    try {
      const response = await fetch("/api/writing-assistant/agent-compute", { cache: "no-store" });
      const body = await response.json() as AgentComputeStatus;
      if (!response.ok || !body.ok) throw new Error(body.message || "PlotPickle Agent compute could not be loaded.");
      setStatus(body);
      setNotice(announce ? "PlotPickle Agent compute refreshed." : "PlotPickle text Agents use the Writing resource selected in Hybrid. Configure resources under Local or Cloud.");
    } catch (error) {
      setStatus(null);
      setNotice(error instanceof Error ? error.message : "PlotPickle Agent compute could not be loaded.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!status) return <div style={shell}><section style={panel} role="status">{notice}</section></div>;

  const providerById = new Map(status.providers.map((provider) => [provider.id, provider]));
  const effectiveDefault = status.defaultProvider === "active" ? status.activeProvider : status.defaultProvider;
  const effectiveDefaultLabel = effectiveDefault === "disabled"
    ? "currently Off"
    : providerById.get(effectiveDefault)?.label || effectiveDefault;

  return (
    <div style={shell} data-skin-v1-plotpickle-agents="true">
      <section style={panel} aria-labelledby="plotpickle-agents-title">
        <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>SETTINGS / AGENTS</p>
        <h1 id="plotpickle-agents-title" style={{ margin: "5px 0" }}>AGENT SETUP</h1>
        <p style={{ margin: 0, color: "var(--pp-skin-ink-soft)" }}>One roster for PlotPickle, BUZZ and external developer Agents. PlotPickle text Agents follow the Writing route selected in Hybrid.</p>
      </section>

      <section style={panel} aria-labelledby="agent-default-title">
        <h2 id="agent-default-title" style={{ marginTop: 0 }}>WRITING COMPUTE</h2>
        <p>Selected in Hybrid: <strong>{effectiveDefaultLabel}</strong></p>
        <p>Configure and test resources under Local or Cloud, then choose the Writing resource in Settings → Hybrid. If that resource becomes unavailable, work stops with a diagnostic; no fallback provider is used.</p>
      </section>

      <section style={panel} aria-labelledby="agent-roster-title">
        <h2 id="agent-roster-title" style={{ marginTop: 0 }}>AGENT ROSTER</h2>
        <p style={{ marginTop: 0, color: "var(--pp-skin-ink-soft)" }}>Sorted by system, then Agent name. Every known Agent is visible; PlotPickle-owned text inference follows Hybrid.</p>
        <div style={{ overflowX: "auto", border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)" }}>
          <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", background: "var(--pp-skin-surface-0)" }} data-agent-roster="complete">
            <thead>
              <tr style={{ background: "var(--pp-skin-surface-2)" }}>
                <th scope="col" style={tableCell}>Agent Name</th>
                <th scope="col" style={tableCell}>Job</th>
                <th scope="col" style={tableCell}>Provider</th>
                <th scope="col" style={tableCell}>System</th>
              </tr>
            </thead>
            <tbody>
              {status.agents.map((agent) => {
                const roleId = agent.roleId;
                return (
                  <tr key={agent.agentId} data-agent-system={agent.system} data-agent-configurable={agent.configurable ? "true" : "false"}>
                    <td style={tableCell}>
                      <strong>{agent.displayName}</strong>
                    </td>
                    <td style={{ ...tableCell, minWidth: 280 }}>
                      <strong>{agent.title}</strong>
                      <p style={{ margin: "4px 0 0", color: "var(--pp-skin-ink-soft)", lineHeight: 1.35 }}>{agent.responsibility}</p>
                    </td>
                    <td style={{ ...tableCell, minWidth: 300 }}>
                      {agent.configurable && roleId ? (
                        <div aria-label={`${agent.displayName} provider`}><strong>{effectiveDefaultLabel}</strong><p>Hybrid Writing selection</p></div>
                      ) : (
                        <div>
                          <strong>{agent.providerLabel}</strong>
                          {agent.requestedCapabilityRole ? <p style={{ margin: "4px 0 0", color: "var(--pp-skin-ink-soft)" }}>{agent.requestedCapabilityRole} capability requested; provider ownership stays with {agent.system}.</p> : null}
                        </div>
                      )}
                    </td>
                    <td style={tableCell}><strong>{agent.system}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ResponsibilityRunActivity />

      <section style={panel}>
        <strong>BOUNDARY</strong>
        <p style={{ marginBottom: 0, color: "var(--pp-skin-ink-soft)" }}>BUZZ identity, rooms, presence, keys, provider and model settings remain in BUZZ. Pi and Cline remain external developer Agents governed by AGENTS.md and the developer-agent stack. Deterministic Agents do not gain an LLM selector. No Agent can grant itself a provider, expand its tools, alter canon authority or silently fall back to paid cloud compute.</p>
      </section>
      <p role="status" aria-live="polite" style={{ ...panel, color: "var(--pp-skin-ink-soft)" }}>{notice}</p>
    </div>
  );
}
