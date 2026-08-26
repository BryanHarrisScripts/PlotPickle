"use client";

import { useEffect, useState } from "react";
import AgentPortrait from "../components/agent-portrait";
import { authenticatedProfileFetch } from "../core/auth/profile-request-browser";
import { agentProfileById, type AgentProfile } from "../lib/agents/agent-profiles";
import { PLOTPICKLE_RECOMMENDED_BUZZ_CONFIGURATION } from "../lib/buzz/plotpickle-agent-configuration";
import { STORY_PICKLE_PROFILE_IDS } from "../lib/buzz/story-pickle-agents";
import { PLOTPICKLE_COMMUNITY_EXTENSIONS } from "../plugins/plotpickle-playhouse";
import styles from "./settings-helper-directory.module.css";

type StoryPickleDownload = {
  readonly profileId: string;
  readonly fileName: string;
  readonly available: boolean;
  readonly status: string;
  readonly downloadUrl: string | null;
};

type StoryPickleDownloadStatus = {
  readonly individuals: readonly StoryPickleDownload[];
  readonly bundle: {
    readonly fileName: string;
    readonly available: boolean;
    readonly status: string;
    readonly downloadUrl: string | null;
  };
};

type BuzzAgentBindingStatus = {
  readonly bindings?: Readonly<Record<string, string>>;
  readonly profileId?: string;
  readonly pubkey?: string;
  readonly message?: string;
};

type BuzzAgentReadback = {
  readonly actorId: string;
  readonly created: boolean;
  readonly verified: boolean;
  readonly identityConfigured: boolean;
  readonly pubkey: string;
  readonly presence: string;
  readonly lookupError: boolean;
};

type BuzzAgentReadbackStatus = {
  readonly ok?: boolean;
  readonly identityVerified?: boolean;
  readonly agents?: readonly BuzzAgentReadback[];
  readonly message?: string;
};

const STORY_PICKLE_IDS = new Set<string>(STORY_PICKLE_PROFILE_IDS);
const NOSTR_PUBLIC_KEY = /^[a-f0-9]{64}$/i;

function cannotDo(profile: AgentProfile) {
  if (STORY_PICKLE_IDS.has(profile.id)) return `${profile.displayName} can use only story material you supply in its BUZZ conversation; it cannot read PlotPickle projects, memory or canon, and every suggestion remains yours to accept.`;
  if (profile.id === "sage-brinewick") return "Sage can advise and propose, but cannot silently change accepted story canon.";
  if (profile.forbiddenCapabilities.includes("merge-authority")) return `${profile.displayName} cannot merge code or change repository state.`;
  if (profile.forbiddenCapabilities.includes("game-state-write")) return `${profile.displayName} cannot change Wyrmwood state, progress or rewards.`;
  if (profile.forbiddenCapabilities.includes("external-publish")) return `${profile.displayName} cannot publish anything outside PlotPickle for you.`;
  if (["proposal-only", "advisory-only", "scenario-proposal-only"].includes(profile.creativeAuthority)) {
    return `${profile.displayName} can recommend options, but cannot make a creative change final without your approval.`;
  }
  if (["observer-only", "evaluator-only", "synthetic-observer-only"].includes(profile.creativeAuthority)) {
    return `${profile.displayName} can observe or evaluate, but cannot turn that finding into a story or product change on its own.`;
  }
  return `${profile.displayName} cannot override deterministic gates or the writer's final creative decisions.`;
}

function roomLabels(roomIds: readonly string[]) {
  const roomById = new Map(PLOTPICKLE_COMMUNITY_EXTENSIONS.rooms.map((room) => [room.id, room.label]));
  return roomIds.map((roomId) => roomById.get(roomId) ?? roomId).join(" · ");
}

function requestedHelperId() {
  if (typeof window === "undefined") return "";
  return new URL(window.location.href).searchParams.get("helper")?.trim() || "";
}

type HelperAgent = (typeof PLOTPICKLE_COMMUNITY_EXTENSIONS.agents)[number];

