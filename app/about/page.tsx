import Link from "next/link";
import packageInfo from "../../package.json";
import {
  convergenceMap,
  currentProductFacts,
  pageToProductionStages,
  plotPicklePrinciples,
  plotPickleTimeline,
} from "./about-content";
import styles from "./about.module.css";

const schemaVersion = "1.7.0";

export default function AboutPlotPicklePage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span>About · Origins · Product Principles</span>
          <h1>PlotPickle keeps the whole movie connected while you work on one manageable piece.</h1>
          <p>
            PlotPickle is a local-first story-development and screenplay application built around Bryan Harris&apos;s 24 Blocks method. One portable canonical project connects story foundations, flexible structure, treatment, screenplay, visual development, review, production and provenance.
          </p>
          <div className={styles.actions}>
            <Link href="/">Open PlotPickle</Link>
            <Link href="/read-learn?module=why-plotpickle-works-in-layers">Learn why the layers connect</Link>
            <Link href="/legal">Copyright and licensing</Link>
          </div>
        </div>
        <aside>
          <strong>The writer&apos;s decisions define the work.</strong>
          <p>Tools may organize, diagnose, compare or propose. Nothing becomes canon until the writer or authorized project owner accepts it.</p>
        </aside>
      </header>

      <section className={styles.introGrid}>
        <article><span>What it is</span><h2>One local application</h2><p>Story Planner, Screenplay, Visual Board, Engines, Specialist Labs, Production and Read & Learn all use the same project rather than disconnected files or products.</p></article>
        <article><span>Why it exists</span><h2>Keep the complete movie visible</h2><p>PlotPickle grew from the problem of a screenplay and its supporting ideas becoming trapped in separate applications, folders and versions.</p></article>
        <article><span>Who it serves</span><h2>Different writers, different routes</h2><p>Begin with an idea, build a feature, import an existing screenplay, review bounded proposals, teach screenplay craft, use AI selectively or use no AI at all.</p></article>
        <article><span>What remains yours</span><h2>Ownership and decisions</h2><p>Story ownership, canon, collaboration permissions, AI use, suggestion approval, sharing, licensing, export and distribution remain under the writer&apos;s control.</p></article>
      </section>

      <section className={styles.panel}>
        <header><span>Current product facts</span><h2>Specific, testable descriptions</h2><p>The legacy vision included many experiments. These are the commitments that describe PlotPickle now.</p></header>
        <ul className={styles.factList}>{currentProductFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      </section>

      <section className={styles.panel}>
        <header><span>How it evolved</span><h2>From Afterglow to one canonical project</h2><p>The earlier work was consolidated rather than erased. Historical names remain aliases, not current product architecture.</p></header>
        <div className={styles.timeline}>{plotPickleTimeline.map((item) => <article key={item.stage}><small>{item.stage}</small><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
        <Link className={styles.textLink} href="/docs/history/from-openstory-to-plotpickle.md">Read the detailed historical record</Link>
      </section>

      <section className={styles.panel}>
        <header><span>Product principles</span><h2>Stable guidance for design and use</h2><p>Personal history and biography are preserved separately. These principles describe how PlotPickle should behave for every writer.</p></header>
        <div className={styles.principles}>{plotPicklePrinciples.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className={styles.panel}>
        <header><span>One project from page to production</span><h2>Different resolutions, one source of truth</h2><p>Every stage reads and writes the same project. The diagram is a connected workflow, not a promise that software automatically produces a movie.</p></header>
        <div className={styles.flow}>{pageToProductionStages.map((stage, index) => <div key={stage}><strong>{stage}</strong>{index < pageToProductionStages.length - 1 ? <span aria-hidden="true">→</span> : null}</div>)}</div>
        <p className={styles.callout}>A screenplay can remain valuable as writing, learning material, a collaboration source, a visual-development project or a production plan even when it has not yet been produced.</p>
      </section>

      <section className={styles.panel}>
        <header><span>Legacy feature convergence</span><h2>How the separate experiments were absorbed</h2><p>Deferred or retired experiments are not silently added to the roadmap.</p></header>
        <div className={styles.table} role="table" aria-label="Legacy feature convergence map">
          <div className={styles.tableHeader} role="row"><strong role="columnheader">Legacy concept</strong><strong role="columnheader">PlotPickle evolution</strong></div>
          {convergenceMap.map(([legacy, current]) => <div role="row" key={legacy}><span role="cell">{legacy}</span><span role="cell">{current}</span></div>)}
        </div>
      </section>

      <section className={styles.systemCard}>
        <div><span>Application</span><strong>PlotPickle {packageInfo.version}</strong></div>
        <div><span>Project schema</span><strong>{schemaVersion}</strong></div>
        <div><span>Distribution</span><strong>Downloadable local server</strong></div>
        <div><span>Software licence</span><strong>{packageInfo.license}</strong></div>
        <div><span>Educational material</span><strong>CC BY-SA 4.0 where identified</strong></div>
        <div><span>User projects</span><strong>Not automatically licensed</strong></div>
      </section>

      <footer className={styles.footer}>
        <div><strong>Historical boundary</strong><p>OpenStory Studio, separate GPTs, web3, tokens, DAOs, revenue promises, autonomous-agent orchestration and required public collaboration describe earlier experiments, not current PlotPickle commitments.</p></div>
        <nav><a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source repository</a><Link href="/legal">Licences and rights</Link><Link href="/read-learn">Read & Learn</Link></nav>
      </footer>
    </main>
  );
}
