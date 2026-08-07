import Link from "next/link";
import packageInfo from "../../package.json";
import {
  PLOTPICKLE_POSITIONING,
  STORYWORLD_CORE_LOOP,
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
const sourceRepository = "https://github.com/BryanHarrisScripts/PlotPickle";

const aboutSections = [
  ["#about-facts", "Product facts"],
  ["#about-principles", "Principles"],
  ["#about-system", "System"],
  ["#about-help", "Help and support"],
] as const;

export default function AboutPlotPicklePage() {
  return (
    <>
      <a className={styles.skipLink} href="#about-main">Skip to main content</a>
      <main className={styles.page} id="about-main" tabIndex={-1}>
        <header className={styles.hero}>
          <div>
            <span>About · Origins · Product Principles</span>
            <h1>{PLOTPICKLE_POSITIONING.hero}</h1>
            <p>
              PlotPickle is a local-first, AI-native visual writing and creative direction studio built around Bryan Harris&apos;s 24 Blocks method. Writers shape concepts, words, images and cinematic possibilities in one portable PPF project, then decide what becomes reusable storyworld canon.
            </p>
            <nav className={styles.actions} aria-label="About PlotPickle actions">
              <Link className={styles.primaryAction} href="/">Open PlotPickle</Link>
              <Link href="/read-learn?module=why-plotpickle-works-in-layers">Learn why the layers connect</Link>
              <Link href="/legal">Copyright and licensing</Link>
              <Link href="/suggest-report">Suggest or report a problem</Link>
            </nav>
          </div>
          <aside>
            <strong>The writer&apos;s decisions define the work.</strong>
            <p>Tools may organize, diagnose, compare or propose. Nothing becomes canon until the writer or authorized project owner accepts it.</p>
          </aside>
        </header>

        <nav className={styles.sectionNav} aria-label="About page sections">
          {aboutSections.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
        </nav>

        <section className={styles.introGrid} aria-label="PlotPickle overview">
          <article><span>What it is</span><h2>A visual storyworld engine</h2><p>Structure, screenplay material, Whole Film, Graphic Novel, Storyboard, Production Shots, Animatic, Pitch and Reports use one connected project instead of parallel creative files.</p></article>
          <article><span>Why it exists</span><h2>Make movie logic visible</h2><p>Hooks, turning points, causality, arcs, character decisions and visual continuity stay visible while the project moves from script structure into connected previsualization.</p></article>
          <article><span>What it supports</span><h2>A clearer green-light conversation</h2><p>The goal is persuasive previsualization evidence that helps a creative team discuss whether the story, visual direction and production plan are ready for the next investment.</p></article>
          <article><span>What it is not</span><h2>Not a finishing system</h2><p>PlotPickle does not aim to replace Final Draft, a professional production crew, editorial, colour, sound finishing or a studio delivery pipeline.</p></article>
        </section>

        <section className={styles.panel} id="about-facts">
          <header><span>Current product facts</span><h2>Specific, testable descriptions</h2><p>The legacy vision included many experiments. These are the commitments that describe PlotPickle now.</p></header>
          <ul className={styles.factList}>{currentProductFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
        </section>

        <section className={styles.panel}>
          <header><span>How it evolved</span><h2>From Afterglow to one canonical project</h2><p>The earlier work was consolidated rather than erased. Historical names remain aliases, not current product architecture.</p></header>
          <div className={styles.timeline}>{plotPickleTimeline.map((item) => <article key={item.stage}><small>{item.stage}</small><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
          <Link className={styles.textLink} href="/read-learn?module=why-plotpickle-works-in-layers">Read how the product layers converged</Link>
        </section>

        <section className={styles.panel} id="about-principles">
          <header><span>Product principles</span><h2>Stable guidance for design and use</h2><p>Personal history and biography are preserved separately. These principles describe how PlotPickle should behave for every writer.</p></header>
          <div className={styles.principles}>{plotPicklePrinciples.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
        </section>

        <section className={styles.panel}>
          <header><span>Available visual path</span><h2>Different resolutions, one PPF source of truth</h2><p>These existing workspaces already connect screenplay structure to visual development, production shots, animatic playback and decision evidence.</p></header>
          <div className={styles.flow}>{pageToProductionStages.map((stage, index) => <div key={stage}><strong>{stage}</strong>{index < pageToProductionStages.length - 1 ? <span aria-hidden="true">→</span> : null}</div>)}</div>
          <p className={styles.callout}>{PLOTPICKLE_POSITIONING.ppf}</p>
        </section>

        <section className={styles.panel}>
          <header><span>Complete visual storyworld core</span><h2>Use the connected tools available now</h2><p>The PPF, Storyworld Map, visual-development workspaces, previsualization and review evidence form a complete local-first product. External rendering and scheduling engines remain optional future extensions.</p></header>
          <div className={styles.principles}>
            {STORYWORLD_CORE_LOOP.map((step) => (
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
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>Legacy feature convergence map</caption>
              <thead>
                <tr><th scope="col">Legacy concept</th><th scope="col">PlotPickle evolution</th></tr>
              </thead>
              <tbody>
                {convergenceMap.map(([legacy, current]) => <tr key={legacy}><th scope="row">{legacy}</th><td>{current}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.systemCard} id="about-system" aria-label="PlotPickle system information">
          <div><span>Application</span><strong>PlotPickle {packageInfo.version}</strong></div>
          <div><span>Project schema</span><strong>{schemaVersion}</strong></div>
          <div><span>Distribution</span><strong>Downloadable local server</strong></div>
          <div><span>Software licence</span><strong>{packageInfo.license}</strong></div>
          <div><span>Educational material</span><strong>CC BY-SA 4.0 where identified</strong></div>
          <div><span>User projects</span><strong>Not automatically licensed</strong></div>
        </section>

        <section className={styles.supportPanel} id="about-help" aria-labelledby="about-help-title">
          <div>
            <span>Help and support</span>
            <h2 id="about-help-title">Choose the path that matches the problem</h2>
            <p>Use the in-app form for a product suggestion or reproducible problem. Use the source repository for code, release and contribution context. Licensing details remain on the dedicated legal page.</p>
          </div>
          <div className={styles.supportActions}>
            <Link className={styles.primaryAction} href="/suggest-report">Open Suggest / Report</Link>
            <a href={sourceRepository} target="_blank" rel="noreferrer" aria-label="Open the PlotPickle source repository (opens in a new tab)">Source repository</a>
            <Link href="/legal">Read licences and rights</Link>
          </div>
        </section>

        <footer className={styles.footer}>
          <div><strong>Historical boundary</strong><p>OpenStory Studio, separate GPTs, web3, tokens, DAOs, revenue promises, autonomous-agent orchestration and required public collaboration describe earlier experiments, not current PlotPickle commitments.</p></div>
          <nav aria-label="About page resources">
            <a href={sourceRepository} target="_blank" rel="noreferrer" aria-label="Source repository (opens in a new tab)">Source repository</a>
            <Link href="/legal">Licences and rights</Link>
            <Link href="/read-learn">Read & Learn</Link>
          </nav>
        </footer>
      </main>
    </>
  );
}