function PlotPickleAgentDefaults() {
  const { globalDefaults, authority } = PLOTPICKLE_RECOMMENDED_BUZZ_CONFIGURATION;
  return (
    <section className={styles.defaults} aria-labelledby="plotpickle-agent-defaults-title">
      <div>
        <p className={styles.eyebrow}>PlotPickle Agent Defaults</p>
        <h3 id="plotpickle-agent-defaults-title">One safe starting point for every official Helper.</h3>
        <p>{globalDefaults.runtime.label} · {globalDefaults.provider.label} · {globalDefaults.model} · reasoning {globalDefaults.reasoningLabel.toLowerCase()} · auto-restart</p>
      </div>
      <dl>
        <div><dt>Creative truth</dt><dd>{authority.creativeTruth}</dd></div>
        <div><dt>Conversation record</dt><dd>{authority.conversationRecord}</dd></div>
        <div><dt>Agent memory</dt><dd>{globalDefaults.memoryLabel}</dd></div>
        <div><dt>Private keys</dt><dd>Remain entirely inside {authority.privateKeyCustody}</dd></div>
      </dl>
    </section>
  );
}

function readbackLabel(agent: BuzzAgentReadback | undefined, configuredPubkey: string, readAttempted: boolean) {
  if (!configuredPubkey) return { tone: "missing", label: "Missing" } as const;
  if (!readAttempted) return { tone: "pending", label: "Not checked" } as const;
  if (!agent || agent.lookupError) return { tone: "unavailable", label: "Unavailable" } as const;
  if (!agent.created || !agent.verified) return { tone: "pending", label: "Not verified" } as const;
  if (agent.pubkey.toLowerCase() !== configuredPubkey.toLowerCase()) return { tone: "mismatch", label: "Mismatch" } as const;
  return { tone: "verified", label: "Verified" } as const;
}

