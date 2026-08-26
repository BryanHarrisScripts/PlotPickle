"use client";

import { useEffect, useState } from "react";
import AgentPortrait from "../components/agent-portrait";
import { authenticatedProfileFetch } from "../core/auth/profile-request-browser";
import { agentProfileById, type AgentProfile } from "../lib/agents/agent-profiles";
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
  onBindingsChanged,
}: {
  readonly agent: HelperAgent;
  readonly expanded?: boolean;
  readonly download?: StoryPickleDownload;
  readonly buzzPubkey: string;
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
        <section className={styles.individual} aria-label={`${selectedAgent.displayName} help`}>
          <HelperCard
            agent={selectedAgent}
            buzzPubkey={buzzBindings[selectedAgent.profileId] ?? ""}
            download={downloadByProfileId.get(selectedAgent.profileId)}
            expanded
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
                  download={downloadByProfileId.get(agent.profileId)}
                  key={agent.profileId}
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
