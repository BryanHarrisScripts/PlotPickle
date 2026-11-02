"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authenticatedProfileFetch } from "../../../core/auth/profile-request-browser";
import TwoWayConversationTest from "../settings/tunnel/two-way-conversation-panel";
import styles from "./collab-entry-workspace.module.css";

type SupervisorObservation = {
  readonly state: string;
  readonly sourceHead: string | null;
  readonly workerProcessVerified: boolean;
  readonly autonomousCodingVerified: boolean;
  readonly automaticMergeEnabled: boolean;
};
type ConversationObservation = {
  readonly code: string;
  readonly questionId?: string;
  readonly sourceHead?: string;
  readonly plotpickleToChatgpt?: "VERIFIED" | "UNPROVEN";
  readonly chatgptToPlotpickle?: "VERIFIED" | "UNPROVEN";
};
type MissionObservation = {
  readonly code: string;
  readonly missionId?: string;
  readonly goal?: string;
  readonly sourceHead?: string;
  readonly state?: string;
  readonly specialist?: string;
  readonly expiresAt?: number;
  readonly delegated?: boolean;
  readonly releaseAuthorized?: boolean;
};
const STAGES = ["Build", "Test", "Fix", "Verify", "Merge"] as const;
const SUPERVISOR_ENDPOINT = "/api/factory/supervisor";
const CONVERSATION_ENDPOINT = "/api/factory/conversation";
const MISSION_ENDPOINT = "/api/factory/mission";