function BuzzConfigurationCard({
  agent,
  buzzPubkey,
  readback,
  readAttempted,
  readBusy,
  onReadFromBuzz,
}: {
  readonly agent: HelperAgent;
  readonly buzzPubkey: string;
  readonly readback?: BuzzAgentReadback;
  readonly readAttempted: boolean;
  readonly readBusy: boolean;
  readonly onReadFromBuzz: () => Promise<void>;
}) {
  const { configurationVersion, globalDefaults, agentDefaults, syncSupport } = PLOTPICKLE_RECOMMENDED_BUZZ_CONFIGURATION;
  const identity = readbackLabel(readback, buzzPubkey, readAttempted);
  const [message, setMessage] = useState("");

  async function refresh() {
    if (readBusy) return;
    setMessage("");
    try {
      await onReadFromBuzz();
      setMessage("Public identity and presence refreshed. BUZZ does not expose private effective settings for read-back.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "BUZZ configuration read-back is unavailable.");
    }
  }

  return (
    <section className={styles.buzzConfiguration} aria-label={`${agent.displayName} BUZZ configuration`}>
      <header>
        <span>BUZZ Configuration</span>
        <strong>{configurationVersion}</strong>
      </header>
      <dl>
        <div><dt>Info</dt><dd><span className={styles.verifiedStatus}>Defined</span></dd></div>
        <div><dt>Public Key</dt><dd><span className={styles[`${identity.tone}Status`]}>{identity.label}</span></dd></div>
        <div><dt>Runtime</dt><dd>{globalDefaults.runtime.label}<small>{globalDefaults.provider.label} · {globalDefaults.model}</small></dd></div>
        <div><dt>Channels</dt><dd>{roomLabels(agent.roomIds)}<small>Private Story Rooms: {agentDefaults.privateStoryRoomsLabel.toLowerCase()}</small></dd></div>
        <div><dt>Memory</dt><dd>{globalDefaults.memoryLabel}</dd></div>
        <div><dt>Agent Instructions</dt><dd>{configurationVersion}</dd></div>
        <div><dt>Agent Type</dt><dd>{agentDefaults.agentTypeLabel}</dd></div>
        <div><dt>Activation</dt><dd>{agentDefaults.activationLabel}</dd></div>
        <div><dt>Startup</dt><dd>Start with BUZZ: On<small>Restart on changes: On · Parallelism: {agentDefaults.parallelism}</small></dd></div>
        <div><dt>Configuration</dt><dd>{readAttempted ? "Public identity checked; private effective settings unavailable" : "Recommendation ready; BUZZ read-back pending"}</dd></div>
      </dl>
      <div className={styles.configurationActions}>
        <button disabled={readBusy} onClick={() => void refresh()} type="button">{readBusy ? "READING…" : "READ FROM BUZZ"}</button>
        <button data-sync-capability="unavailable" disabled type="button">SYNC TO BUZZ</button>
      </div>
      <p className={styles.syncBoundary}>{syncSupport.unavailableReason} No Agent private key or auth tag will be imported into PlotPickle.</p>
      {message ? <p className={styles.configurationMessage}>{message}</p> : null}
    </section>
  );
}

function StoryPickleDownloadControl({ profileId, download }: { readonly profileId: string; readonly download?: StoryPickleDownload }) {
  if (!STORY_PICKLE_IDS.has(profileId)) return null;
  if (!download?.available || !download.downloadUrl) {
    return <p className={styles.mintStatus}>Official BUZZ card awaiting verified mint</p>;
  }
  return <a className={styles.downloadAction} download={download.fileName} href={download.downloadUrl}>Download verified BUZZ card</a>;
}

function BuzzPublicKeyControl({
  profileId,
  pubkey,
  onBindingsChanged,
}: {
  readonly profileId: string;
  readonly pubkey: string;
  readonly onBindingsChanged: (bindings: Readonly<Record<string, string>>) => void;
}) {
  const [draft, setDraft] = useState(pubkey);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const normalized = draft.trim().toLowerCase();
  const valid = !normalized || NOSTR_PUBLIC_KEY.test(normalized);

  useEffect(() => {
    setDraft(pubkey);
  }, [pubkey]);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await authenticatedProfileFetch("/api/buzz-agent-public-identities", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ profileId, pubkey: normalized }),
      });
      const body = await response.json().catch(() => ({})) as BuzzAgentBindingStatus;
      if (!response.ok) throw new Error(body.message || "The BUZZ public key could not be saved.");
      const bindings = body.bindings ?? {};
      onBindingsChanged(bindings);
      setDraft(body.pubkey ?? "");
      setMessage(body.pubkey ? "Saved locally · Story Bridge signer updated" : "Local BUZZ signer binding cleared");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The BUZZ public key could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.publicKeyControl} data-buzz-public-key={pubkey ? "bound" : "missing"}>
      <div className={styles.publicKeyHeading}>
        <label htmlFor={`buzz-public-key-${profileId}`}>BUZZ Public Key</label>
        <span className={pubkey ? styles.boundStatus : styles.missingStatus}>{pubkey ? "Bound" : "Not set"}</span>
      </div>
      <div className={styles.publicKeyRow}>
        <input
          aria-invalid={!valid}
          autoCapitalize="none"
          autoComplete="off"
          id={`buzz-public-key-${profileId}`}
          maxLength={64}
          onChange={(event) => {
            setDraft(event.target.value);
            setMessage("");
          }}
          placeholder="64-character BUZZ public key"
          spellCheck={false}
          type="text"
          value={draft}
        />
        <button disabled={!valid || saving || normalized === pubkey} onClick={save} type="button">
          {saving ? "Saving…" : normalized ? "Save" : pubkey ? "Clear" : "Save"}
        </button>
      </div>
      {!valid ? <p className={styles.publicKeyError}>Enter exactly 64 hexadecimal characters.</p> : null}
      {message ? <p className={styles.publicKeyMessage}>{message}</p> : null}
      <p className={styles.publicKeyNote}>Public identity only. Never enter an nsec or private key here.</p>
    </div>
  );
}

