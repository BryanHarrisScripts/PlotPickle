import Image from "next/image";
import helperDirectory from "../config/helper-directory.json";
import { AGENT_PROFILES, type AgentProfile } from "../lib/agent-profiles";
import styles from "./settings-helper-directory.module.css";

const presentationById = new Map(helperDirectory.helpers.map((helper) => [helper.id, helper]));

const ROOM_LABELS: Record<string, string> = {
  "lore-library": "LEARN and the Creative Room",
  "story-council": "PLAN and story planning",
  "wyrmwood-ring": "Wyrmwood",
  "thread-vault": "Continuity review",
  marquee: "BUILD campaign art and trailer work",
  "critics-circle": "Feedback and story review",
  "wayfarer-journal": "Writer-in-Residence review",
  "lantern-watch": "Visual QA",
  gatehouse: "UAT and Full Verification",
  forge: "Engineering quality and repair",
  archive: "Community and the Guildhall archive",
  "github-herald": "Guildhall engineering handoff",
};

function modeFor(profile: AgentProfile) {
  if (profile.execution.kind === "buzz-managed") return "Community support";
  if (["plotpickle-uat", "deterministic-observer", "deterministic-gate", "repository-handoff"].includes(profile.execution.kind)) {
    return "Background quality";
  }
  if (profile.defaultAvailability === "on-demand" || profile.defaultAvailability === "parked") return "On demand";
  return "User-facing";
}

function cannotDo(profile: AgentProfile) {
  if (profile.id === "sage-brinewick") return "Sage can advise and propose, but cannot silently change accepted story canon.";
  if (profile.forbiddenCapabilities.includes("merge-authority")) return `${profile.displayName} cannot merge code or change repository state.`;
  if (profile.forbiddenCapabilities.includes("game-state-write")) return `${profile.displayName} cannot change Wyrmwood state, progress or rewards.`;
  if (profile.forbiddenCapabilities.includes("external-publish")) return `${profile.displayName} cannot publish anything outside PlotPickle for you.`;
  if (profile.forbiddenCapabilities.includes("product-input-write")) return `${profile.displayName} observes evidence but cannot operate the product or make changes on its own.`;
  if (profile.forbiddenCapabilities.includes("hidden-browser-evaluation")) return `${profile.displayName} must use the visible writer journey and cannot secretly inspect the page to judge itself.`;
  if (["proposal-only", "advisory-only", "scenario-proposal-only"].includes(profile.creativeAuthority)) {
    return `${profile.displayName} can recommend options, but cannot make a creative change final without your approval.`;
  }
  if (["observer-only", "evaluator-only", "synthetic-observer-only"].includes(profile.creativeAuthority)) {
    return `${profile.displayName} can observe or evaluate, but cannot turn that finding into a story or product change on its own.`;
  }
  return `${profile.displayName} cannot override deterministic gates or the writer's final creative decisions.`;
}

export default function SettingsHelperDirectory() {
  return (
    <div className={styles.help} data-settings-help="meet-the-helpers">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>HELP · Meet the Helpers</p>
          <h2 id="settings-help-title">Who can help me with this?</h2>
          <p>
            PlotPickle has different helpers for story craft, visuals, community and quality. You stay the author. Helpers can teach, suggest, observe or report within their own job; they do not quietly take authority from you.
          </p>
        </div>
        <nav className={styles.helpNav} aria-label="Help pages">
          <a href="#settings-help" aria-current="page">Meet the Helpers</a>
          <span aria-disabled="true">Getting Started · coming later</span>
          <span aria-disabled="true">AI Setup · coming later</span>
          <span aria-disabled="true">Projects & Backups · coming later</span>
        </nav>
      </header>

      {helperDirectory.groups.map((group) => {
        const profiles = AGENT_PROFILES.filter((profile) => presentationById.get(profile.id)?.group === group.id);
        return (
          <section className={styles.group} key={group.id} aria-labelledby={`helper-group-${group.id}`}>
            <header className={styles.groupHeader}>
              <p>{group.label}</p>
              <h3 id={`helper-group-${group.id}`}>{group.label}</h3>
              <span>{group.description}</span>
            </header>
            <div className={styles.grid}>
              {profiles.map((profile) => {
                const presentation = presentationById.get(profile.id);
                if (!presentation) return null;
                return (
                  <article className={styles.card} data-helper-id={profile.id} key={profile.id}>
                    <div className={styles.portraitFrame}>
                      <Image
                        className={styles.portrait}
                        src={presentation.portrait}
                        alt={`Illustrated portrait of ${profile.displayName}, ${profile.title}.`}
                        width={360}
                        height={360}
                        sizes="(max-width: 760px) 100vw, (max-width: 1180px) 50vw, 360px"
                        unoptimized
                      />
                      <span>{modeFor(profile)}</span>
                    </div>
                    <div className={styles.cardBody}>
                      <p className={styles.title}>{profile.title}</p>
                      <h4>{profile.displayName}</h4>
                      <dl>
                        <div>
                          <dt>Who they are</dt>
                          <dd>{profile.responsibility}</dd>
                        </div>
                        <div>
                          <dt>How they help you</dt>
                          <dd>{presentation.how}</dd>
                        </div>
                        <div>
                          <dt>Where you meet them</dt>
                          <dd>{ROOM_LABELS[profile.homeRoomId] ?? profile.homeRoomId}</dd>
                        </div>
                        <div>
                          <dt>What they cannot do</dt>
                          <dd>{cannotDo(profile)}</dd>
                        </div>
                      </dl>
                      <details>
                        <summary>Show the full guardrail</summary>
                        <p>{profile.verificationContract}</p>
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
