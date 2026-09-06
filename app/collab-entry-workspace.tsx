"use client";

import Link from "next/link";
import styles from "./collab-entry-workspace.module.css";

export default function CollabEntryWorkspace({ projectTitle }: { readonly projectTitle: string }) {
  return (
    <main className={styles.page} aria-labelledby="collab-entry-title">
      <header className={styles.hero}>
        <p className={styles.kicker}>Connect / Play · Collab</p>
        <h1 id="collab-entry-title">Formal collaboration without a second project.</h1>
        <p>
          Collab remains the launch point for formal shared work. During the sitemap migration, each action below routes to its current canonical owner rather than reviving the legacy localStorage collaboration workspace beside the profile-owned PPF.
        </p>
      </header>

      <section className={styles.truth} aria-label="Collab project authority">
        <div><small>Current project</small><strong>{projectTitle || "Untitled Story"}</strong></div>
        <div><small>Durable authority</small><strong>Profile-owned PlotPickle Project / PPF</strong></div>
      </section>

      <section className={styles.grid} aria-label="Collab destinations">
        <article className={styles.card}>
          <small>Discussion and rooms</small>
          <h2>Community / BUZZ</h2>
          <p>Use public conversations, rooms, presence and agent discovery without giving BUZZ ownership of project or STORY state.</p>
          <Link className={styles.action} href="/?workspace=community">Open Community</Link>
        </article>

        <article className={styles.card}>
          <small>Review and decisions</small>
          <h2>Feedback</h2>
          <p>Keep notes, proposals, review evidence and human approval decisions in the existing review owner.</p>
          <Link className={styles.action} href="/?workspace=feedback">Open Feedback</Link>
        </article>

        <article className={styles.card}>
          <small>Revision history and proposals</small>
          <h2>Native Git</h2>
          <p>Inspect revisions, branches, conflicts and repository proposals without creating another story representation.</p>
          <Link className={styles.action} href="/git">Open Native Git</Link>
        </article>

        <article className={styles.card}>
          <small>Connections and meetings</small>
          <h2>Settings</h2>
          <p>Configure GitHub, Google, BUZZ and other optional services in Settings. Configuration stays outside creative content.</p>
          <Link className={styles.action} href="/?workspace=settings">Open Settings</Link>
        </article>
      </section>

      <p className={styles.note} role="note">
        The historical Collab component still exists, but it expects the retired rich local project model. This entry intentionally does not mount that component until formal collaboration is reconnected to the current PPF authority through a dedicated compatibility boundary.
      </p>
    </main>
  );
}