function HelperCard({
  agent,
  expanded = false,
  download,
  buzzPubkey,
  buzzReadback,
  buzzReadAttempted,
  buzzReadBusy,
  onReadFromBuzz,
  onBindingsChanged,
}: {
  readonly agent: HelperAgent;
  readonly expanded?: boolean;
  readonly download?: StoryPickleDownload;
  readonly buzzPubkey: string;
  readonly buzzReadback?: BuzzAgentReadback;
  readonly buzzReadAttempted: boolean;
  readonly buzzReadBusy: boolean;
  readonly onReadFromBuzz: () => Promise<void>;
  readonly onBindingsChanged: (bindings: Readonly<Record<string, string>>) => void;
}) {
  const profile = agentProfileById(agent.profileId);
  if (!profile) return null;
  return (
    <article className={`${styles.card} ${expanded ? styles.individualCard : ""}`} data-helper-id={agent.profileId}>
      <div className={styles.portraitFrame}>
        <AgentPortrait
          id={agent.profileId}
          alt={`Illustrated fantasy portrait of ${agent.displayName}, ${agent.title}.`}
          size={expanded ? 180 : 140}
        />
      </div>
      <div className={styles.cardBody}>
        <p className={styles.title}>{agent.title}</p>
        <h4>{agent.displayName}</h4>
        <p className={styles.shortBio}>{agent.shortBio}</p>
        <dl>
          <div>
            <dt>Ask me about</dt>
            <dd>{agent.helpPrompt}</dd>
          </div>
          <div>
            <dt>Find me in</dt>
            <dd>{roomLabels(agent.roomIds)}</dd>
          </div>
          {expanded ? <div>
            <dt>About</dt>
            <dd>{agent.publicBio}</dd>
          </div> : null}
          {expanded ? <div>
            <dt>Boundary</dt>
            <dd>{cannotDo(profile)}</dd>
          </div> : null}
        </dl>
        {!expanded ? <details>
          <summary>About {agent.displayName}</summary>
          <p>{agent.publicBio}</p>
          <p><strong>Boundary:</strong> {cannotDo(profile)}</p>
        </details> : null}
        <BuzzConfigurationCard
          agent={agent}
          buzzPubkey={buzzPubkey}
          onReadFromBuzz={onReadFromBuzz}
          readAttempted={buzzReadAttempted}
          readback={buzzReadback}
          readBusy={buzzReadBusy}
        />
        <BuzzPublicKeyControl
          onBindingsChanged={onBindingsChanged}
          profileId={agent.profileId}
          pubkey={buzzPubkey}
        />
        <StoryPickleDownloadControl download={download} profileId={agent.profileId} />
      </div>
    </article>
  );
}

