import AgentPortrait from "../components/agent-portrait";
import { agentProfileById, type AgentProfile } from "../lib/agent-profiles";
import { PLOTPICKLE_COMMUNITY_EXTENSIONS } from "../plugins/plotpickle-playhouse";
import styles from "./settings-helper-directory.module.css";

function cannotDo(profile: AgentProfile) {
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

export default function SettingsHelperDirectory() {
  const { agents, helpGroups } = PLOTPICKLE_COMMUNITY_EXTENSIONS;
  return (
    <div className={styles.help} data-settings-help="meet-the-helpers">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>HELP · Meet the Helpers</p>
          <h2 id="settings-help-title">Meet the PlotPickle helpers.</h2>
          <p>
            These are the same official personalities you meet throughout PlotPickle and PlotPicklePlayhouse. Pick the person whose job matches what you need; rooms may have several helpers working together.
          </p>
        </div>
        <nav className={styles.helpNav} aria-label="Help pages">
          <a href="#settings-help" aria-current="page">Meet the Helpers</a>
          <span aria-disabled="true">Getting Started · coming later</span>
          <span aria-disabled="true">AI Setup · coming later</span>
          <span aria-disabled="true">Projects & Backups · coming later</span>
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
            </header>
            <div className={styles.grid}>
              {groupAgents.map((agent) => {
                const profile = agentProfileById(agent.profileId);
                if (!profile) return null;
                return (
                  <article className={styles.card} data-helper-id={agent.profileId} key={agent.profileId}>
                    <div className={styles.portraitFrame}>
                      <AgentPortrait
                        id={agent.profileId}
                        alt={`Illustrated fantasy portrait of ${agent.displayName}, ${agent.title}.`}
                        size={140}
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
                      </dl>
                      <details>
                        <summary>About {agent.displayName}</summary>
                        <p>{agent.publicBio}</p>
                        <p><strong>Boundary:</strong> {cannotDo(profile)}</p>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
