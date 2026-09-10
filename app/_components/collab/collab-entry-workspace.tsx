"use client";

import Link from "next/link";
import styles from "./collab-entry-workspace.module.css";

export default function CollabEntryWorkspace({ projectTitle }: { readonly projectTitle: string }) {
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
            <Link className={styles.action} href="/pitch-review">Open Feedback</Link>
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
