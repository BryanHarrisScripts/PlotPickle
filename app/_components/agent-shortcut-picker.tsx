"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import styles from "./agent-shortcut-picker.module.css";

type AgentShortcutField = HTMLInputElement | HTMLTextAreaElement;

export type AgentShortcutTarget = {
  readonly profileId: string;
  readonly roleId: string;
  readonly displayName: string;
  readonly title: string;
};

type AgentRosterItem = {
  readonly profileId?: string | null;
  readonly roleId?: string | null;
  readonly displayName?: string;
  readonly title?: string;
  readonly system?: string;
  readonly configurable?: boolean;
};

type AgentComputeSnapshot = {
  readonly agents?: readonly AgentRosterItem[];
};

type AgentShortcutPickerProps = {
  readonly inputRef: RefObject<AgentShortcutField | null>;
  readonly selectedAgent: AgentShortcutTarget | null;
  readonly onAgentChange: (agent: AgentShortcutTarget | null) => void;
  readonly disabled?: boolean;
  readonly className?: string;
};

const AGENT_DIRECTORY_PATH = "/api/writing-assistant/agent-compute";

function conversationalAgents(value: AgentComputeSnapshot): AgentShortcutTarget[] {
  if (!Array.isArray(value.agents)) return [];
  return value.agents.flatMap((agent) => {
    if (
      agent.system !== "PlotPickle"
      || agent.configurable !== true
      || typeof agent.profileId !== "string"
      || !agent.profileId
      || typeof agent.roleId !== "string"
      || !agent.roleId
      || typeof agent.displayName !== "string"
      || !agent.displayName.trim()
    ) return [];
    return [{
      profileId: agent.profileId,
      roleId: agent.roleId,
      displayName: agent.displayName.trim(),
      title: typeof agent.title === "string" ? agent.title.trim() : "PlotPickle Agent",
    }];
  });
}

export default function AgentShortcutPicker({
  inputRef,
  selectedAgent,
  onAgentChange,
  disabled = false,
  className = "",
}: AgentShortcutPickerProps) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentShortcutTarget[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const listId = useId();

  const restoreInputFocus = useCallback(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [inputRef]);

  const loadAgents = useCallback(async () => {
    if (agents.length || loading) return agents;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(AGENT_DIRECTORY_PATH, { headers: { Accept: "application/json" } });
      const body = await response.json() as AgentComputeSnapshot & { readonly message?: string };
      if (!response.ok) throw new Error(body.message || "The PlotPickle Agent directory is unavailable.");
      const next = conversationalAgents(body);
      if (!next.length) throw new Error("No conversational PlotPickle Agents are currently available.");
      setAgents(next);
      setActiveIndex(Math.max(0, next.findIndex((agent) => agent.profileId === selectedAgent?.profileId)));
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PlotPickle Agent directory is unavailable.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [agents, loading, selectedAgent?.profileId]);

  const openPicker = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setError("");
    setActiveIndex(Math.max(0, agents.findIndex((agent) => agent.profileId === selectedAgent?.profileId)));
    void loadAgents();
  }, [agents, disabled, loadAgents, selectedAgent?.profileId]);

  const choose = useCallback((agent: AgentShortcutTarget) => {
    onAgentChange(agent);
    setOpen(false);
    restoreInputFocus();
  }, [onAgentChange, restoreInputFocus]);

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (disabled || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (open) {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          if (!agents.length) return;
          event.preventDefault();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((current) => (current + delta + agents.length) % agents.length);
          return;
        }
        if (event.key === "Enter" && agents[activeIndex]) {
          event.preventDefault();
          choose(agents[activeIndex]);
        }
        return;
      }
      if (event.key !== "/") return;
      const start = field.selectionStart ?? 0;
      const end = field.selectionEnd ?? start;
      if (start !== end || start !== 0 || field.value.trim().length !== 0) return;
      event.preventDefault();
      openPicker();
    };
    field.addEventListener("keydown", onKeyDown);
    return () => field.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, agents, choose, disabled, inputRef, open, openPicker]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || rootRef.current?.contains(target) || inputRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [inputRef, open]);

  return (
    <span className={`${styles.root} ${className}`.trim()} ref={rootRef}>
      {selectedAgent ? (
        <span className={styles.target} title={selectedAgent.title}>
          <span>Talk to {selectedAgent.displayName}</span>
          <button
            type="button"
            aria-label={`Clear ${selectedAgent.displayName} as the selected Agent`}
            disabled={disabled}
            onClick={() => { onAgentChange(null); restoreInputFocus(); }}
          >×</button>
        </span>
      ) : null}
      <button
        type="button"
        className={styles.slashButton}
        aria-label="Choose a PlotPickle Agent. Keyboard shortcut slash."
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => { if (open) setOpen(false); else openPicker(); }}
        title="Choose Agent (/)"
      >/</button>
      {open ? (
        <div className={styles.menu} id={listId} role="listbox" aria-label="PlotPickle Agents you can talk to">
          <header><strong>Talk to an Agent</strong><small>↑ ↓ to move · Enter to choose · Esc to close</small></header>
          {loading && !agents.length ? <p role="status">Loading Agents…</p> : null}
          {error ? <p className={styles.error} role="status">{error}</p> : null}
          {agents.map((agent, index) => (
            <button
              type="button"
              role="option"
              aria-selected={selectedAgent?.profileId === agent.profileId}
              data-active={index === activeIndex || undefined}
              key={agent.profileId}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(agent)}
            >
              <strong>{agent.displayName}</strong>
              <small>{agent.title}</small>
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
