"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyBuzzStoryProposal,
  BUZZ_STORY_ROOM_VERSION,
  BUZZ_STORY_ROOMS,
  buzzProjectSlug,
  buzzRoomName,
  collectBuzzStoryTargets,
  declineBuzzStoryProposal,
  projectIdentity,
  validBuzzStoryProposal,
  type BuzzStoryProposal,
  type BuzzStoryRoomId,
} from "@/lib/buzz-story-room";
import {
  BUZZ_RUNTIME_BOUNDARIES,
} from "@/lib/buzz-runtime";
import styles from "./buzz-workspace.module.css";

const PROJECT_STORAGE_KEY = "plotpickle.project.v1";
const PROPOSAL_STORAGE_KEY = "plotpickle.buzz.proposals.v1";
const API = "/api/local-buzz";

type PublicBuzzStatus = {
  connection: {
    configured: boolean;
    mode: "existing-relay" | "managed";
    relayUrl: string;
    community: string;
    identityLabel: string;
    cliPath: string;
    identityConfigured: boolean;
    verifiedAt: string;
  };
  relay: { reachable: boolean; checkedAt: string; latencyMs: number; detail: string };
  cli: { available: boolean; executable: string; version: string; error: string };
  managed: {
    bundle: { available: boolean; sourceTag: string; sourceRevision: string; relayImage: string; validationGate: string; error: string };
    docker: { available: boolean; engine: string; compose: string; error: string };
    installed: boolean;
    configured: boolean;
    running: boolean;
    reachable: boolean;
    relayUrl: string;
    backups: string[];
    lifecycle: string;
    message: string;
  };
};

type BuzzChannel = { id: string; name: string; description: string };
type BuzzRoomRecord = { roomId: BuzzStoryRoomId; channel: BuzzChannel; created?: boolean };
type BuzzMessage = { id: string; content: string; author: string; createdAt: string };

type BuzzWorkspaceProps = {
  onOpenSettings: () => void;
};

