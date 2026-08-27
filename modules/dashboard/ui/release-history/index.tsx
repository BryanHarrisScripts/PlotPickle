import releaseHistorySource from "../../../../config/release-history.json";
import styles from "./release-history.module.css";

type ReleaseEntry = {
  id: string;
  label: string;
  date: string;
  version?: string;
  title: string;
  summary: string;
  added: string[];
  changed: string[];
  fixed: string[];
  references?: string[];
};

type ReleaseHistory = {
  schemaVersion: number;
  releases: ReleaseEntry[];
};

const releaseHistory = releaseHistorySource as ReleaseHistory;

function ChangeGroup({ label, items }: { readonly label: string; readonly items: readonly string[] }) {
  if (!items.length) return null;
  return (
    <section className={styles.changeGroup}>
      <h4>{label}</h4>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

export default function ReleaseHistoryPanel() {
  return (
    <section className={styles.panel} aria-label="What's New and Release History">
      <header className={styles.heading}>
        <div>
          <p>What&apos;s New</p>
          <h2>PlotPickle Release History</h2>
          <span>Curated user-facing releases from merged work. Dependency bumps and routine commits are intentionally excluded.</span>
        </div>
        <strong>{releaseHistory.releases[0]?.label || "No release recorded"}</strong>
      </header>

      <div className={styles.releases}>
        {releaseHistory.releases.map((release, index) => (
          <article className={styles.release} data-latest={index === 0} key={release.id}>
            <header>
              <div>
                <p>{index === 0 ? "Latest release" : "Earlier release"} · {release.date}</p>
                <h3>{release.title}</h3>
                <span>{release.label}{release.version ? ` · v${release.version}` : ""}</span>
              </div>
              {index === 0 ? <strong>NEWEST</strong> : null}
            </header>
            <p className={styles.summary}>{release.summary}</p>
            <div className={styles.groups}>
              <ChangeGroup label="Added" items={release.added} />
              <ChangeGroup label="Changed" items={release.changed} />
              <ChangeGroup label="Fixed" items={release.fixed} />
            </div>
            {release.references?.length ? <small>Related: {release.references.join(" · ")}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
