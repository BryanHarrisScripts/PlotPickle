"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import styles from "./learn-three-column-shell.module.css";

type Props = {
  project: PlotPickleProject;
  blockNumber: number;
  miniBlockNumber: number;
  children: ReactNode;
  toolbar: ReactNode;
  onOpenSettings: () => void;
};

type AgentId = "curriculum-guide" | "creative-director" | "story-architect" | "character" | "world" | "continuity" | "visual-director" | "screenwriter" | "graphic-novel" | "production" | "critic" | "workflow-change";
type ProviderId = "ollama" | "openai" | "minimax";
type RoomMessage = { id: string; role: "user" | "assistant"; content: string; agent?: string };
type AssistantStatus = {
  activeProvider: ProviderId | "disabled";
  explicitlyDisabled: boolean;
  providers: Record<ProviderId, { configured: boolean; model?: string }>;
  ollama: { reachable: boolean; models: string[]; baseUrl: string };
  mastra: { runtime: "mastra"; version: string; ready: boolean; agents: AgentId[] };
};
type AssistantResponse = { provider: ProviderId; model: string; runtime: "mastra"; agentId: AgentId; text: string; latencyMs: number };

const curriculumNavigation = [
  { icon: "▶", label: "Start Here", detail: "Begin your learning journey", view: "home" },
  { icon: "▱", label: "The PlotPickle Method", detail: "Our visual writing approach", view: "method" },
  { icon: "●", label: "Core Concepts", detail: "Story, structure, and logic", view: "library" },
  { icon: "▦", label: "Story Architecture", detail: "4 Acts · 24 Blocks · 96 Mini-Blocks", view: "method" },
  { icon: "▧", label: "Visual Writing", detail: "Write in pictures, not just words", view: "library" },
  { icon: "⌘", label: "Tools & Workspaces", detail: "Learn the PlotPickle workflow", view: "workflow" },
  { icon: "◇", label: "Guides & Tutorials", detail: "Step-by-step walkthroughs", view: "guide" },
  { icon: "✦", label: "Examples & Case Studies", detail: "See the method in action", view: "library" },
  { icon: "◎", label: "Community", detail: "Learn and create together", view: "working-together" },
] as const;

function actForBlock(block: number) {
  if (block <= 6) return 1;
  if (block <= 12) return 2;
  if (block <= 18) return 3;
  return 4;
}

