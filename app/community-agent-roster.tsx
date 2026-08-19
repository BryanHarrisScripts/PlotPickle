"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FOUNDATION_PROJECT_STORAGE_KEY } from "../core/contracts/foundation-plan";
import { normalizeFoundationProject } from "../core/project/project";
import {
  buildCommunityAgentRoster,
  type AgentTrace,
  type BuzzNativeAgentState,
  type WritingAssistantStatus,
} from "../lib/community-agent-roster";
import ResponsibilityRunActivity from "./responsibility-run-activity";
import styles from "./community-agent-roster.module.css";

type TracePayload = {
  readonly ok?: boolean;
  readonly traces?: AgentTrace[];
};

type BuzzRosterPayload = {
  readonly ok?: boolean;
  readonly identityVerified?: boolean;
  readonly agents?: BuzzNativeAgentState[];
  readonly message?: string;
};

type SpecialistId = "critics-circle";
type SpecialistReply = {
  readonly profileId: SpecialistId;
  readonly displayName: string;
  readonly room: { readonly id: string; readonly name: string };
  readonly reply: string;
  readonly runtime: string;
  readonly runtimeProvider: string;
  readonly model: string;
  readonly modelRole: string;
  readonly contextSummary: string;
  readonly projectContextShared: boolean;
  readonly ppfChanged: false;
  readonly buzzHistoryWritten: true;
};

type JsonMessage = { readonly message?: string };

const SPECIALISTS = new Set<SpecialistId>(["critics-circle"]);
const PRIVATE_PROJECT_AGENT_IDS = new Set(["marquee-director"]);

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const body = await response.json() as T & JsonMessage;
  if (!response.ok) throw new Error(body.message || `Status request returned ${response.status}.`);
  return body;
}

async function sendJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = await response.json() as T & JsonMessage;
  if (!response.ok) throw new Error(value.message || `Specialist request returned ${response.status}.`);
  return value;
}