export default function SettingsHelperDirectory() {
  const { agents, helpGroups } = PLOTPICKLE_COMMUNITY_EXTENSIONS;
  const [selectedHelperId, setSelectedHelperId] = useState("");
  const [storyPickleDownloads, setStoryPickleDownloads] = useState<StoryPickleDownloadStatus | null>(null);
  const [buzzBindings, setBuzzBindings] = useState<Readonly<Record<string, string>>>({});
  const [buzzReadback, setBuzzReadback] = useState<BuzzAgentReadbackStatus | null>(null);
  const [buzzReadBusy, setBuzzReadBusy] = useState(false);

  async function readFromBuzz() {
    if (buzzReadBusy) return;
    setBuzzReadBusy(true);
    try {
      const response = await fetch("/api/local-buzz/agent-roster", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = await response.json().catch(() => ({})) as BuzzAgentReadbackStatus;
      if (!response.ok || body.ok === false) throw new Error(body.message || "BUZZ configuration read-back is unavailable.");
      setBuzzReadback(body);
    } finally {
      setBuzzReadBusy(false);
    }
  }

  useEffect(() => {
    const sync = () => setSelectedHelperId(requestedHelperId());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/story-pickle-downloads", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((status) => {
        if (status) setStoryPickleDownloads(status as StoryPickleDownloadStatus);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/buzz-agent-public-identities", {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then((response) => response.ok ? response.json() : null)
      .then((status) => {
        const bindings = (status as BuzzAgentBindingStatus | null)?.bindings;
        if (bindings) setBuzzBindings(bindings);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const downloadByProfileId = new Map(storyPickleDownloads?.individuals.map((download) => [download.profileId, download]) ?? []);
  const selectedAgent = selectedHelperId ? agents.find((agent) => agent.profileId === selectedHelperId) ?? null : null;

  if (selectedAgent) {
    return (
      <div className={styles.help} data-settings-help="individual-helper" data-selected-helper={selectedAgent.profileId}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>HELP · Individual Helper</p>
            <h2 id="settings-help-title">{selectedAgent.displayName}</h2>
            <p>{selectedAgent.shortBio}</p>
          </div>
          <nav className={styles.helpNav} aria-label="Help pages">
            <a href="/?workspace=settings&settings=help">← All helpers</a>
          </nav>
        </header>
        <PlotPickleAgentDefaults />
        <section className={styles.individual} aria-label={`${selectedAgent.displayName} help`}>
          <HelperCard
            agent={selectedAgent}
            buzzPubkey={buzzBindings[selectedAgent.profileId] ?? ""}
            buzzReadAttempted={buzzReadback !== null}
            buzzReadback={buzzReadback?.agents?.find((candidate) => candidate.actorId === selectedAgent.profileId)}
            buzzReadBusy={buzzReadBusy}
            download={downloadByProfileId.get(selectedAgent.profileId)}
            expanded
            onReadFromBuzz={readFromBuzz}
            onBindingsChanged={setBuzzBindings}
          />
        </section>
      </div>
    );
  }

  return (
    <div className={styles.help} data-settings-help="meet-the-helpers">
      <header className={`${styles.hero} ${styles.directoryHero}`}>
        <div>
          <p className={styles.eyebrow}>HELP · Meet the Helpers</p>
          <h2 id="settings-help-title">Meet the PlotPickle helpers.</h2>
          <p>
            These are the same official personalities you meet throughout PlotPickle and PlotPicklePlayhouse. Pick the person whose job matches what you need; rooms may have several helpers working together.
          </p>
        </div>
        <nav className={styles.helpNav} aria-label="Current Help page">
          <a href="#settings-help" aria-current="page">Meet the Helpers</a>
        </nav>
      </header>

      <PlotPickleAgentDefaults />

      {helpGroups.map((group) => {
        const groupAgents = agents.filter((agent) => agent.helpGroup === group.id);
        if (!groupAgents.length) return null;
        return (
          <section className={styles.group} key={group.id} aria-labelledby={`helper-group-${group.id}`}>
            <header className={styles.groupHeader}>
              <h3 id={`helper-group-${group.id}`}>{group.label}</h3>
              <span>{group.description}</span>
              {group.id === "writing-story" ? (
                <div className={styles.distribution}>
                  {storyPickleDownloads?.bundle.available && storyPickleDownloads.bundle.downloadUrl
                    ? <a className={styles.bundleAction} download={storyPickleDownloads.bundle.fileName} href={storyPickleDownloads.bundle.downloadUrl}>Download all three verified Story Pickles</a>
                    : <span className={styles.bundleStatus}>All-three BUZZ bundle awaiting the three official verified mints.</span>}
                  <span className={styles.distributionNote}>Each BUZZ import creates a fresh community-local Agent identity controlled by that community owner. No signer, private memory, previous conversation or PlotPickle project authority transfers with a card.</span>
                </div>
              ) : null}
            </header>
            <div className={styles.grid}>
              {groupAgents.map((agent) => (
                <HelperCard
                  agent={agent}
                  buzzPubkey={buzzBindings[agent.profileId] ?? ""}
                  buzzReadAttempted={buzzReadback !== null}
                  buzzReadback={buzzReadback?.agents?.find((candidate) => candidate.actorId === agent.profileId)}
                  buzzReadBusy={buzzReadBusy}
                  download={downloadByProfileId.get(agent.profileId)}
                  key={agent.profileId}
                  onReadFromBuzz={readFromBuzz}
                  onBindingsChanged={setBuzzBindings}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