function readProject() {
  if (typeof window === "undefined") return null;
  try {
    const source = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    const value: unknown = source ? JSON.parse(source) : null;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

function readProposals() {
  if (typeof window === "undefined") return [] as BuzzStoryProposal[];
  try {
    const source = window.localStorage.getItem(PROPOSAL_STORAGE_KEY);
    const value: unknown = source ? JSON.parse(source) : [];
    return Array.isArray(value) ? value.filter(validBuzzStoryProposal) : [];
  } catch { return []; }
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `buzz-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function jsonPath(path: Array<string | number>) {
  return JSON.stringify(path);
}

function shortDate(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusTone(status: PublicBuzzStatus | null) {
  if (status?.relay.reachable && status.connection.configured) return "ready";
  if (status?.connection.configured) return "degraded";
  return "optional";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as { message?: string } & T;
  if (!response.ok) throw new Error(body.message || `Buzz returned ${response.status}.`);
  return body;
}

export default function BuzzWorkspace({ onOpenSettings }: BuzzWorkspaceProps) {
  const [project, setProject] = useState<Record<string, unknown> | null>(readProject);
  const [proposals, setProposals] = useState<BuzzStoryProposal[]>(readProposals);
  const [status, setStatus] = useState<PublicBuzzStatus | null>(null);
  const [rooms, setRooms] = useState<BuzzRoomRecord[]>([]);
  const [messages, setMessages] = useState<BuzzMessage[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<BuzzStoryRoomId>("story");
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [manualExcerpt, setManualExcerpt] = useState("");
  const [targetId, setTargetId] = useState("");
  const [fieldPath, setFieldPath] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalRationale, setProposalRationale] = useState("");
  const [proposedValue, setProposedValue] = useState("");
  const [decidedBy, setDecidedBy] = useState("Project owner");
  const [decisionNote, setDecisionNote] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void request<PublicBuzzStatus & { ok: true }>("/status")
      .then((body) => { if (!cancelled) setStatus(body); })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Buzz status could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  const identity = useMemo(() => projectIdentity(project), [project]);
  const projectPrefix = useMemo(() => buzzProjectSlug(project), [project]);
  const targets = useMemo(() => collectBuzzStoryTargets(project), [project]);
  const selectedTarget = targets.find((target) => target.id === targetId) ?? targets[0] ?? null;
  const selectedField = selectedTarget?.fields.find((field) => jsonPath(field.path) === fieldPath) ?? selectedTarget?.fields[0] ?? null;
  const selectedRoom = rooms.find((room) => room.roomId === selectedRoomId) ?? null;
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? null;
  const projectProposals = proposals.filter((proposal) => proposal.projectId === identity.id);
  const openProposals = projectProposals.filter((proposal) => proposal.status === "open");
  const tone = statusTone(status);
  const configured = Boolean(status?.connection.configured);
  const desktopDetected = Boolean(status?.cli.available);
  const canUseCli = Boolean(status?.connection.configured && status.relay.reachable && status.cli.available);
  const canWriteBuzz = Boolean(canUseCli && status?.connection.identityConfigured);
  const statusTitle = status?.relay.reachable && configured
    ? "Buzz community connected"
    : configured
      ? "Buzz connection needs attention"
      : desktopDetected
        ? "Buzz Desktop found · setup incomplete"
        : "Buzz setup not complete";
  const statusDetail = configured
    ? status?.relay.detail || "PlotPickle is checking the saved Buzz community."
    : desktopDetected
      ? "The app is installed. PlotPickle still needs your Buzz community URL and identity."
      : status
        ? "Install Buzz Desktop, then connect the community you create or join."
        : "Checking this computer for Buzz Desktop…";

  function persistProposals(next: BuzzStoryProposal[]) {
    setProposals(next);
    window.localStorage.setItem(PROPOSAL_STORAGE_KEY, JSON.stringify(next));
  }

  async function refreshStatus(showNotice = false) {
    setBusy("status");
    try {
      const body = await request<PublicBuzzStatus & { ok: true }>("/status");
      setStatus(body);
      if (showNotice) setNotice(body.relay.reachable ? "Buzz is connected and reachable." : body.relay.detail);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Buzz status could not be refreshed.");
    } finally { setBusy(""); }
  }

  async function loadRooms() {
    if (!canUseCli) {
      setNotice("Install or configure the Buzz CLI to load rooms inside PlotPickle. The external Buzz workspace can still be opened.");
      return;
    }
    setBusy("rooms");
    try {
      const body = await request<{ rooms: BuzzChannel[] }>(`/rooms?projectPrefix=${encodeURIComponent(projectPrefix)}`);
      const mapped = body.rooms.flatMap((channel) => {
        const definition = BUZZ_STORY_ROOMS.find((room) => channel.name === buzzRoomName(project, room.id));
        return definition ? [{ roomId: definition.id, channel } satisfies BuzzRoomRecord] : [];
      });
      setRooms(mapped);
      setNotice(mapped.length ? `Loaded ${mapped.length} project Story Room${mapped.length === 1 ? "" : "s"}.` : "No project Story Rooms exist yet.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Rooms could not be loaded.");
    } finally { setBusy(""); }
  }

  async function ensureRooms() {
    if (!project) { setNotice("Open or create a PlotPickle project before creating Story Rooms."); return; }
    if (!canWriteBuzz) { setNotice("A reachable relay, Buzz CLI and encrypted Buzz identity are required before PlotPickle can create rooms."); return; }
    setBusy("ensure");
    try {
      const body = await request<{ rooms: BuzzRoomRecord[] }>("/rooms/ensure", {
        method: "POST",
        body: JSON.stringify({
          projectPrefix,
          rooms: BUZZ_STORY_ROOMS.map((room) => ({
            id: room.id,
            name: buzzRoomName(project, room.id),
            description: `${identity.title} · ${room.description}`,
          })),
        }),
      });
      setRooms(body.rooms);
      setNotice(`The ${body.rooms.length} private project Story Rooms are ready.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Rooms could not be created.");
    } finally { setBusy(""); }
  }

  async function loadMessages(room = selectedRoom) {
    if (!room) { setMessages([]); return; }
    setBusy("messages");
    try {
      const body = await request<{ messages: BuzzMessage[] }>(`/messages?channel=${encodeURIComponent(room.channel.id)}&limit=50`);
      setMessages(body.messages);
      setSelectedMessageId("");
      setNotice(`Loaded ${body.messages.length} signed Buzz message${body.messages.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Buzz messages could not be loaded.");
    } finally { setBusy(""); }
  }

  async function sendMessage() {
    if (!selectedRoom || !messageDraft.trim()) return;
    setBusy("send");
    try {
      await request("/messages", { method: "POST", body: JSON.stringify({ channel: selectedRoom.channel.id, content: messageDraft.trim() }) });
      setMessageDraft("");
      await loadMessages(selectedRoom);
      setNotice("The signed message was added to the Story Room.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Buzz message could not be sent.");
    } finally { setBusy(""); }
  }

  function createProposal() {
    if (!project || !selectedTarget || !selectedField) { setNotice("Choose a project target and field first."); return; }
    const excerpt = selectedMessage?.content || manualExcerpt.trim();
    if (!excerpt) { setNotice("Select a Buzz message or paste the relevant discussion excerpt."); return; }
    if (!proposedValue.trim()) { setNotice("Enter the exact value you want PlotPickle to propose."); return; }
    const roomName = selectedRoom?.channel.name || buzzRoomName(project, selectedRoomId);
    const channelId = selectedRoom?.channel.id || "manual-reference";
    const messageId = selectedMessage?.id || randomId();
    const relayUrl = status?.connection.relayUrl || "";
    const proposal: BuzzStoryProposal = {
      version: BUZZ_STORY_ROOM_VERSION,
      id: randomId(),
      projectId: identity.id,
      projectTitle: identity.title,
      title: proposalTitle.trim() || `Revise ${selectedField.label} for ${selectedTarget.label}`,
      rationale: proposalRationale.trim(),
      roomId: selectedRoomId,
      targetKind: selectedTarget.kind,
      targetId: selectedTarget.id,
      targetLabel: selectedTarget.label,
      fieldPath: selectedField.path,
      fieldLabel: selectedField.label,
      originalValue: selectedField.value,
      proposedValue: proposedValue.trim(),
      source: {
        relayUrl,
        community: status?.connection.community || "",
        roomId: selectedRoomId,
        roomName,
        channelId,
        messageId,
        messageUrl: selectedMessage ? `buzz://message?channel=${encodeURIComponent(channelId)}&id=${encodeURIComponent(messageId)}` : "",
        excerpt: excerpt.slice(0, 4000),
        author: selectedMessage?.author || "Pasted discussion reference",
        createdAt: selectedMessage?.createdAt || new Date().toISOString(),
      },
      status: "open",
      createdAt: new Date().toISOString(),
      decidedAt: "",
      decidedBy: "",
      decisionNote: "",
    };
    persistProposals([proposal, ...proposals]);
    setProposalTitle("");
    setProposalRationale("");
    setProposedValue("");
    setManualExcerpt("");
    setNotice("A reviewable PlotPickle proposal was created. The PPF has not changed.");
  }

  function approveProposal(proposal: BuzzStoryProposal) {
    const result = applyBuzzStoryProposal(project, proposal, decidedBy, decisionNote);
    const next = proposals.map((item) => item.id === proposal.id ? result.proposal : item);
    persistProposals(next);
    if (result.ok) {
      setProject(result.project);
      window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(result.project));
      window.dispatchEvent(new StorageEvent("storage", { key: PROJECT_STORAGE_KEY, newValue: JSON.stringify(result.project) }));
    }
    setNotice(result.message);
    setDecisionNote("");
  }

  function declineProposal(proposal: BuzzStoryProposal) {
    const declined = declineBuzzStoryProposal(proposal, decidedBy, decisionNote);
    persistProposals(proposals.map((item) => item.id === proposal.id ? declined : item));
    setNotice("The proposal was declined. The PPF project was not changed.");
    setDecisionNote("");
  }

  function openBuzz() {
    const relay = status?.connection.relayUrl;
    if (!relay) { onOpenSettings(); return; }
    const url = new URL(relay);
    if (url.protocol === "ws:") url.protocol = "http:";
    if (url.protocol === "wss:") url.protocol = "https:";
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Buzz Story Room</p>
          <h1>Discuss the story freely. Change canon deliberately.</h1>
          <span>Buzz holds rooms and signed discussion. PlotPickle turns selected discussion into a proposal. Only an explicit human approval changes the PPF.</span>
        </div>
        <div className={`${styles.status} ${styles[tone]}`} role="status">
          <i aria-hidden="true" />
          <span>
            <b>{statusTitle}</b>
            <small>{statusDetail}</small>
          </span>
        </div>
      </header>

      {!configured ? (
        <section className={styles.setupGuide} aria-labelledby="buzz-setup-title">
          <div className={styles.setupHeading}>
            <div>
              <span>Finish Buzz setup</span>
              <h2 id="buzz-setup-title">Installing Buzz Desktop is only the first step.</h2>
              <p>Buzz is a separate workspace. PlotPickle needs to know which Buzz community to use before it can find or create this project&apos;s rooms.</p>
            </div>
            <button type="button" onClick={onOpenSettings}>Open guided Buzz setup</button>
          </div>
          <div className={styles.setupSteps}>
            <article data-complete={desktopDetected ? "true" : "false"}>
              <span>1</span>
              <div><b>Buzz Desktop</b><strong>{desktopDetected ? "Detected" : "Not detected"}</strong><p>{desktopDetected ? status?.cli.version || "The supported Buzz app is installed on this computer." : "Install Buzz Desktop v0.5.3, open it once and complete its first screen."}</p></div>
            </article>
            <article>
              <span>2</span>
              <div><b>Create or join a community</b><strong>Complete this in Buzz Desktop</strong><p>The community URL is the address of your Buzz workspace. Copy it after you create or join the community.</p></div>
            </article>
            <article>
              <span>3</span>
              <div><b>Connect PlotPickle</b><strong>Community URL + identity</strong><p>Open guided setup, save those details securely, test the connection, then create the six private PlotPickle channels.</p></div>
            </article>
          </div>
          <aside className={styles.terminologyNote}>
            <b>Looking for Buzz Hangouts?</b>
            <p>Buzz calls shared discussion spaces <strong>channels</strong>. A live voice conversation is a <strong>huddle</strong>. PlotPickle groups six private channels under the friendlier name Story Rooms; there is no separate Hangouts directory to find.</p>
          </aside>
        </section>
      ) : null}

      {configured ? <section className={styles.authority} aria-label="Buzz creative authority">
        <article><span>1 · Discussion</span><h2>Buzz</h2><p>Rooms, messages, threads and source context.</p></article>
        <article><span>2 · Proposed change</span><h2>PlotPickle proposal</h2><p>The exact target, current value, proposed value and discussion reference.</p></article>
        <article><span>3 · Human decision</span><h2>Approve or decline</h2><p>No automated or casual message can bypass this review.</p></article>
        <article><span>4 · Official story</span><h2>PPF canon</h2><p>{BUZZ_RUNTIME_BOUNDARIES.creativeAuthority}</p></article>
      </section> : null}

      {!configured ? null : !project ? (
        <section className={styles.emptyState}>
          <div><span>No active PPF project</span><h2>Open or create a story project first.</h2><p>Buzz remains optional and creates no story data while no project is open.</p></div>
          <a href="/?workspace=dashboard">Return to Dashboard</a>
        </section>
      ) : (
        <>
          <section className={styles.projectBar}>
            <div><span>Active project</span><h2>{identity.title}</h2><p>{rooms.length ? `${rooms.length} of ${BUZZ_STORY_ROOMS.length} Story Rooms found` : "Load existing rooms or create this project’s private room set."}</p></div>
            <div className={styles.projectActions}>
              <button type="button" onClick={() => void refreshStatus(true)} disabled={busy === "status"}>Refresh connection</button>
              <button type="button" onClick={onOpenSettings}>Buzz settings</button>
              <button type="button" onClick={openBuzz}>Open Buzz community</button>
              <button type="button" onClick={() => void loadRooms()} disabled={!canUseCli || Boolean(busy)}>Load rooms</button>
              <button type="button" title="Create missing rooms" onClick={() => void ensureRooms()} disabled={!canWriteBuzz || Boolean(busy)}>Create PlotPickle rooms</button>
            </div>
          </section>

          <div className={styles.workspaceGrid}>
            <section className={styles.roomRail} aria-label="Project Story Rooms">
              <div className={styles.sectionHeading}><span>Project rooms</span><h2>Writers’ room</h2></div>
              {BUZZ_STORY_ROOMS.map((room) => {
                const connected = rooms.find((item) => item.roomId === room.id);
                return (
                  <button
                    type="button"
                    key={room.id}
                    className={selectedRoomId === room.id ? styles.selectedRoom : undefined}
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      setMessages([]);
                      setSelectedMessageId("");
                      if (connected) void loadMessages(connected);
                    }}
                  >
                    <span>{connected ? "Connected room" : "Planned room"}</span>
                    <b>{room.label}</b>
                    <small>{room.description}</small>
                  </button>
                );
              })}
            </section>

            <section className={styles.conversation} aria-label="Buzz discussion">
              <div className={styles.sectionHeading}>
                <span>{selectedRoom ? "Signed Buzz discussion" : "Discussion bridge"}</span>
                <h2>{BUZZ_STORY_ROOMS.find((room) => room.id === selectedRoomId)?.label}</h2>
                <p>{selectedRoom ? `${selectedRoom.channel.name} · ${messages.length} loaded message${messages.length === 1 ? "" : "s"}` : "Connect the CLI to read the room here, or paste a relevant excerpt below without changing the PPF."}</p>
              </div>

              {selectedRoom && canUseCli ? (
                <div className={styles.messageList}>
                  {messages.length ? messages.map((message) => (
                    <button
                      type="button"
                      key={message.id}
                      className={selectedMessageId === message.id ? styles.selectedMessage : undefined}
                      onClick={() => {
                        setSelectedMessageId(message.id);
                        setManualExcerpt("");
                      }}
                    >
                      <span><b>{message.author || "Buzz member"}</b><small>{shortDate(message.createdAt)}</small></span>
                      <p>{message.content}</p>
                    </button>
                  )) : <p className={styles.muted}>No messages loaded. Select this room again or use Load rooms.</p>}
                </div>
              ) : <p className={styles.muted}>The PlotPickle project remains fully usable without a live Buzz connection.</p>}

              <label className={styles.field}><span>Paste or summarize the selected discussion</span><textarea value={manualExcerpt} onChange={(event) => { setManualExcerpt(event.target.value); setSelectedMessageId(""); }} placeholder="Paste the specific story discussion that supports a proposed change." rows={5} /></label>

              {selectedRoom ? (
                <div className={styles.sendRow}>
                  <label className={styles.field}><span>Send a signed message</span><textarea value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Add to this Story Room…" rows={3} /></label>
                  <button type="button" onClick={() => void sendMessage()} disabled={!canWriteBuzz || !messageDraft.trim() || busy === "send"}>Send to Buzz</button>
                </div>
              ) : null}
            </section>
          </div>

          <section className={styles.proposalBuilder} aria-labelledby="buzz-proposal-builder-title">
            <div className={styles.sectionHeading}>
              <span>Discussion → proposal</span>
              <h2 id="buzz-proposal-builder-title">Prepare an exact PPF change for human review.</h2>
              <p>Creating a proposal does not alter the story. The original value is locked into the proposal so later conflicts cannot be overwritten silently.</p>
            </div>
            <div className={styles.proposalGrid}>
              <label className={styles.field}>
                <span>Story target</span>
                <select value={selectedTarget?.id || ""} onChange={(event) => { setTargetId(event.target.value); setFieldPath(""); setProposedValue(""); }}>
                  {targets.map((target) => <option key={`${target.kind}-${target.id}`} value={target.id}>{target.label}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>PPF field</span>
                <select value={selectedField ? jsonPath(selectedField.path) : ""} onChange={(event) => { setFieldPath(event.target.value); const next = selectedTarget?.fields.find((item) => jsonPath(item.path) === event.target.value); setProposedValue(next?.value || ""); }}>
                  {(selectedTarget?.fields ?? []).map((item) => <option key={jsonPath(item.path)} value={jsonPath(item.path)}>{item.label}</option>)}
                </select>
              </label>
              <label className={styles.field}><span>Proposal title</span><input value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} placeholder={`Revise ${selectedField?.label || "story field"}`} /></label>
              <label className={styles.field}><span>Why this should change</span><input value={proposalRationale} onChange={(event) => setProposalRationale(event.target.value)} placeholder="The decision or story reason supported by the discussion" /></label>
            </div>
            <div className={styles.compareGrid}>
              <label className={styles.field}><span>Current PPF value</span><textarea readOnly value={selectedField?.value || ""} rows={7} /></label>
              <label className={styles.field}><span>Proposed PPF value</span><textarea value={proposedValue} onChange={(event) => setProposedValue(event.target.value)} rows={7} /></label>
            </div>
            <button type="button" className={styles.primaryAction} onClick={createProposal}>Create reviewable proposal</button>
          </section>

          <section className={styles.reviewQueue} aria-labelledby="buzz-review-queue-title">
            <div className={styles.sectionHeading}>
              <span>Human approval gate</span>
              <h2 id="buzz-review-queue-title">{openProposals.length} open Buzz proposal{openProposals.length === 1 ? "" : "s"}</h2>
              <p>Approval writes one exact story field. Declining keeps the PPF unchanged. Every decision retains the Buzz source reference.</p>
            </div>
            <div className={styles.decisionFields}>
              <label className={styles.field}><span>Decision by</span><input value={decidedBy} onChange={(event) => setDecidedBy(event.target.value)} /></label>
              <label className={styles.field}><span>Decision note</span><input value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Optional approval or rejection reason" /></label>
            </div>
            <div className={styles.proposalList}>
              {projectProposals.length ? projectProposals.map((proposal) => (
                <article key={proposal.id} className={styles.proposalCard}>
                  <header><span>{proposal.status}</span><h3>{proposal.title}</h3><small>{proposal.targetLabel} · {proposal.fieldLabel} · {shortDate(proposal.createdAt)}</small></header>
                  <div className={styles.proposalComparison}><div><b>Current when proposed</b><p>{proposal.originalValue || "—"}</p></div><div><b>Proposed</b><p>{proposal.proposedValue}</p></div></div>
                  {proposal.rationale ? <p><b>Reason:</b> {proposal.rationale}</p> : null}
                  <blockquote><b>{proposal.source.roomName}</b><span>{proposal.source.excerpt}</span><small>{proposal.source.author || "Unknown author"} · message {proposal.source.messageId}</small></blockquote>
                  {proposal.status === "open" ? (
                    <div className={styles.proposalActions}>
                      <button type="button" onClick={() => approveProposal(proposal)}>Approve into PPF</button>
                      <button type="button" className={styles.declineAction} onClick={() => declineProposal(proposal)}>Decline</button>
                    </div>
                  ) : <p className={styles.decisionRecord}>Decision: {proposal.status} by {proposal.decidedBy || "Project owner"} on {shortDate(proposal.decidedAt)}{proposal.decisionNote ? ` · ${proposal.decisionNote}` : ""}</p>}
                </article>
              )) : <p className={styles.muted}>No Buzz proposals have been created for this project.</p>}
            </div>
          </section>
        </>
      )}

      {configured ? <section className={styles.runtimeBoundary}>
        <div><span>Managed local Buzz</span><h2>{status?.managed.message || "Loading managed runtime status…"}</h2><p>The managed relay uses the verified Docker Compose bundle. Native Buzz binaries are not embedded in PlotPickle.</p></div>
        <div><b>{status?.managed.lifecycle || "checking"}</b><small>{status?.managed.bundle.sourceTag ? `${status.managed.bundle.sourceTag} · ${status.managed.bundle.sourceRevision}` : "No verified bundle status"}</small></div>
      </section> : null}

      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    </div>
  );
}
