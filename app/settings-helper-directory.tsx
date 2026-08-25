"use client";

import { useEffect, useState } from "react";
import AgentPortrait from "../components/agent-portrait";
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

const STORY_PICKLE_IDS = new Set<string>(STORY_PICKLE_PROFILE_IDS);

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

function HelperCard({
  agent,
  expanded = false,
  download,
}: {
  readonly agent: HelperAgent;
  readonly expanded?: boolean;
  readonly download?: StoryPickleDownload;
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
        <StoryPickleDownloadControl download={download} profileId={agent.profileId} />
      </div>
    </article>
  );
}

export default function SettingsHelperDirectory() {
  const { agents, helpGroups } = PLOTPICKLE_COMMUNITY_EXTENSIONS;
  const [selectedHelperId, setSelectedHelperId] = useState("");
  const [storyPickleDownloads, setStoryPickleDownloads] = useState<StoryPickleDownloadStatus | null>(null);

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
          <HelperCard agent={selectedAgent} download={downloadByProfileId.get(selectedAgent.profileId)} expanded />
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
              {groupAgents.map((agent) => <HelperCard agent={agent} download={downloadByProfileId.get(agent.profileId)} key={agent.profileId} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
