"use client";

/* eslint-disable @next/next/no-img-element -- Marketing artwork is served from PlotPickle's local public assets. */

import styles from "./marketing-splash.module.css";

type ProductComponent = {
  id: string;
  label: string;
  title: string;
  summary: string;
  icon: string;
};

type MarketingSplashProps = {
  onEnter: () => void;
  downloadUrl: string;
  components: readonly ProductComponent[];
};

const reasons = [
  {
    title: "Complete screenplay studio",
    description: "Move from the first idea through 24 Blocks, 96 mini-blocks, treatment, screenplay, revision, visual development and production planning—all inside one connected project.",
    tags: ["Idea to screenplay", "Production planning", "One project"],
  },
  {
    title: "81-module learning system",
    description: "Use the Complete Learning Library, focused craft collections, worked examples and in-context guidance directly inside the writing process.",
    tags: ["Learn in context", "Worked examples"],
  },
  {
    title: "Visual continuity engine",
    description: "Carry approved character identities, world references, a Visual Bible and 96 storyboard frames through one consistent visual language.",
    tags: ["Identity locks", "Visual Bible"],
  },
  {
    title: "Local-first ownership with optional AI",
    description: "Control your projects, files, providers and every creative decision. Use AI deliberately—or work entirely without it.",
    tags: ["Private by default", "Approval first"],
  },
  {
    title: "Distributed PlotPickle collaboration",
    description: "Coordinate complete local or private web installations through an owner-controlled GitHub film repository.",
    tags: ["Local proposals", "Canonical merge"],
  },
] as const;

const dataNodes = [
  ["Story", "Premise, theme, foundations"],
  ["World", "Rules, locations, research"],
  ["Characters", "Arcs, relationships, voices"],
  ["Structure", "Acts, sequences, Blocks, scenes"],
  ["Screenplay", "Treatment, action and dialogue"],
  ["Visuals", "References, identities, frames"],
  ["Review", "Questions, approvals, revisions"],
  ["Production", "Breakdowns, schedule, reports"],
  ["Rights", "Sources, licences, provenance"],
] as const;

const roles = ["Writer", "Director", "Producer", "Actor", "Reviewer"] as const;

