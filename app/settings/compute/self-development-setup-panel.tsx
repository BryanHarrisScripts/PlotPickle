"use client";

import FactorySupervisorPanel from "../../skin-v1/factory-supervisor-panel";
import styles from "./self-development-setup-panel.module.css";

/**
 * #3358: discoverable FIRST opt-in preparation surface, not an execution grant.
 * No browser preference or "enable" flag is accepted as Factory authority.
 * Provisioning remains unavailable until the existing Service Manager
 * implements a reviewed, profile-authorized install/readiness operation.
 */
export default function SelfDevelopmentSetupPanel() {
  return (
    <div className={styles.stack} data-self-development-setup="preparation-only" data-provisioning-state="unverified">
      <section className={styles.intro} aria-labelledby="self-development-title">
        <p className={styles.eyebrow}>SETTINGS / COMPUTE / SERVICES</p>
        <h2 id="self-development-title">Build and extend your own PlotPickle</h2>
        <p>Software Factory is optional. You can keep writing and producing stories without installing a developer kit, connecting GitHub or enabling coding agents.</p>
        <div className={styles.status} role="status">
          <strong>Self-development activation: not available yet</strong>
          <span>This installation has not supplied a verified, one-click Factory enrollment path. A running supervisor alone does not activate self-development.</span>
        </div>
        <button type="button" disabled aria-disabled="true" className={styles.disabledAction}>
          Enable Software Factory / Build and extend PlotPickle
        </button>
        <p className={styles.note}>The activation button stays disabled until the existing, authenticated Service Manager can prove isolated setup and explicit Human consent. This screen does not issue work orders or change your installed application.</p>
      </section>
      <section className={styles.preparation} aria-labelledby="self-development-checklist">
        <h3 id="self-development-checklist">What optional setup will check</h3>
        <ul>
          <li>Isolated user-owned source checkout and sufficient local storage, separate from the trusted installed app</li>
          <li>Locally available model and development tools, with no automatic paid-provider fallback</li>
          <li>Existing profile permissions, STOP/PAUSE, no-replay recovery and one Service Manager</li>
          <li>Actual source edit, tests, independently attributable review, Windows preview and rollback before local release</li>
        </ul>
        <p>GitHub remains optional for local development. Publishing upstream requires your own separately authorized repository permissions. Other users never need the original maintainer's paths, keys or account.</p>
      </section>
      <FactorySupervisorPanel />
    </div>
  );
}
