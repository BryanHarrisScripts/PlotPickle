"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AgentPortrait from "../components/agent-portrait";
import { normalizeFoundationProject } from "../core/project/project";
import { loadFoundationProject } from "../core/storage/foundation-project-browser";
import {
  buildCommunityAgentRoster,
  type AgentTrace,
  type BuzzNativeAgentState,
  type WritingAssistantStatus,
} from "../lib/community-agent-roster";
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
const ROOMS_BY_AGENT: Readonly<Record<string, readonly string[]>> = {
  "sage-brinewick": ["Great Hall", "Story Workshop", "Wyrmwood"],
  "tamsin-hearthquill": ["Story Workshop"],
  "master-oaken-vague": ["Wyrmwood"],
  "rowan-scalequill": ["Wyrmwood"],
  "quillan-reedcloak": ["Story Workshop", "Marquee"],
  "elowen-mapweaver": ["Story Workshop"],
  "mira-threadmere": ["Story Workshop", "Marquee"],
  "marquee-director": ["Marquee"],
  "critics-circle": ["Story Workshop"],
  "merrin-bellwarden": ["Great Hall"],
  "orin-ledgerbark": ["Great Hall"],
  "fen-copperwind": ["Great Hall when engineering status is relevant"],
};

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
  if (identity?.official) {
    if (identity.lookupError) return "Official BUZZ identity status unavailable";
    if (!identity.identityConfigured) return "Official BUZZ identity · Admin provisioning pending";
    if (identity.created && identity.verified) {
      const presence = identity.presence.trim().toLowerCase() || "offline";
      return `Official PlotPickle Agent · ${presence}`;
    }
    return "Official BUZZ identity not verified";
  }
  if (identity?.created && identity.verified && identity.ownedByMe) {
    const presence = identity.presence.trim().toLowerCase() || "offline";
    return `Visible in BUZZ · ${presence}`;
  }
  if (identity?.lookupError) return "BUZZ identity status unavailable";
  if (buzzPresence === "native-draft") return "Needs owner approval in BUZZ";
  if (buzzPresence === "mirrored") return "PlotPickle Agent · official signer not active";
  return "Local operational role";
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
    return loadFoundationProject();
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
    else { setAssistantStatus(null); warnings.push("Agent runtime status unavailable"); }
    if (tracesResult.status === "fulfilled") setTraces(Array.isArray(tracesResult.value.traces) ? tracesResult.value.traces : []);
    else { setTraces([]); warnings.push("recent Agent activity unavailable"); }
    if (buzzResult.status === "fulfilled") {
      setBuzzIdentityVerified(buzzResult.value.identityVerified === true);
      setNativeAgents(Array.isArray(buzzResult.value.agents) ? buzzResult.value.agents : []);
      if (buzzResult.value.message && buzzResult.value.agents?.some((agent) => agent.lookupError)) warnings.push(buzzResult.value.message);
    } else {
      setBuzzIdentityVerified(false);
      setNativeAgents([]);
      warnings.push("BUZZ Agent identity status unavailable");
    }
    setNotice(warnings.join(" · "));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial external runtime synchronization
    void refresh();
    const timer = window.setInterval(() => void refresh(), 7_500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const roster = useMemo(() => buildCommunityAgentRoster({
    assistantStatus,
    traces,
    buzzIdentityVerified,
    nativeAgents,
  }).filter((agent) => Boolean(agent.publicBio && agent.avatarRef)), [assistantStatus, traces, buzzIdentityVerified, nativeAgents]);

  async function askSpecialist(id: SpecialistId) {
    const prompt = specialistDrafts[id].trim();
    if (!prompt || specialistBusy) return;
    const shareProjectContext = specialistProjectSharing[id];
    const sharedProjectContext = shareProjectContext ? activeProjectContext(projectContext) : null;
    if (shareProjectContext && !sharedProjectContext) {
      setNotice("Open or load a project before sharing active project context with Critics' Circle.");
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
      setNotice(`${result.displayName} replied. PPF unchanged.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Critics' Circle could not answer this message.");
    } finally {
      setSpecialistBusy("");
    }
  }

  return (
    <div className={styles.roster}>
      <section className={styles.heading}>
        <div>
          <span>Official PlotPicklePlayhouse Agents</span>
          <h2>Meet the helpers you can encounter around the Community.</h2>
          <p>Each Agent has a distinct job and public identity. Rooms are organized around your goal, so several Agents may help in the same room. Your BUZZ account always remains your Human identity.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void refresh()}>{loading ? "Checking…" : "Refresh"}</button>
      </section>

      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <section className={styles.grid} aria-label="PlotPickle agent roster">
        {roster.map((agent) => {
          const identity = nativeAgents.find((item) => item.actorId === agent.id);
          const officialIdentity = identity?.official === true;
          const visibleInBuzz = Boolean(identity?.created && identity.verified && (officialIdentity || identity.ownedByMe));
          const specialist = isSpecialist(agent.id) ? agent.id : null;
          const reply = specialist ? specialistReplies[specialist] : null;
          const rooms = ROOMS_BY_AGENT[agent.id] ?? [agent.homeRoom];
          return (
            <article className={styles.card} key={agent.id} data-state={agent.state}>
              <header>
                <div className={styles.identity}>
                  <AgentPortrait id={agent.id} alt={`${agent.displayName} profile picture`} size={72} />
                  <div>
                    <strong>{agent.displayName}</strong>
                    <span>{agent.title}</span>
                  </div>
                </div>
                <span className={styles.status} data-state={agent.state}><i aria-hidden="true" />{agent.stateLabel}</span>
              </header>

              <p className={styles.summaryText}>{agent.publicBio || agent.summary}</p>
              <p className={styles.stateDetail}><strong>Helps in:</strong> {rooms.join(" · ")}</p>

              {specialist ? <section className={styles.specialist} aria-label={`${agent.displayName} BUZZ conversation`}>
                <div className={styles.specialistHeading}>
                  <div><strong>Ask Critics&apos; Circle</strong><span>Private BUZZ exchange</span></div>
                  <small>Project sharing is off by default.</small>
                </div>
                <textarea
                  value={specialistDrafts[specialist]}
                  onChange={(event) => setSpecialistDrafts((current) => ({ ...current, [specialist]: event.target.value }))}
                  maxLength={8_000}
                  rows={3}
                  placeholder="Ask for an independent story, character, pacing or positioning critique…"
                />
                <label className={styles.shareToggle}>
                  <input
                    type="checkbox"
                    checked={specialistProjectSharing[specialist]}
                    onChange={(event) => setSpecialistProjectSharing((current) => ({ ...current, [specialist]: event.target.checked }))}
                  />
                  <span>Share the active project&apos;s approved context with this private exchange.</span>
                </label>
                <button type="button" disabled={!specialistDrafts[specialist].trim() || Boolean(specialistBusy) || agent.state === "offline"} onClick={() => void askSpecialist(specialist)}>{specialistBusy === specialist ? "Asking…" : "Ask Critics' Circle"}</button>
                {reply ? <div className={styles.specialistReply}><strong>{reply.displayName}</strong><p>{reply.reply}</p><small>BUZZ history · PPF unchanged · project context {reply.projectContextShared ? "shared" : "not shared"}</small></div> : null}
              </section> : null}

              <details>
                <summary>Technical details</summary>
                <dl>
                  <div><dt>Runtime</dt><dd>{agent.runtimeLabel}</dd></div>
                  <div><dt>Role</dt><dd>{agent.roleId || "Community Agent"}</dd></div>
                  <div><dt>Model need</dt><dd>{agent.requestedModelRole ? `${agent.requestedModelRole} capability` : "No model required"}</dd></div>
                  <div><dt>Active model</dt><dd>{agent.activeModel ? `${agent.activeRuntimeProvider || "runtime"} · ${agent.activeModel}` : "Shown only when active"}</dd></div>
                  <div><dt>BUZZ identity</dt><dd>{buzzIdentityLabel(agent.id, agent.buzzPresence, nativeAgents)}</dd></div>
                  <div><dt>Last activity</dt><dd>{displayTime(agent.lastActiveAt)}</dd></div>
                  <div><dt>Skills</dt><dd>{agent.skillUris.length ? agent.skillUris.map((uri) => uri.replace("skill://plotpickle/", "")).join(", ") : "None"}</dd></div>
                  <div><dt>Requests</dt><dd>{readableList(agent.requestedCapabilities)}</dd></div>
                  <div><dt>Memory scope</dt><dd>{readableList(agent.projectMemoryScope)}</dd></div>
                  <div><dt>May propose</dt><dd>{readableList(agent.proposalScopes)}</dd></div>
                  <div><dt>Cannot do</dt><dd>{readableList(agent.forbiddenCapabilities)}</dd></div>
                </dl>
                <p><strong>Memory policy:</strong> {agent.projectMemoryPolicy}</p>
                <p><strong>Verification:</strong> {agent.verificationContract}</p>
                <p><strong>Identity boundary:</strong> The connected Human signer is never an Agent signer. Official PlotPickle Agent private signers stay with PlotPickle Admin outside the distributed app.</p>
              </details>

              <footer>
                <span>{visibleInBuzz ? "Official BUZZ identity available" : officialIdentity ? "Official BUZZ identity awaiting provisioning" : "PlotPickle Agent"}</span>
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}
