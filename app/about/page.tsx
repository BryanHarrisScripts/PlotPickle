import Link from "next/link";
import packageInfo from "../../package.json";
import {
  PLOTPICKLE_POSITIONING,
  STORYWORLD_PROTOTYPE_LOOP,
} from "@/lib/product-direction";
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
          <h1>See the whole movie before you make it.</h1>
          <p>
            PlotPickle is a local-first visual storyworld and AI previsualization engine built around Bryan Harris&apos;s 24 Blocks method. It connects story logic, canon, characters, visuals, shots and sound in one portable PPF project so approved material can grow into a watchable prototype for a green-light decision.
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
        <article><span>What it is</span><h2>A visual storyworld engine</h2><p>Structure, screenplay material, Whole Film, Graphic Novel, Storyboard, Production Shots, Animatic, Pitch and Reports use one connected project instead of parallel creative files.</p></article>
        <article><span>Why it exists</span><h2>Make movie logic visible</h2><p>Hooks, turning points, causality, arcs, character decisions and visual continuity stay visible while the project moves from script structure toward a prototype.</p></article>
        <article><span>What it proves</span><h2>A movie worth green-lighting</h2><p>The goal is a watchable AI-assisted or manually assembled prototype that helps a creative team judge whether the movie works before committing to full production.</p></article>
        <article><span>What it is not</span><h2>Not a finishing system</h2><p>PlotPickle does not aim to replace Final Draft, a professional production crew, editorial, colour, sound finishing or a studio delivery pipeline.</p></article>
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
        <header><span>Available visual path</span><h2>Different resolutions, one PPF source of truth</h2><p>These existing workspaces already connect screenplay structure to visual development, production shots, animatic playback and decision evidence.</p></header>
        <div className={styles.flow}>{pageToProductionStages.map((stage, index) => <div key={stage}><strong>{stage}</strong>{index < pageToProductionStages.length - 1 ? <span aria-hidden="true">→</span> : null}</div>)}</div>
        <p className={styles.callout}>{PLOTPICKLE_POSITIONING.ppf}</p>
      </section>

      <section className={styles.panel}>
        <header><span>Available now and conversion roadmap</span><h2>Extend the tools already here</h2><p>The first step is available today. Each later step is an explicit conversion planned by roadmap #192, not a shipped rendering claim or a new parallel engine.</p></header>
        <div className={styles.principles}>
          {STORYWORLD_PROTOTYPE_LOOP.map((step) => (
            <article key={step.id}>
              <h3>{step.statusLabel}: {step.title}</h3>
              <p>{step.summary}</p>
            </article>
          ))}
        </div>
        <p className={styles.callout}>{PLOTPICKLE_POSITIONING.boundary}</p>
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
