"use client";

/* eslint-disable @next/next/no-img-element -- Marketing artwork is served from PlotPickle's local public assets. */

import {
  OPEN_SOURCE_FOUNDATIONS,
  PLOTPICKLE_POSITIONING,
  PLOTPICKLE_DESKTOP_BUILDS,
  PRIMARY_WORKFLOW_NAVIGATION,
  STORYWORLD_PROTOTYPE_LOOP,
} from "@/lib/product-direction";
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
    number: "01",
    title: "Visual storyworld in one PPF",
    description: "Keep canon, characters, structure, screenplay material, visuals, shots, sound and provenance connected in one portable creative source of truth.",
  },
  {
    number: "02",
    title: "Story logic you can see",
    description: "Use 24 Blocks, 96 mini-blocks and the learning system to expose hooks, turning points, causality, arcs and continuity across the whole movie.",
  },
  {
    number: "03",
    title: "Connected visual development",
    description: "Carry approved character identities, locations and visual language through Graphic Novel panels, Storyboard frames and Production Shots.",
  },
  {
    number: "04",
    title: "A path to a watchable prototype",
    description: "Develop approved visual material toward returned render assets, an Animatic prototype and evidence for a green-light decision.",
  },
  {
    number: "05",
    title: "Local-first ownership with optional AI",
    description: "Keep control of files, canon, approvals and providers. AI, external renderers and owner-controlled GitHub collaboration remain deliberate choices.",
  },
] as const;

const featureHighlights = [
  {
    status: "available",
    eyebrow: "Available now · Whole Film",
    title: "See the structure at two visual scales",
    description: "The existing Build wall displays 24 Blocks and 96 mini-blocks while preserving stable links to scenes, screenplay material and production work.",
    proof: "24 Blocks · 96 mini-blocks",
  },
  {
    status: "available",
    eyebrow: "Available now · Graphic Novel + Storyboard",
    title: "Develop one approved visual language",
    description: "Build a 96-panel Graphic Novel presentation and storyboard frames from canonical characters, locations, visual locks and directed prompts.",
    proof: "Visual continuity · provenance",
  },
  {
    status: "available",
    eyebrow: "Available now · Production Shots + Animatic",
    title: "Move from frames into timed previsualization",
    description: "Direct shots, attach keyframes, plan sound and play available visual material in the existing Animatic without claiming a finished movie.",
    proof: "Shots · timing · sound",
  },
  {
    status: "roadmap",
    eyebrow: "Conversion roadmap · Storyworld Map",
    title: "Upgrade Whole Film instead of adding another map",
    description: "Add relationships, hooks, turns, arcs, causality and continuity to the existing wall through a rebuildable derived index.",
    proof: "Whole Film → Storyworld Map",
  },
  {
    status: "roadmap",
    eyebrow: "Conversion roadmap · Shared rendering",
    title: "Generalize the visual tools already here",
    description: "Graphic Novel, Storyboard and Production Shots will compile provider-neutral render packages and share returned asset variations.",
    proof: "No duplicate renderer",
  },
  {
    status: "roadmap",
    eyebrow: "Conversion roadmap · Prototype",
    title: "Extend Animatic, Pitch and Reports",
    description: "Returned images and clips will assemble into a watchable prototype with review evidence for a green-light decision.",
    proof: "Prototype · review · green-light",
  },
] as const;

const aiChoices = [
  ["No AI", "Every core writing and project feature remains available."],
  ["OpenAI API", "Connect your own key through the private local gateway."],
  ["Local or compatible model", "Use Ollama or an OpenAI-compatible service."],
  ["Manual prompt export", "Prepare context without giving a provider project access."],
] as const;

const collaborationRoles = ["Writer", "Director", "Producer", "Actor", "Reviewer"] as const;