function displayTime(value: string) {
  if (!value) return "No run recorded this session";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buzzIdentityLabel(agentId: string, buzzPresence: string, nativeAgents: readonly BuzzNativeAgentState[]) {
  const identity = nativeAgents.find((item) => item.actorId === agentId);
  if (identity?.created && identity.verified && identity.ownedByMe) {
    const presence = identity.presence.trim().toLowerCase() || "offline";
    return `Visible in BUZZ · ${presence}`;
  }
  if (identity?.lookupError) return "BUZZ identity status unavailable";
  if (buzzPresence === "native-draft") return "Needs owner approval in BUZZ";
  if (buzzPresence === "mirrored") return "Mastra agent · BUZZ identity not created";
  return "Operational events only";
}

function readableList(values: readonly string[]) {
  return values.length ? values.map((value) => value.replaceAll("-", " ")).join(", ") : "None";
}

function isSpecialist(value: string): value is SpecialistId {
  return SPECIALISTS.has(value as SpecialistId);
}

function activeProjectContext(explicit: unknown) {
  try {
    if (explicit) return normalizeFoundationProject(explicit);
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(FOUNDATION_PROJECT_STORAGE_KEY);
    return raw ? normalizeFoundationProject(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export default function CommunityAgentRoster({ projectContext = null }: { readonly projectContext?: unknown }) {
  const [assistantStatus, setAssistantStatus] = useState<WritingAssistantStatus | null>(null);
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [buzzIdentityVerified, setBuzzIdentityVerified] = useState(false);
  const [nativeAgents, setNativeAgents] = useState<BuzzNativeAgentState[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [specialistDrafts, setSpecialistDrafts] = useState<Record<SpecialistId, string>>({ "critics-circle": "" });
  const [specialistProjectSharing, setSpecialistProjectSharing] = useState<Record<SpecialistId, boolean>>({ "critics-circle": false });
  const [specialistReplies, setSpecialistReplies] = useState<Partial<Record<SpecialistId, SpecialistReply>>>({});
  const [specialistBusy, setSpecialistBusy] = useState<SpecialistId | "">("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const [assistantResult, tracesResult, buzzResult] = await Promise.allSettled([
      readJson<WritingAssistantStatus>("/api/writing-assistant/status"),
      readJson<TracePayload>("/api/writing-assistant/traces"),
      readJson<BuzzRosterPayload>("/api/local-buzz/agent-roster"),
    ]);

    const warnings: string[] = [];
    if (assistantResult.status === "fulfilled") setAssistantStatus(assistantResult.value);
    else {
      setAssistantStatus(null);
      warnings.push("Mastra status unavailable");
    }
    if (tracesResult.status === "fulfilled") setTraces(Array.isArray(tracesResult.value.traces) ? tracesResult.value.traces : []);
    else {
      setTraces([]);
      warnings.push("session activity unavailable");
    }
    if (buzzResult.status === "fulfilled") {
      setBuzzIdentityVerified(buzzResult.value.identityVerified === true);
      setNativeAgents(Array.isArray(buzzResult.value.agents) ? buzzResult.value.agents : []);
      if (buzzResult.value.message && buzzResult.value.agents?.some((agent) => agent.lookupError)) warnings.push(buzzResult.value.message);
    } else {
      setBuzzIdentityVerified(false);
      setNativeAgents([]);
      warnings.push("BUZZ agent identity status unavailable");
    }
    setNotice(warnings.join(" · "));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 7_500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const roster = useMemo(() => buildCommunityAgentRoster({
    assistantStatus,
    traces,
    buzzIdentityVerified,
    nativeAgents,
  }).filter((agent) => !PRIVATE_PROJECT_AGENT_IDS.has(agent.id)), [assistantStatus, traces, buzzIdentityVerified, nativeAgents]);

  const counts = useMemo(() => ({
    active: roster.filter((agent) => agent.state === "working" || agent.state === "online" || agent.state === "away").length,
    onDemand: roster.filter((agent) => agent.state === "on-demand").length,
    parked: roster.filter((agent) => agent.state === "parked").length,
    attention: roster.filter((agent) => ["offline", "needs-approval", "setup-needed", "unavailable"].includes(agent.state)).length,
  }), [roster]);

  async function askSpecialist(id: SpecialistId) {
    const prompt = specialistDrafts[id].trim();
    if (!prompt || specialistBusy) return;
    const shareProjectContext = specialistProjectSharing[id];
    const sharedProjectContext = shareProjectContext ? activeProjectContext(projectContext) : null;
    if (shareProjectContext && !sharedProjectContext) {
      setNotice("Open or load a project before choosing to share active project context with a specialist.");
      return;
    }
    setSpecialistBusy(id);
    setNotice("");
    try {
      const result = await sendJson<SpecialistReply>("/api/local-buzz/specialists/ask", {
        profileId: id,
        prompt,
        shareProjectContext,
        ...(sharedProjectContext ? { projectContext: sharedProjectContext } : {}),
      });
      setSpecialistReplies((current) => ({ ...current, [id]: result }));
      setSpecialistDrafts((current) => ({ ...current, [id]: "" }));
      setNotice(`${result.displayName} replied in ${result.room.name}. The exchange is in BUZZ history and did not change the PPF.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The specialist could not answer this room message.");
    } finally {
      setSpecialistBusy("");
    }
  }

  return (
    <div className={styles.roster}>
      <section className={styles.heading}>
        <div>
          <span>Agents & Stewards</span>
          <h2>Who is here, what they help with, and what PlotPickle allows them to do.</h2>
          <p>Each identity has one host-owned Agent Profile. The profile can request a kind of model, a Skill and safe capabilities, but PlotPickle decides what is actually available. Skills describe procedure; they never grant permission. The writer remains the final authority over creative changes.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void refresh()}>{loading ? "Checking…" : "Refresh status"}</button>
      </section>

      <section className={styles.summary} aria-label="Agent roster summary">
        <div><strong>{counts.active}</strong><span>online or working</span></div>
        <div><strong>{counts.onDemand}</strong><span>on demand</span></div>
        <div><strong>{counts.parked}</strong><span>parked for later</span></div>
        <div><strong>{counts.attention}</strong><span>need setup or attention</span></div>
      </section>

      <section className={styles.legend} aria-label="Agent status meanings">
        <p><strong>Online</strong> means the real runtime reports the role available. <strong>Working</strong> means a run is active now. <strong>On demand</strong> means the service starts only when needed. <strong>Parked</strong> means the role is intentionally inactive. A BUZZ identity is community presence and signed provenance only; it does not give an agent new product, story, developer or GitHub authority.</p>
      </section>

      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <ResponsibilityRunActivity />

      <section className={styles.grid} aria-label="PlotPickle agent roster">
        {roster.map((agent) => {
          const identity = nativeAgents.find((item) => item.actorId === agent.id);
          const visibleInBuzz = Boolean(identity?.created && identity.verified && identity.ownedByMe);
          const specialist = isSpecialist(agent.id) ? agent.id : null;
          const reply = specialist ? specialistReplies[specialist] : null;
          return (
            <article className={styles.card} key={agent.id} data-state={agent.state}>
              <header>
                <div className={styles.identity}>
                  <span className={styles.avatar} aria-label={`${agent.displayName} profile picture`}>{agent.avatarInitials}</span>
                  <div>
                    <strong>{agent.displayName}</strong>
                    <span>{agent.title}</span>
                  </div>
                </div>
                <span className={styles.status} data-state={agent.state}><i aria-hidden="true" />{agent.stateLabel}</span>
              </header>

              <p className={styles.summaryText}>{agent.summary}</p>
              <p className={styles.stateDetail}>{agent.stateDetail}</p>

              <dl>
                <div><dt>Runs in</dt><dd>{agent.runtimeLabel}</dd></div>
                <div><dt>Home room</dt><dd>{agent.homeRoom}</dd></div>
                <div><dt>Role</dt><dd>{agent.roleId || (agent.runtime === "buzz" ? "BUZZ identity" : "Operational service")}</dd></div>
                <div><dt>Model need</dt><dd>{agent.requestedModelRole ? `${agent.requestedModelRole} capability` : "No model required"}</dd></div>
                <div><dt>Active model</dt><dd>{agent.activeModel ? `${agent.activeRuntimeProvider || "runtime"} · ${agent.activeModel}` : "Shown when a run is active or recorded"}</dd></div>
                <div><dt>BUZZ identity</dt><dd>{buzzIdentityLabel(agent.id, agent.buzzPresence, nativeAgents)}</dd></div>
                <div><dt>Last activity</dt><dd>{displayTime(agent.lastActiveAt)}</dd></div>
              </dl>

              <details>
                <summary>Capabilities, memory & boundaries</summary>
                <dl>
                  <div><dt>Skills</dt><dd>{agent.skillUris.length ? agent.skillUris.map((uri) => uri.replace("skill://plotpickle/", "")).join(", ") : "No packaged Skill required"}</dd></div>
                  <div><dt>Requests</dt><dd>{readableList(agent.requestedCapabilities)}</dd></div>
                  <div><dt>Memory scope</dt><dd>{readableList(agent.projectMemoryScope)}</dd></div>
                  <div><dt>May propose</dt><dd>{readableList(agent.proposalScopes)}</dd></div>
                  <div><dt>Cannot do</dt><dd>{readableList(agent.forbiddenCapabilities)}</dd></div>
                  <div><dt>Creative authority</dt><dd>{agent.creativeAuthority.replaceAll("-", " ")}</dd></div>
                </dl>
                <p><strong>Memory policy:</strong> {agent.projectMemoryPolicy}</p>
                <p><strong>Verification:</strong> {agent.verificationContract}</p>
              </details>

              {specialist ? <section className={styles.specialist} aria-label={`${agent.displayName} BUZZ conversation`}>
                <div className={styles.specialistHeading}>
                  <div><strong>Talk in {agent.homeRoom}</strong><span>Private BUZZ room · PlotPickle/Mastra reply</span></div>
                  <small>Project sharing is off by default.</small>
                </div>
                <textarea
                  value={specialistDrafts[specialist]}
                  onChange={(event) => setSpecialistDrafts((current) => ({ ...current, [specialist]: event.target.value }))}
                  maxLength={8_000}
                  rows={4}
                  placeholder="Ask for an independent story, character, pacing or positioning critique…"
                />
                <label className={styles.shareToggle}>
                  <input
                    type="checkbox"
                    checked={specialistProjectSharing[specialist]}
                    onChange={(event) => setSpecialistProjectSharing((current) => ({ ...current, [specialist]: event.target.checked }))}
                  />
                  <span>Share the active project's approved context with this private BUZZ exchange. This may include unpublished story details.</span>
                </label>
                <button
                  type="button"
                  disabled={!specialistDrafts[specialist].trim() || Boolean(specialistBusy) || agent.state === "offline"}
                  onClick={() => void askSpecialist(specialist)}
                >{specialistBusy === specialist ? "Asking…" : `Ask ${agent.displayName}`}</button>
                {reply ? <div className={styles.specialistReply}>
                  <strong>{reply.displayName}</strong>
                  <p>{reply.reply}</p>
                  <small>{reply.runtimeProvider} · {reply.model} · {reply.contextSummary}</small>
                  <small>Written to BUZZ history · PPF unchanged · project context {reply.projectContextShared ? "explicitly shared" : "not shared"}</small>
                </div> : null}
              </section> : null}

              <footer>
                <span>{visibleInBuzz ? "Visible in Buzz Desktop" : agent.buzzPresence === "native-draft" ? "BUZZ-native identity awaiting approval" : agent.buzzPresence === "mirrored" ? "PlotPickle/Mastra agent" : "Guildhall service"}</span>
                {agent.buzzPresence === "mirrored" && !visibleInBuzz ? <small>Buzz Desktop → Agents → + can create the matching community identity when you want it.</small> : null}
                {agent.state === "needs-approval" ? <small>Open Buzz Desktop → Agents to create and approve this steward.</small> : null}
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}
