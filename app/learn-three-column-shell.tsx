"use client";

import { ReactNode, useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import styles from "./learn-three-column-shell.module.css";

type Props = {
  project: PlotPickleProject;
  blockNumber: number;
  miniBlockNumber: number;
  children: ReactNode;
};

type AgentId = "creative-director" | "story-architect" | "character" | "world" | "continuity" | "visual-director" | "screenwriter" | "graphic-novel" | "production" | "critic";
type ToneId = "collaborative" | "direct" | "curious" | "challenging" | "gentle";

const agents: { id: AgentId; label: string; role: string }[] = [
  { id: "creative-director", label: "Creative Director", role: "Coordinates the room and keeps the story moving." },
  { id: "story-architect", label: "Story Architect", role: "Structure, causality, stakes and the 24/96 story map." },
  { id: "character", label: "Character", role: "Motivation, choice, relationships, arc and voice." },
  { id: "world", label: "World", role: "Locations, rules, atmosphere and story-world coherence." },
  { id: "continuity", label: "Continuity", role: "Canon, timeline, contradictions and carried details." },
  { id: "visual-director", label: "Visual Director", role: "Composition, visual language, imagery and screen intention." },
  { id: "screenwriter", label: "Screenwriter", role: "Scenes, action, dialogue and screenplay craft." },
  { id: "graphic-novel", label: "Graphic Novel", role: "Panels, page flow and visual narrative beats." },
  { id: "production", label: "Production", role: "Turns approved direction into provider-ready production work." },
  { id: "critic", label: "Feedback / Critic", role: "Tests clarity and story strength without rewriting canon." },
];

const tones: { id: ToneId; label: string }[] = [
  { id: "collaborative", label: "Collaborative" },
  { id: "direct", label: "Direct" },
  { id: "curious", label: "Curious" },
  { id: "challenging", label: "Challenging" },
  { id: "gentle", label: "Gentle" },
];

function actForBlock(block: number) {
  if (block <= 6) return 1;
  if (block <= 12) return 2;
  if (block <= 18) return 3;
  return 4;
}

function starterReply(agent: AgentId, block: number, mini: number, title: string) {
  const position = `Block ${block}.${mini}`;
  const replies: Record<AgentId, string> = {
    "creative-director": `We are working in ${position}. I can bring the right specialist into the room while keeping ${title} as the same active story. What are you trying to discover, strengthen or see?`,
    "story-architect": `${position} is our structural address. Tell me what this moment must change, and I’ll test its cause, consequence and place in the larger 24/96 movement.`,
    character: `Tell me whose choice matters most in ${position}. I’ll focus on motivation, pressure and behaviour rather than changing canon for you.`,
    world: `Let’s make ${position} feel physically specific. Tell me what the audience should notice first about the place, rules or atmosphere.`,
    continuity: `I’ll treat the current PPF as canon and flag conflicts as proposals. What detail in ${position} do you want checked against the rest of the story?`,
    "visual-director": `Describe the feeling you want from ${position}. I’ll translate it into framing, visual language and image direction while the writing is still evolving.`,
    screenwriter: `Give me the dramatic job of ${position}. I’ll help shape playable action and dialogue without silently replacing your accepted story.`,
    "graphic-novel": `Let’s turn ${position} into readable visual beats. I can explore panel emphasis, reveals and page rhythm as candidates for you to approve.`,
    production: `I’ll work only from approved creative direction. We can prepare local-first image/video work without triggering paid generation silently.`,
    critic: `I’ll pressure-test ${position} for clarity, stakes and audience experience, then return observations rather than overwrite your source material.`,
  };
  return replies[agent];
}

export default function LearnThreeColumnShell({ project, blockNumber, miniBlockNumber, children }: Props) {
  const [agent, setAgent] = useState<AgentId>("creative-director");
  const [tone, setTone] = useState<ToneId>("collaborative");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const activeAgent = agents.find((item) => item.id === agent) ?? agents[0];
  const block = project.blocks[blockNumber - 1];
  const minis = block?.scenes.flatMap((scene) => scene.miniBlocks) ?? [];
  const mini = minis[miniBlockNumber - 1];
  const act = actForBlock(blockNumber);
  const contextLabel = useMemo(() => `Act ${act} · Block ${blockNumber}.${miniBlockNumber}`, [act, blockNumber, miniBlockNumber]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, `You: ${text}`, `${activeAgent.label}: ${starterReply(agent, blockNumber, miniBlockNumber, project.metadata.title || "this story")}`]);
    setDraft("");
  }

  return (
    <section className={styles.shell} data-learn-three-column="v1" aria-label="Learn visual creative writing room">
      <aside className={styles.navigator} aria-label="Story Navigator">
        <div className={styles.brand}><span>PLOTPICKLE</span><strong>Words to Worlds.</strong><small>Write What You See.</small></div>
        <div className={styles.projectCard}><span>Active story</span><h2>{project.metadata.title || "Untitled Story"}</h2><p>{contextLabel}</p></div>
        <nav className={styles.storyNav} aria-label="Learn story context">
          <button type="button" className={styles.active}>Learn</button>
          <button type="button">Act {act}</button>
          <button type="button">Block {blockNumber} · {block?.title || "Story Block"}</button>
          <button type="button">Mini {blockNumber}.{miniBlockNumber} · {mini?.label || "Story movement"}</button>
        </nav>
        <div className={styles.rule}><span>Story contract</span><p>Learning stays attached to this project. Suggestions remain candidates until you approve them.</p></div>
      </aside>

      <main className={styles.canvas} aria-label="Learn Creative Canvas">{children}</main>

      <aside className={styles.room} aria-label="Creative Room">
        <div className={styles.roomHeading}><span>CREATIVE ROOM · ONLINE</span><h2>In a plot pickle? Bring in the room.</h2><p>Choose who you want to talk with. The room works from the active story and does not silently change canon.</p></div>
        <label className={styles.control}>Talk with<select aria-label="Creative Room agent" value={agent} onChange={(event) => setAgent(event.target.value as AgentId)}>{agents.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label className={styles.control}>Conversation tone<select aria-label="Creative Room tone" value={tone} onChange={(event) => setTone(event.target.value as ToneId)}>{tones.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <div className={styles.agentCard}><strong>{activeAgent.label}</strong><span>{activeAgent.role}</span><small>{tone} tone · advisory · PPF-aware boundary</small></div>
        <div className={styles.thread} aria-live="polite">
          <p className={styles.agentMessage}>{starterReply(agent, blockNumber, miniBlockNumber, project.metadata.title || "this story")}</p>
          {messages.map((message, index) => <p className={message.startsWith("You:") ? styles.userMessage : styles.agentMessage} key={`${message}-${index}`}>{message}</p>)}
        </div>
        <div className={styles.composer}>
          <textarea aria-label={`Message ${activeAgent.label}`} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Ask ${activeAgent.label} about this story…`} />
          <button type="button" onClick={send}>Send to {activeAgent.label}</button>
        </div>
        <footer><span>Local room preview</span><span>No paid generation</span><span>Canon requires approval</span></footer>
      </aside>
    </section>
  );
}