export default function MarketingSplash({ onEnter, downloadUrl, components }: MarketingSplashProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="PlotPickle Playhouse home">
          <img src="/brand/favicon/plotpickle-icon-128.png" alt="" aria-hidden="true" />
          <span>
            <strong>PlotPickle</strong>
            <small>PlotPickle Playhouse</small>
          </span>
        </a>
        <nav className={styles.nav} aria-label="Splash page navigation">
          <a href="#studio">How it works</a>
          <a href="#builds">Three builds</a>
          <a href="#open-source">Open source</a>
          <a href="#collaboration">Collaboration</a>
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.sourceButton} href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">
            View source
          </a>
          <button className={styles.primaryButton} type="button" onClick={onEnter}>
            Enter PlotPickle
          </button>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Visual storyworld · local-first · owner-controlled</p>
              <h1>See the whole movie<span>before you make it.</span></h1>
              <p className={styles.lede}>{PLOTPICKLE_POSITIONING.summary}</p>
              <div className={styles.heroActions}>
                <button className={styles.primaryButton} type="button" onClick={onEnter}>
                  Open PlotPickle
                </button>
                <a className={styles.lightButton} href="#builds">Choose your build</a>
                <a className={styles.textButton} href="#studio">See how it works</a>
              </div>
              <div className={styles.trustRow} aria-label="PlotPickle operating principles">
                <span>Portable PPF projects</span>
                <span>Works without AI</span>
                <span>No required cloud account</span>
                <span>Official local edition</span>
                <span>Human-controlled approvals</span>
                <span>GNU AGPLv3</span>
              </div>
            </div>

            <div className={styles.heroVisual} aria-label="PlotPickle storyworld-to-prototype product loop">
              <div className={styles.localBar}>
                <span><i aria-hidden="true" /> Running privately</span>
                <code>127.0.0.1</code>
              </div>
              <div className={styles.visualBody}>
                <div className={styles.visualHeading}>
                  <span>Storyworld-to-prototype loop</span>
                  <h2>One PPF. One connected visual path.</h2>
                  <p>Available tools are being converted into the prototype workflow—not replaced by duplicate engines.</p>
                </div>
                <div className={styles.storyMap}>
                  {STORYWORLD_PROTOTYPE_LOOP.map((step) => (
                    <article className={step.id === "prototype" ? styles.pitchPreview : undefined} data-status={step.status} key={step.id}>
                      <small>{step.statusLabel}</small>
                      <strong>{step.title}</strong>
                      <span>{step.summary}</span>
                      {step.id === "prototype" ? <div aria-hidden="true"><i /><i /><i /><i /></div> : null}
                    </article>
                  ))}
                </div>
              </div>
              <div className={styles.projectFooter}>
                <span>PPF is the creative source of truth</span>
                <span>Current tools are available now</span>
                <span>Conversions are clearly labelled</span>
              </div>
            </div>
          </div>

          <div className={`${styles.wrap} ${styles.proofBar}`} aria-label="PlotPickle proof points">
            <div><strong>24</strong><span>story Blocks</span></div>
            <div><strong>96</strong><span>mini-blocks and panels</span></div>
            <div><strong>81</strong><span>learning modules</span></div>
            <div><strong>3</strong><span>desktop builds</span></div>
            <div><strong>1</strong><span>connected project</span></div>
          </div>
        </section>

        <section className={styles.componentStrip} aria-label="Connected PlotPickle creative spine">
          <div className={styles.wrap}>
            {components.map((component) => (
              <article key={component.id}>
                <img src={component.icon} alt="" aria-hidden="true" />
                <div>
                  <strong>{component.label}</strong>
                  <span>{component.title}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.studio}`} id="studio">
          <div className={styles.wrap}>
            <div className={styles.sectionHeading}>
              <p>Five reasons to use PlotPickle</p>
              <h2>Visualize the story logic. Build the proof.</h2>
              <span>PlotPickle focuses on the movie&apos;s structure, hooks, turning points, continuity and previsualization—not Final Draft parity or studio finishing.</span>
            </div>
            <div className={styles.reasonGrid}>
              {reasons.map((reason) => (
                <article className={styles.reasonCard} key={reason.number}>
                  <span>{reason.number}</span>
                  <h3>{reason.title}</h3>
                  <p>{reason.description}</p>
                </article>
              ))}
            </div>

            <div className={styles.workflowHeading}>
              <div>
                <p>One connected application</p>
                <h2>Ten workspaces supporting one visual storyworld.</h2>
              </div>
              <span>Introduction remains available inside Learn. Simple Start remains optional inside Plan.</span>
            </div>
            <div className={styles.workflowGrid}>
              {PRIMARY_WORKFLOW_NAVIGATION.map((workspace, index) => (
                <article key={workspace.id} data-zone={workspace.zone}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{workspace.label}</strong><p>{workspace.description}</p></div>
                </article>
              ))}
            </div>

            <div className={styles.workflowHeading}>
              <div>
                <p>Available now and conversion roadmap</p>
                <h2>Build on the visual tools already here.</h2>
              </div>
              <span>Roadmap cards describe planned conversions. They are not claims that PlotPickle can already render a complete movie.</span>
            </div>
            <div className={styles.featureGrid}>
              {featureHighlights.map((feature) => (
                <article data-status={feature.status} key={feature.title}>
                  <span>{feature.eyebrow}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <small>{feature.proof}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.builds}`} id="builds">
          <div className={`${styles.wrap} ${styles.buildLayout}`}>
            <div className={styles.buildCopy}>
              <p className={styles.kicker}>Three builds · one codebase</p>
              <h2>PlotPickle goes where the writer works.</h2>
              <p>
                Windows, macOS and Linux receive the same complete local-first studio. Each
                clean-machine tested release candidate is packaged on its target operating system,
                then published with a SHA-256 checksum.
              </p>
              <ul>
                <li>No separate feature editions</li>
                <li>No required PlotPickle cloud account</li>
                <li>No background Windows service or administrator requirement</li>
                <li>Projects remain separate from replaceable program files</li>
              </ul>
              <a className={styles.sourceLink} href={downloadUrl} target="_blank" rel="noreferrer">
                Open all release downloads
              </a>
            </div>
            <div className={styles.buildCards}>
              {PLOTPICKLE_DESKTOP_BUILDS.map((build, index) => (
                <article key={build.id}>
                  <div className={styles.platformMark} aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
                  <div className={styles.buildCardCopy}>
                    <span>Desktop build</span>
                    <h3>{build.platform}</h3>
                    <p>{build.detail}</p>
                    <dl>
                      <div><dt>Archive</dt><dd>{build.archive}</dd></div>
                      <div><dt>Launcher</dt><dd>{build.launcher}</dd></div>
                    </dl>
                  </div>
                  <a href={downloadUrl} target="_blank" rel="noreferrer" aria-label={`Open the ${build.platform} PlotPickle release download`}>
                    Get {build.platform}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.openSource}`} id="open-source">
          <div className={styles.wrap}>
            <div className={styles.sectionHeading}>
              <p>Open source with clear boundaries</p>
              <h2>Open software. Open method. Your story.</h2>
              <span>PlotPickle separates software rights, educational material, brand identity and the writer&apos;s original creative work.</span>
            </div>
            <div className={styles.openGrid}>
              {OPEN_SOURCE_FOUNDATIONS.map((foundation) => (
                <article key={foundation.label}>
                  <span>{foundation.label}</span>
                  <h3>{foundation.title}</h3>
                  <p>{foundation.summary}</p>
                </article>
              ))}
            </div>
            <div className={styles.openCallout}>
              <div>
                <span>Created in the open</span>
                <h3>Built from Bryan Elgin Harris&apos;s 24 Blocks method and the Afterglow story-development work.</h3>
                <p>Software is AGPL-3.0-or-later. Unless otherwise marked, the method and reusable documentation are CC BY-SA 4.0. Modifications and contributors remain documented in the repository.</p>
              </div>
              <div>
                <a className={styles.primaryButton} href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Explore the source</a>
                <a className={styles.darkButton} href="/legal">Read licensing and ownership</a>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.aiSection}`}>
          <div className={`${styles.wrap} ${styles.aiLayout}`}>
            <div className={styles.aiCopy}>
              <p className={styles.kicker}>Optional AI with visible human control</p>
              <h2>Choose the helper. Keep the decision.</h2>
              <p>
                PlotPickle can prepare bounded story context for writing, character imagery,
                Graphic Novel panels, storyboards and production shots. AI and future external
                renderers remain optional. Nothing becomes canonical until the project owner approves it.
              </p>
              <div className={styles.guardrails}>
                <span>Credentials stay outside projects</span>
                <span>Prompts remain reviewable</span>
                <span>Provenance travels with retained work</span>
                <span>Failed connections never block writing</span>
              </div>
            </div>
            <div className={styles.aiChoices}>
              {aiChoices.map(([title, description]) => (
                <article key={title}><strong>{title}</strong><span>{description}</span></article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.collaboration}`} id="collaboration">
          <div className={`${styles.wrap} ${styles.collaborationLayout}`}>
            <div className={styles.collaborationCopy}>
              <p className={styles.kicker}>Collaboration without surrendering the film</p>
              <h2>Propose changes. Review meaning. Approve selectively.</h2>
              <p>
                GitHub is optional. When connected, each collaborator can work in a complete
                PlotPickle installation and submit Story Proposals through their own branch.
                The Project Lead decides what joins the approved story.
              </p>
              <div className={styles.roles} aria-label="PlotPickle collaboration roles">
                {collaborationRoles.map((role) => <span key={role}>{role}</span>)}
              </div>
              <ul>
                <li>Private-by-default story repository setup</li>
                <li>Dialogue, character and production changes reviewed independently</li>
                <li>Approval controls, conflict review and guarded recovery</li>
                <li>Local work stays local until deliberately proposed or synchronized</li>
              </ul>
            </div>
            <div className={styles.collaborationImage}>
              <img src="/brand/marketing/plotpickle-multi-server-collaboration.svg" alt="Complete PlotPickle installations collaborating through one owner-controlled GitHub film repository" />
            </div>
          </div>
        </section>

        <section className={styles.finalSection}>
          <div className={`${styles.wrap} ${styles.finalCard}`}>
            <div>
              <span>PlotPickle Playhouse</span>
              <h2>Shape the storyworld. See the movie. Build the proof.</h2>
              <p>Start with the visual tools available now and keep every future prototype decision under your control.</p>
            </div>
            <div className={styles.finalActions}>
              <button className={styles.primaryButton} type="button" onClick={onEnter}>Enter PlotPickle</button>
              <a className={styles.lightButton} href={downloadUrl} target="_blank" rel="noreferrer">View all three builds</a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <span><strong>PlotPickle</strong> · Visual storyworld and AI previsualization engine</span>
          <nav aria-label="PlotPickle information">
            <a href="/about">About</a>
            <a href="/legal">Licensing</a>
            <a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source</a>
          </nav>
          <span>Windows · macOS · Linux</span>
        </div>
      </footer>
    </div>
  );
}
