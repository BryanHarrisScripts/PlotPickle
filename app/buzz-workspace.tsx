"use client";

import {
  BUZZ_RUNTIME_BOUNDARIES,
  BUZZ_RUNTIME_COMPONENTS,
  DORMANT_BUZZ_RUNTIME,
  type BuzzRuntimeSnapshot,
} from "@/lib/buzz-runtime";
import styles from "./buzz-workspace.module.css";

type BuzzWorkspaceProps = {
  runtime?: BuzzRuntimeSnapshot;
  onOpenSettings: () => void;
};

function statusLabel(runtime: BuzzRuntimeSnapshot) {
  if (runtime.lifecycle === "running") return "Connected and running";
  if (runtime.lifecycle === "starting") return "Starting";
  if (runtime.lifecycle === "stopping") return "Stopping";
  if (runtime.lifecycle === "stopped") return "Configured and stopped";
  if (runtime.lifecycle === "repair-required") return "Repair required";
  if (runtime.lifecycle === "unavailable") return "Unavailable in this package";
  if (runtime.lifecycle === "configuring") return "Configuring";
  return "Not configured";
}

export default function BuzzWorkspace({ runtime = DORMANT_BUZZ_RUNTIME, onOpenSettings }: BuzzWorkspaceProps) {
  const ready = runtime.lifecycle === "running";

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Buzz</p>
          <h1>Rooms, agents and development activity beside Collab.</h1>
          <span>Buzz handles live discussion and agent activity. Feedback remains the permanent review record, PPF remains canonical for the storyworld, and GitHub remains canonical for code and pull requests.</span>
        </div>
        <div className={`${styles.status} ${ready ? styles.ready : ""}`} role="status">
          <i aria-hidden="true" />
          <span><b>{statusLabel(runtime)}</b><small>{runtime.message}</small></span>
        </div>
      </header>

      {!runtime.packaged ? (
        <section className={styles.installBoundary} aria-labelledby="buzz-runtime-boundary-title">
          <div>
            <p>Managed native runtime</p>
            <h2 id="buzz-runtime-boundary-title">The workspace is designed, but native Buzz binaries are not packaged in this build yet.</h2>
            <span>PlotPickle will eventually include pinned platform-native components in its normal installer. Until those artifacts are checksummed and clean-machine tested, Buzz remains safely dormant.</span>
          </div>
          <button type="button" onClick={onOpenSettings}>Open Buzz settings</button>
        </section>
      ) : null}

      <div className={styles.summaryGrid}>
        <article><span>Creative authority</span><h2>PPF</h2><p>{BUZZ_RUNTIME_BOUNDARIES.creativeAuthority}</p></article>
        <article><span>Code authority</span><h2>GitHub</h2><p>{BUZZ_RUNTIME_BOUNDARIES.codeAuthority}</p></article>
        <article><span>Configuration owner</span><h2>Settings</h2><p>{BUZZ_RUNTIME_BOUNDARIES.settingsOwner}</p></article>
        <article><span>Runtime state</span><h2>{runtime.lifecycle}</h2><p>{BUZZ_RUNTIME_BOUNDARIES.dormantRule}</p></article>
      </div>

      <section className={styles.sections} aria-label="Buzz workspace sections">
        {[
          ["Overview", "Runtime health, current community, project room and unread activity."],
          ["Project Room", "Conversation connected to the active PlotPickle project."],
          ["Story Discussions", "Contextual rooms for Blocks, scenes, characters and visuals."],
          ["Media Review", "Frame-anchored discussion without bypassing structured Feedback."],
          ["Agents", "Explicitly approved human and agent identities with their own audit trails."],
          ["Development", "Branch-only coding work, diffs and test evidence in isolated worktrees."],
          ["Search & Activity", "Searchable rooms, workflow events and signed development history."],
        ].map(([title, description]) => (
          <article key={title}>
            <span>{ready ? "Available" : "Requires configured Buzz"}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className={styles.runtimeComponents}>
        <div><p>Included runtime plan</p><h2>PlotPickle manages only the Buzz components it uses.</h2></div>
        <div>{BUZZ_RUNTIME_COMPONENTS.map((component) => <code key={component}>{component}</code>)}</div>
        <p>The separate Buzz desktop client is not included. PlotPickle supplies the interface and owns configuration, startup, shutdown, repair, backup and removal.</p>
      </section>
    </div>
  );
}