function messageId() {
  return globalThis.crypto?.randomUUID?.() ?? `room-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function jsonRequest<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "The Creative Room could not reach the Writing Assistant.");
  return value;
}

export default function LearnThreeColumnShell({ project, blockNumber, miniBlockNumber, children, toolbar, onOpenSettings }: Props) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [notice, setNotice] = useState("Connecting to the selected writing engine…");
  const [roomError, setRoomError] = useState("");
  const [working, setWorking] = useState(false);
  const [currentView, setCurrentView] = useState("home");
  const block = project.blocks[blockNumber - 1];
  const minis = block?.scenes.flatMap((scene) => scene.miniBlocks) ?? [];
  const mini = minis[miniBlockNumber - 1];
  const act = actForBlock(blockNumber);
  const contextLabel = useMemo(() => `Act ${act} · Block ${blockNumber}.${miniBlockNumber}`, [act, blockNumber, miniBlockNumber]);

  function openLearnView(view: string) {
    setCurrentView(view);
    window.dispatchEvent(new CustomEvent("plotpickle:learn-view", { detail: view }));
  }

  useEffect(() => {
    const reflectView = (event: Event) => {
      const requested = (event as CustomEvent<unknown>).detail;
      if (typeof requested === "string") setCurrentView(requested);
    };
    window.addEventListener("plotpickle:learn-view", reflectView);
    return () => window.removeEventListener("plotpickle:learn-view", reflectView);
  }, []);

  useEffect(() => {
    let active = true;
    void jsonRequest<AssistantStatus>("/api/writing-assistant/status")
      .then((next) => {
        if (!active) return;
        setStatus(next);
        setNotice(next.activeProvider === "disabled"
          ? next.explicitlyDisabled
            ? "Writing assistance is Off by choice. Turn it on in Settings to talk with the room."
            : "No local or cloud writing engine is ready. Open Settings to connect one."
          : `${next.activeProvider === "ollama" ? "Ollama" : next.activeProvider === "openai" ? "OpenAI" : "MiniMax"} · ${next.providers[next.activeProvider].model || "configured model"}`);
      })
      .catch((error) => {
        if (!active) return;
        setNotice(error instanceof Error ? error.message : "The Creative Room connection could not be checked.");
      });
    return () => { active = false; };
  }, []);

  async function askRoom(text: string, appendUser = true) {
    if (!text || working || !status || status.activeProvider === "disabled") return;
    const userMessage: RoomMessage = { id: messageId(), role: "user", content: text };
    const historyMessages = appendUser ? messages : messages.slice(0, -1);
    const history = historyMessages.map(({ role, content }) => ({ role, content }));
    const blockTitle = block?.title || "Untitled story block";
    const miniLabel = mini?.label || "Untitled story movement";
    const contextualPrompt = [
      "Speak as the PlotPickle Curriculum Guide.",
      "Use the most relevant retrieved lessons from the complete 81-module curriculum.",
      `Active story: ${project.metadata.title || "Untitled Story"}.`,
      `Story position: Act ${act}, Block ${blockNumber} (${blockTitle}), Mini-Block ${blockNumber}.${miniBlockNumber} (${miniLabel}).`,
      "Treat existing project material as canon. Offer advice or candidates; do not claim to have changed the story.",
      `Writer: ${text}`,
    ].join("\n");
    if (appendUser) setMessages((current) => [...current, userMessage]);
    setDraft("");
    setRoomError("");
    setWorking(true);
    setNotice("Searching the PlotPickle curriculum…");
    try {
      const result = await jsonRequest<AssistantResponse>("/api/writing-assistant/chat", "POST", { agentId: "curriculum-guide", tone: "collaborative", message: contextualPrompt, history });
      setMessages((current) => [...current, { id: messageId(), role: "assistant", content: result.text, agent: "PlotPickle Guide" }]);
      setNotice(`Mastra · ${result.provider === "ollama" ? "Ollama" : result.provider === "openai" ? "OpenAI" : "MiniMax"} · ${result.model} · ${result.latencyMs} ms`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The selected Creative Room agent could not answer.";
      setDraft(text);
      setRoomError(message);
      setNotice("The room could not finish that answer. Your question is ready to retry.");
    } finally {
      setWorking(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    await askRoom(draft.trim());
  }

  return (
    <section className={styles.shell} data-learn-three-column="v1" aria-label="Learn visual creative writing room">
      <aside className={styles.navigator} aria-label="Story Navigator">
        <div className={styles.brand}><span>LEARN</span><strong>Master the craft.</strong><small>Build visual stories that connect.</small></div>
        <nav className={styles.storyNav} aria-label="PlotPickle curriculum">
          {curriculumNavigation.map((item) => <button type="button" className={currentView === item.view ? styles.active : ""} aria-current={currentView === item.view ? "page" : undefined} onClick={() => openLearnView(item.view)} key={item.label}><b aria-hidden="true">{item.icon}</b><span><strong>{item.label}</strong><small>{item.detail}</small></span></button>)}
        </nav>
        <div className={styles.rule}><span>81 complete modules</span><p>Your progress stays with this project. Lessons and agent guidance never alter canon automatically.</p></div>
      </aside>

      <main className={styles.canvas} aria-label="Learn Creative Canvas">
        <div className={styles.canvasToolbar}>{toolbar}</div>
        {children}
      </main>

      <aside className={styles.room} aria-label="Creative Room">
        <div className={styles.roomHeading}><span>PLOTPICKLE GUIDE · 81 MODULES</span><h2>Ask while you learn.</h2><p>Your curriculum guide searches the complete PlotPickle course and answers in the context of the active story.</p></div>
        <div className={styles.agentCard}><strong>PlotPickle Curriculum Guide</strong><span>Story craft, visual writing, the 24/96 method, characters, dialogue, revision, collaboration and responsible AI.</span><small>{contextLabel} · advisory · canon-safe</small></div>
        <div className={styles.thread} aria-live="polite">
          <p className={styles.agentMessage}>Ask me anything about the PlotPickle method or how a lesson applies to {project.metadata.title || "your story"}. I’ll use the relevant curriculum material and show you a practical next step.</p>
          {messages.map((message) => <p className={message.role === "user" ? styles.userMessage : styles.agentMessage} key={message.id}><strong>{message.role === "user" ? "You" : message.agent}</strong>{message.content}</p>)}
          {working ? <p className={styles.thinking}>The room is considering this story moment…</p> : null}
        </div>
        {status?.activeProvider === "disabled" ? <div className={styles.connectionNotice}><p>{notice}</p><div><button type="button" onClick={onOpenSettings}>Open Writing Assistant Settings</button></div></div> : null}
        {roomError ? <div className={styles.connectionNotice} role="alert"><p>{roomError}</p><div><button type="button" disabled={working || !draft.trim()} onClick={() => void askRoom(draft.trim(), false)}>Try again</button><button type="button" onClick={onOpenSettings}>Choose a faster model</button></div></div> : null}
        <form className={styles.composer} onSubmit={send}>
          <textarea aria-label="Ask the PlotPickle Curriculum Guide" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={status?.activeProvider === "disabled" ? "Connect a writing engine in Settings to begin." : "Ask about story, structure, visual writing, characters, dialogue or the 24/96 method…"} disabled={working || !status || status.activeProvider === "disabled"} />
          <button type="submit" disabled={working || !draft.trim() || !status || status.activeProvider === "disabled"}>Ask PlotPickle</button>
        </form>
        <p className={styles.status} role="status">{notice}</p>
        <footer><span>{status?.mastra?.ready ? "Curriculum agent ready" : "Agent runtime connecting"}</span><span>81 modules indexed</span><span>Canon requires approval</span></footer>
      </aside>
    </section>
  );
}