export default function MarketingSplash({ onEnter, downloadUrl, components }: MarketingSplashProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="PlotPickle Playhouse home">
          <img src="/brand/favicon/plotpickle-icon-128.png" alt="" aria-hidden="true" />
          <span><strong>PlotPickle</strong><small>PlotPickle Playhouse</small></span>
        </a>
        <nav className={styles.nav} aria-label="Marketing navigation">
          <a href="#reasons">Why PlotPickle</a>
          <a href="#whole-film">Whole-film project</a>
          <a href="#platform">Open platform</a>
          <a href="#collaboration">Collaboration</a>
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.sourceButton} href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">View source</a>
          <button className={styles.primaryButton} type="button" onClick={onEnter}>Enter PlotPickle</button>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={styles.wrap}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.kicker}><i aria-hidden="true" /> Local-first screenplay and film development</p>
                <h1>Your whole film.<br /><span>One canonical project.</span></h1>
                <p className={styles.lede}>PlotPickle connects story development, screenplay writing, learning, visual continuity, revision and production planning—without surrendering ownership of the work.</p>
                <div className={styles.heroActions}>
                  <button className={styles.primaryButton} type="button" onClick={onEnter}>Enter PlotPickle</button>
                  <a className={styles.lightButton} href="#reasons">See the complete studio <span aria-hidden="true">↓</span></a>
                </div>
                <div className={styles.trustRow} aria-label="PlotPickle operating principles">
                  <span>Works without AI</span><span>Optional providers</span><span>No required cloud account</span><span>Open-source AGPL</span>
                </div>
              </div>

              <div className={styles.projectVisual} aria-label="One canonical PlotPickle film project">
                <div className={styles.projectCard}>
                  <div className={styles.projectAccent} />
                  <div className={styles.projectHeading}>
                    <small>Active film project</small>
                    <h2>One story from idea to production</h2>
                    <p>Every workspace reads and writes the same approved project.</p>
                  </div>
                  <div className={styles.projectBody}>
                    <div className={styles.canonicalCard}>
                      <span>.ppf</span>
                      <div><strong>Canonical film project</strong><small>Portable · versioned · writer-controlled</small></div>
                    </div>
                    <div className={styles.projectDataGrid}>
                      <article><strong>Story foundations</strong><span>World, characters, theme, arcs</span></article>
                      <article><strong>Screenplay</strong><span>Treatment, scenes, dialogue</span></article>
                      <article><strong>Visual language</strong><span>Bible, identities, storyboard</span></article>
                      <article><strong>Production</strong><span>Breakdowns, reports, planning</span></article>
                    </div>
                  </div>
                </div>
                <article className={`${styles.floatCard} ${styles.floatOne}`}><strong>24 Blocks</strong><span>Four acts and twelve sequences</span></article>
                <article className={`${styles.floatCard} ${styles.floatTwo}`}><strong>81 lessons</strong><span>Guidance where the work happens</span></article>
                <article className={`${styles.floatCard} ${styles.floatThree}`}><strong>96 frames</strong><span>Story and visual continuity</span></article>
                <article className={`${styles.floatCard} ${styles.floatFour}`}><strong>Optional AI</strong><span>Suggestions require approval</span></article>
              </div>
            </div>

            <div className={styles.proofBar} aria-label="PlotPickle proof points">
              <div><strong>24</strong><span>story Blocks</span></div>
              <div><strong>96</strong><span>mini-blocks and frames</span></div>
              <div><strong>81</strong><span>learning modules</span></div>
              <div><strong>1</strong><span>canonical project</span></div>
              <div><strong>5</strong><span>collaboration roles</span></div>
            </div>
          </div>
        </section>

        <section className={styles.workflowStrip} aria-label="Connected PlotPickle workflow">
          <div className={styles.wrap}>
            {components.map((component) => (
              <article key={component.id}>
                <img src={component.icon} alt="" aria-hidden="true" />
                <div><strong>{component.label}</strong><span>{component.title}</span></div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.reasons}`} id="reasons">
          <div className={styles.wrap}>
            <div className={styles.sectionHeading}>
              <p>Five reasons to use PlotPickle</p>
              <h2>A complete studio—not another isolated writing tool.</h2>
              <span>The most important capabilities appear first, in the order a writer experiences the product.</span>
            </div>
            <div className={styles.reasonGrid}>
              {reasons.map((reason, index) => (
                <article className={styles.reasonCard} key={reason.title}>
                  <span className={styles.reasonNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{reason.title}</h3>
                  <p>{reason.description}</p>
                  <div className={styles.reasonTags}>{reason.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <i aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.wholeFilm}`} id="whole-film">
          <div className={`${styles.wrap} ${styles.modelLayout}`}>
            <div className={styles.modelCopy}>
              <p className={styles.kicker}>More than a screenplay file</p>
              <h2>The film remains connected as it grows.</h2>
              <p>PlotPickle treats the screenplay as part of a larger creative system. Story decisions, visual decisions, production evidence and ownership records remain attached to the same film.</p>
              <div className={styles.modelPoints}>
                <article><i aria-hidden="true">✓</i><div><strong>No duplicate project silos</strong><span>Planning, writing, visuals and reports use the same data.</span></div></article>
                <article><i aria-hidden="true">✓</i><div><strong>Every approved change has context</strong><span>Characters, scenes, Blocks and production records stay linked.</span></div></article>
                <article><i aria-hidden="true">✓</i><div><strong>Portable ownership and provenance</strong><span>Rights, sources, revisions and retained AI contributions travel with the project.</span></div></article>
              </div>
            </div>
            <div className={styles.modelMap}>
              <p>One canonical .ppf project</p>
              <div>{dataNodes.map(([title, detail]) => <article key={title}><strong>{title}</strong><span>{detail}</span></article>)}</div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.platform}`} id="platform">
          <div className={styles.wrap}>
            <div className={styles.sectionHeading}>
              <p>Built to remain yours</p>
              <h2>An open film-development platform.</h2>
              <span>PlotPickle can evolve with writers, schools, studios and independent production teams instead of locking them into one vendor&apos;s roadmap.</span>
            </div>
            <div className={styles.platformGrid}>
              <article><span>Open software</span><h3>Open and customizable</h3><p>Study, modify, redistribute and privately host PlotPickle under the AGPL. Teams can adapt the application to their workflows while preserving its open-source obligations.</p></article>
              <article><span>Extensible</span><h3>Plugin and SDK platform</h3><p>Typed project events, permission-controlled services and registration systems support commands, menus, panels and complete workspaces without surrendering the core project model.</p></article>
              <article><span>Portable</span><h3>Canonical whole-film data</h3><p>The project can include story, world, characters, voiceprints, arcs, screenplay, visuals, research, rights, review, production and collaboration information.</p></article>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.collaboration}`} id="collaboration">
          <div className={`${styles.wrap} ${styles.collaborationLayout}`}>
            <div className={styles.collaborationCopy}>
              <p className={styles.kicker}>Distributed collaboration</p>
              <h2>Complete installations. One approved film.</h2>
              <p>Every collaborator can use the complete PlotPickle product. Roles belong to people—not separate editions—and one person may hold several roles.</p>
              <div className={styles.roles}>{roles.map((role) => <span key={role}>{role}</span>)}</div>
              <div className={styles.collaborationNote}>Local work remains private until it is deliberately proposed or synchronized. Only an owner or maintainer merge changes the canonical <strong>.ppf</strong> project.</div>
            </div>
            <div className={styles.collaborationImage}>
              <img src="/brand/marketing/plotpickle-multi-server-collaboration.svg" alt="Complete PlotPickle installations collaborating through one owner-controlled GitHub film repository" />
            </div>
          </div>
        </section>

        <section className={styles.finalSection} id="download">
          <div className={`${styles.wrap} ${styles.finalCard}`}>
            <div><h2>Start with the story. Keep the whole film connected.</h2><p>Run PlotPickle locally, choose whether to connect AI, and retain control of every creative and technical decision.</p></div>
            <div className={styles.finalActions}>
              <button className={styles.primaryButton} type="button" onClick={onEnter}>Enter PlotPickle</button>
              <a className={styles.lightButton} href={downloadUrl} target="_blank" rel="noreferrer">Download for Windows</a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}><span><strong>PlotPickle Playhouse</strong> · Local-first screenplay and film development</span><span>Open software · Optional AI · Writer-controlled canon</span></div>
      </footer>
    </div>
  );
}