export default function CollabEntryWorkspace({ projectTitle }: { readonly projectTitle: string }) {
  const [supervisor, setSupervisor] = useState<SupervisorObservation | null>(null);
  const [conversation, setConversation] = useState<ConversationObservation | null>(null);
  const [status, setStatus] = useState("Checking the authenticated local Factory…");
  const [mission, setMission] = useState<MissionObservation | null>(null);
  const [missionGoal, setMissionGoal] = useState("");
  const [missionSaving, setMissionSaving] = useState(false);
  const [missionError, setMissionError] = useState("");
  const refreshEvidence = useCallback(async () => {
    try {
      const [supervisorReply, conversationReply] = await Promise.all([
        authenticatedProfileFetch(SUPERVISOR_ENDPOINT, { cache: "no-store" }),
        authenticatedProfileFetch(CONVERSATION_ENDPOINT, { cache: "no-store" }),
      ]);
      if (!supervisorReply.ok || !conversationReply.ok) throw Error("PROFILE_OR_FACTORY_UNAVAILABLE");
      const nextSupervisor = await supervisorReply.json() as SupervisorObservation;
      const nextConversation = await conversationReply.json() as ConversationObservation;
      if (typeof nextSupervisor?.state !== "string" ||
          typeof nextSupervisor?.sourceHead !== "string" ||
          typeof nextConversation?.code !== "string")
        throw Error("FACTORY_EVIDENCE_UNVERIFIED");
      setSupervisor(nextSupervisor);
      setConversation(nextConversation);
      setStatus("");
    } catch {
      // Fail closed: neither a stale success nor a browser-local label
      // may stand in for the authenticated Windows receipt.
      setSupervisor(null);
      setConversation(null);
      setStatus("Factory evidence unavailable. Unlock your local profile and check the existing Windows service.");
    }
  }, []);
  // Mission drafts are source-bound, profile-scoped records. Neither this
  // read nor a draft POST is an agent grant or a background job.
  const readMission = useCallback(async (): Promise<MissionObservation | null> => {
    const response = await authenticatedProfileFetch(MISSION_ENDPOINT, { cache: "no-store" });
    const body = await response.json() as MissionObservation;
    if (!response.ok || typeof body?.code !== "string") {
      throw Error(body?.code || "MISSION_READ_UNAVAILABLE");
    }
    if (body.code === "MISSION_NONE") return null;
    if (!["MISSION_DRAFT", "MISSION_EXPIRED", "MISSION_SOURCE_REVIEW_REQUIRED"].includes(body.code) ||
        typeof body.missionId !== "string" || typeof body.goal !== "string" ||
        typeof body.sourceHead !== "string" || body.state !== "DRAFT_NOT_DELEGATED" ||
        body.specialist !== "NOT_ASSIGNED" || body.delegated !== false ||
        body.releaseAuthorized !== false) {
      throw Error("MISSION_EVIDENCE_UNVERIFIED");
    }
    return body;
  }, []);
  const refreshMission = useCallback(async () => {
    try {
      setMission(await readMission());
      setMissionError("");
    } catch {
      setMission(null);
      setMissionError("Mission evidence unavailable. Unlock your profile and recheck the local source.");
    }
  }, [readMission]);
  useEffect(() => { void refreshEvidence(); void refreshMission(); }, [refreshEvidence, refreshMission]);

  async function saveMissionDraft() {
    const goal = missionGoal.trim();
    if (missionSaving || goal.length < 5 || goal.length > 180) return;
    setMissionSaving(true);
    setMissionError("");
    try {
      const reply = await authenticatedProfileFetch(MISSION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-draft", goal }),
      });
      const created = await reply.json() as MissionObservation;
      if (!reply.ok || created?.code !== "MISSION_DRAFT" ||
          typeof created.missionId !== "string" || created.delegated !== false) {
        throw Error("MISSION_CREATE_NOT_VERIFIED");
      }
      // Never claim persistence from an HTTP 201 alone: require a separate
      // authenticated readback of this exact mission on the current source.
      const stored = await readMission();
      if (stored?.code !== "MISSION_DRAFT" || stored.missionId !== created.missionId ||
          stored.sourceHead !== created.sourceHead || stored.goal !== goal) {
        throw Error("MISSION_READBACK_MISMATCH");
      }
      setMission(stored);
      setMissionGoal("");
    } catch {
      setMission(null);
      setMissionError("Draft was not independently read back. Recheck before creating another.");
    } finally {
      setMissionSaving(false);
    }
  }

  const sourceBound = !!(supervisor?.sourceHead && conversation?.sourceHead &&
    supervisor.sourceHead === conversation.sourceHead);
  const missionCurrent = mission?.code === "MISSION_DRAFT" &&
    mission.sourceHead === supervisor?.sourceHead;
  const exchangeVerified = !!(sourceBound && conversation?.code === "ANSWERED" &&
    conversation.plotpickleToChatgpt === "VERIFIED" &&
    conversation.chatgptToPlotpickle === "VERIFIED");

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Connect / Play · Collab</p>
        <h1>Formal collaboration without a second project.</h1>
        <p>
          Collab remains the launch point for formal shared work. During the sitemap migration, each action below routes to its current canonical owner rather than reviving the legacy localStorage collaboration workspace beside the profile-owned PPF.
        </p>
      </header>

      <section className={styles.truth}>
        <h2 className={styles.sectionTitle}>Collaboration context</h2>
        <dl className={styles.truthList}>
          <div><dt>Current project</dt><dd>{projectTitle || "Untitled Story"}</dd></div>
          <div><dt>Durable authority</dt><dd>Profile-owned PlotPickle Project / PPF</dd></div>
        </dl>
      </section>

      <section className={styles.agentWorkspace} aria-label="Elara Agent Workspace" data-agent-workspace="source-bound-first-slice">
        <div className={styles.agentHeading}>
          <div>
            <p className={styles.kicker}>HUMAN / ELARA / SPECIALISTS</p>
            <h2 className={styles.sectionTitle}>Elara's Agent Workspace</h2>
            <p>Share one traceable objective, inspect the real Factory evidence and continue talking while work is delegated through approved tools. This first slice uses the existing durable conversation test; it does not issue specialist work orders.</p>
          </div>
          <button type="button" className={styles.action} onClick={() => { void refreshEvidence(); void refreshMission(); }}>Refresh evidence</button>
        </div>
        <dl className={styles.agentFacts}>
          <div><dt>Current objective</dt><dd>Verify an authenticated, source-bound exchange before enabling delegation</dd></div>
          <div><dt>Local Factory source</dt><dd><code>{supervisor?.sourceHead || "UNVERIFIED"}</code></dd></div>
          <div><dt>Supervisor</dt><dd>{supervisor?.state || "UNAVAILABLE"}{supervisor?.state === "RUNNING" ? " · heartbeat, not worker proof" : ""}</dd></div>
          <div><dt>Durable exchange</dt><dd>{exchangeVerified ? "REPLY SAVED AND READ BACK" : conversation?.code === "PENDING" && sourceBound ? "AWAITING CONNECTED CLIENT" : "UNVERIFIED"}</dd></div>
          <div><dt>Evidence reference</dt><dd><code>{sourceBound ? conversation?.questionId || "NONE" : "UNVERIFIED"}</code></dd></div>
          <div><dt>Next action</dt><dd>{exchangeVerified ? "Review a separate, authorized specialist delegation" : "Complete a two-way conversation receipt"}</dd></div>
        </dl>
        {status ? <p role="status" className={styles.agentNotice}>{status}</p> : null}
        {supervisor && !sourceBound ? <p role="alert" className={styles.agentNotice}>Conversation and supervisor source identity are not jointly verified. No mission completion is claimed.</p> : null}
        <section className={styles.missionPanel} aria-label="Durable mission draft">
          <h3 className={styles.sectionTitle}>Mission journal</h3>
          <p>Save a Human-approved objective against the current source. A draft is not a delegation, model call, grant or release.</p>
          {mission ? <dl className={styles.missionFacts}>
            <div><dt>Goal</dt><dd>{mission.goal}</dd></div>
            <div><dt>Record</dt><dd><code>{mission.missionId}</code></dd></div>
            <div><dt>Status</dt><dd>{mission.code} · {mission.state} · {mission.specialist}</dd></div>
            <div><dt>Source</dt><dd><code>{mission.sourceHead}</code></dd></div>
          </dl> : <p>No verified mission draft is available for this profile.</p>}
          {mission?.code === "MISSION_SOURCE_REVIEW_REQUIRED" ?
            <p role="alert" className={styles.agentNotice}>The saved mission belongs to another source revision. No work is authorized for the current revision.</p> : null}
          <form className={styles.missionForm} onSubmit={(event) => { event.preventDefault(); void saveMissionDraft(); }}>
            <label htmlFor="elara-mission-goal">Next objective</label>
            <input id="elara-mission-goal" type="text" minLength={5} maxLength={180}
              required value={missionGoal} onChange={(event) => setMissionGoal(event.target.value)}
              placeholder="Describe one bounded goal for Elara to prepare"
              disabled={missionSaving || missionCurrent} />
            <button className={styles.action} type="submit"
              disabled={missionSaving || missionCurrent || missionGoal.trim().length < 5}>
              {missionSaving ? "Verifying readback…" : missionCurrent ? "Current draft saved" : "Save mission draft"}
            </button>
          </form>
          {missionError ? <p role="alert" className={styles.agentNotice}>{missionError}</p> : null}
          <p>Specialist execution remains unavailable until an independently authorized work order and a real reply are verified.</p>
        </section>
        <div className={styles.participants} aria-label="Collaboration participants">
          <div><strong>Human owner</strong><span>{supervisor ? "Local profile authenticated for observation" : "Identity not verified here"}</span></div>
          <div><strong>Elara / connected assistant</strong><span>{exchangeVerified ? "Durable reply observed; not a live-presence claim" : "Reply not verified"}</span></div>
          <div><strong>Specialist agent</strong><span>NOT ASSIGNED · No delegation grant</span></div>
        </div>
        <h3 className={styles.sectionTitle}>Team 1 · Build → Test → Fix → Verify → Merge</h3>
        <ol className={styles.teamRoles} aria-label="Five logical engineering responsibilities">
          {STAGES.map((stage, index) => (
            <li key={stage}>
              <strong>1.{index + 1} {stage}</strong>
              <span>{stage === "Merge" ? "NOT AUTHORIZED" : "NOT VERIFIED"}</span>
            </li>
          ))}
        </ol>
        <p className={styles.agentNotice}>Teams 2–5 are planned, not installed. A Factory heartbeat or an answered conversation never proves a coding, independent review or merge cycle.</p>
        <TwoWayConversationTest />
      </section>

      <section className={styles.destinations}>
        <h2 className={styles.sectionTitle}>Continue collaborating</h2>
        <div className={styles.grid}>
          <article className={styles.card}>
            <small>Discussion and rooms</small>
            <h3>Community / BUZZ</h3>
            <p>Use public conversations, rooms, presence and agent discovery without giving BUZZ ownership of project or STORY state.</p>
            <Link className={styles.action} href="/?workspace=community">Open Community</Link>
          </article>

          <article className={styles.card}>
            <small>Review and decisions</small>
            <h3>Feedback</h3>
            <p>Keep notes, proposals, review evidence and human approval decisions in the existing review owner.</p>
            <Link className={styles.action} href="/feedback">Open Feedback</Link>
          </article>

          <article className={styles.card}>
            <small>Revision history and proposals</small>
            <h3>Native Git</h3>
            <p>Inspect revisions, branches, conflicts and repository proposals without creating another story representation.</p>
            <Link className={styles.action} href="/git">Open Native Git</Link>
          </article>

          <article className={styles.card}>
            <small>Connections and meetings</small>
            <h3>Settings</h3>
            <p>Configure GitHub, Google, BUZZ and other optional services in Settings. Configuration stays outside creative content.</p>
            <Link className={styles.action} href="/?workspace=settings">Open Settings</Link>
          </article>
        </div>
      </section>

      <aside className={styles.note}>
        The historical Collab component still exists, but it expects the retired rich local project model. This entry intentionally does not mount that component until formal collaboration is reconnected to the current PPF authority through a dedicated compatibility boundary.
      </aside>
    </main>
  );
}
