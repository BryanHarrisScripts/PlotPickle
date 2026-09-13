import styles from "./dashboard-review-surface.module.css";

const sections = [
  {
    title: "Your Work",
    body: "You keep whatever rights you hold in your stories, characters, dialogue, images, research, notes, PPF projects and exports. Using PlotPickle does not transfer ownership of that material to PlotPickle, its contributors or a server operator.",
  },
  {
    title: "PlotPickle Software",
    body: "PlotPickle software is licensed under GNU Affero General Public License version 3 or later. The software may be run, studied, copied, modified and redistributed under that licence while preserving its required notices and licence obligations.",
  },
  {
    title: "24 Blocks & Documentation",
    body: "The 24 Blocks method and reusable non-software instructional or documentation material identified by PlotPickle are licensed under Creative Commons Attribution-ShareAlike 4.0 International unless a file states otherwise.",
  },
  {
    title: "Software Privacy",
    body: "PlotPickle is local-first. Human profiles, private projects, writing decisions, credentials and local files stay within the selected PlotPickle Node by default. A deliberate cloud, BUZZ, GitHub, Google or export action sends only the content selected for that action to that external service.",
  },
  {
    title: "Community",
    body: "Difficult fictional, historical, educational or analytical subject matter is not misconduct merely because it contains a sensitive word. Real-world harassment, credible threats, privacy violations, credential sharing and deliberate disruption remain outside the Community boundary.",
  },
  {
    title: "Server Operators",
    body: "Advanced operator-run editions are responsible for their real deployment security, privacy, storage, retention, deletion, support and jurisdiction terms. Modified PlotPickle editions made available over a network also carry the AGPL network-source obligations that apply to that modified software.",
  },
] as const;

export default function OpenSourceSkinPanel() {
  return (
    <div className={styles.surface} data-open-source-skin-panel="review">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Rights · privacy · attribution</p>
        <h2>Open software. Your story remains yours.</h2>
        <p>This is the Human-facing PlotPickle summary. You do not need a source repository, developer account or external website to understand the ordinary rights and privacy boundaries.</p>
      </header>

      <div className={styles.cardGrid}>
        {sections.map((section) => (
          <section className={styles.card} key={section.title}>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </section>
        ))}
        <section className={styles.card}>
          <h3>Third-Party Material</h3>
          <p>Third-party libraries, fonts, images and other included material remain subject to their own licences and notices. PlotPickle&apos;s software or instructional licences do not replace those terms.</p>
        </section>
        <section className={styles.card}>
          <h3>Brand & Contributions</h3>
          <p>Contributors keep copyright in their original contributions while licensing accepted code or identified instructional material under the project&apos;s applicable terms. PlotPickle names and identifying brand assets do not grant permission to present a modified edition as the official edition.</p>
        </section>
      </div>

      <section className={styles.boundary} aria-label="Open Source boundary">
        <strong>Practical summary, not legal advice.</strong>
        <p>Licence, privacy, platform or Community obligations for a particular business, deployment or jurisdiction may require qualified professional advice. Product help and problem reports live in Help / Issue Log on the Dashboard, not on this surface.</p>
      </section>
    </div>
  );
}
