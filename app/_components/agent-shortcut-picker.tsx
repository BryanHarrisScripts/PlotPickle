"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export type AgentShortcutTarget = {
  roleId: string;
  displayName: string;
  title: string;
};

type AgentOption = {
  agentId: string;
  roleId: string | null;
  displayName: string;
  title: string;
  system: "PlotPickle" | "BUZZ" | "External Developer";
  configurable: boolean;
};

type AgentComputeStatus = {
  ok: boolean;
  agents?: AgentOption[];
  message?: string;
};

type Props = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  selectedAgent: AgentShortcutTarget | null;
  onAgentChange: (agent: AgentShortcutTarget | null) => void;
  disabled?: boolean;
};

function talkableAgents(status: AgentComputeStatus) {
  return (status.agents ?? [])
    .filter((agent) => agent.system === "PlotPickle" && agent.configurable && typeof agent.roleId === "string")
    .map((agent) => ({
      roleId: agent.roleId as string,
      displayName: agent.displayName,
      title: agent.title,
    }));
}

export default function AgentShortcutPicker({ inputRef, selectedAgent, onAgentChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentShortcutTarget[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const loadAgents = useCallback(async () => {
    if (agents.length) return agents;
    setMessage("Loading PlotPickle Agents…");
    try {
      const response = await fetch("/api/writing-assistant/agent-compute", { cache: "no-store" });
      const body = await response.json() as AgentComputeStatus;
      if (!response.ok || !body.ok) throw new Error(body.message || "PlotPickle Agents could not be loaded.");
      const next = talkableAgents(body);
      setAgents(next);
      setMessage(next.length ? "" : "No conversational PlotPickle Agents are available.");
      return next;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PlotPickle Agents could not be loaded.");
      return [];
    }
  }, [agents]);

  const openPicker = useCallback(async () => {
    if (disabled) return;
    setOpen(true);
    const next = await loadAgents();
    const currentIndex = selectedAgent ? next.findIndex((agent) => agent.roleId === selectedAgent.roleId) : -1;
    setHighlighted(currentIndex >= 0 ? currentIndex : 0);
  }, [disabled, loadAgents, selectedAgent]);

  const choose = useCallback((agent: AgentShortcutTarget) => {
    onAgentChange(agent);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [inputRef, onAgentChange]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;
      const emptyPrompt = input.value.trim().length === 0;
      if (!open && event.key === "/" && emptyPrompt) {
        event.preventDefault();
        void openPicker();
        return;
      }
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (!agents.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlighted((current) => (current + 1) % agents.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((current) => (current - 1 + agents.length) % agents.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        choose(agents[highlighted] ?? agents[0]);
      }
    };
    input.addEventListener("keydown", handleKeyDown);
    return () => input.removeEventListener("keydown", handleKeyDown);
  }, [agents, choose, disabled, highlighted, inputRef, open, openPicker]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", handleOutside);
    return () => window.removeEventListener("pointerdown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        aria-label={selectedAgent ? `Choose Agent. Current target: ${selectedAgent.displayName}` : "Choose Agent"}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => void openPicker()}
        title="Choose Agent (or type / in an empty prompt)"
        style={{
          minWidth: 42,
          minHeight: 42,
          border: "1px solid #9eb7b0",
          borderRadius: 12,
          background: "#fff",
          color: "#214d43",
          font: "700 1.15rem/1 system-ui, sans-serif",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        /
      </button>

      {selectedAgent ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onAgentChange(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          aria-label={`Stop talking to ${selectedAgent.displayName} and use the default PlotPickle Assistant`}
          title={selectedAgent.title}
          style={{
            maxWidth: 190,
            minHeight: 42,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            border: "1px solid #9eb7b0",
            borderRadius: 12,
            background: "#edf6f3",
            color: "#214d43",
            padding: "0 10px",
            font: "700 .76rem/1.1 system-ui, sans-serif",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {selectedAgent.displayName} ×
        </button>
      ) : null}

      {open ? (
        <div
          role="listbox"
          aria-label="PlotPickle Agents you can talk to"
          style={{
            position: "absolute",
            left: 0,
            bottom: "calc(100% + 8px)",
            zIndex: 40,
            width: "min(360px, 78vw)",
            maxHeight: 360,
            overflowY: "auto",
            border: "1px solid #425952",
            borderRadius: 14,
            background: "#101513",
            boxShadow: "0 16px 40px rgba(0,0,0,.34)",
            padding: 8,
          }}
        >
          {agents.map((agent, index) => (
            <button
              key={agent.roleId}
              type="button"
              role="option"
              aria-selected={selectedAgent?.roleId === agent.roleId}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => choose(agent)}
              style={{
                display: "grid",
                gap: 2,
                width: "100%",
                padding: "10px 11px",
                border: 0,
                borderRadius: 9,
                background: highlighted === index ? "#25322e" : "transparent",
                color: "#f3f8f6",
                textAlign: "left",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              <strong>{agent.displayName}</strong>
              <span style={{ color: "#a9bbb5", fontSize: ".76rem" }}>{agent.title}</span>
            </button>
          ))}
          {message ? <p role="status" style={{ margin: 0, padding: 10, color: "#c5d3cf", fontSize: ".78rem" }}>{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
