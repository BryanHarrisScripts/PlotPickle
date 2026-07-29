"use client";

/* eslint-disable @next/next/no-img-element -- Marketing artwork is served from PlotPickle's local public assets. */

import {
  OPEN_SOURCE_FOUNDATIONS,
  PLOTPICKLE_DESKTOP_BUILDS,
  PRIMARY_WORKFLOW_NAVIGATION,
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
    title: "One studio for the whole film",
    description: "Move from learning and the first idea through planning, screenplay, storyboard, pitch, revision and production without splitting the story across disconnected tools.",
  },
  {
    number: "02",
    title: "A method you can see",
    description: "Shape four acts, twelve sequences, 24 Blocks and 96 mini-blocks, then carry those same story positions into scenes, pages, visuals, feedback and reports.",
  },
  {
    number: "03",
    title: "Visual continuity built in",
    description: "Lock approved character looks, define the Visual Bible, direct shots and keep references connected across 96 storyboard positions and the comic pitch deck.",
  },
  {
    number: "04",
    title: "AI is a choice, not a requirement",
    description: "Work with no AI, a local model, a compatible provider or your own OpenAI API connection. Generated suggestions never silently replace canonical story work.",
  },
  {
    number: "05",
    title: "Local ownership, open collaboration",
    description: "Keep writing on your computer, exchange portable .ppf packages and optionally use owner-controlled GitHub proposals for selective review and approval.",
  },
] as const;

const featureHighlights = [
  {
    eyebrow: "Learn and Plan",
    title: "81 lessons beside the work",
    description: "Search the craft library, open Introduction, study worked examples and apply guidance directly to the active story.",
    proof: "81 modules",
  },
  {
    eyebrow: "Write",
    title: "Treatment to shooting script",
    description: "Write connected scenes, action and dialogue; read the complete script; and exchange Fountain and Final Draft FDX files.",
    proof: "Flexible scenes",
  },
  {
    eyebrow: "Storyboard",
    title: "A consistent visual language",
    description: "Carry character identity locks, locations, shot direction, references and visual provenance through the entire film.",
    proof: "96 visual positions",
  },
  {
    eyebrow: "Pitch",
    title: "Automatic comic-book pitch deck",
    description: "Turn the canonical story into a 24-page, 96-panel black-and-white sketched deck with directed shots and editable dialogue bubbles.",
    proof: "24 pages · 96 panels",
  },
  {
    eyebrow: "Feedback and Refine",
    title: "Diagnose, discuss and approve",
    description: "Refine diagnoses and proposes. Feedback owns anchored review, Story Proposals, table reads, revision comparisons and explicit human approval.",
    proof: "Human approval",
  },
  {
    eyebrow: "Build and Reports",
    title: "From story wall to production",
    description: "Build owns production planning, Storyboard owns shots and animatic, and Reports presents continuity, readiness and production evidence without becoming another editor.",
    proof: "Page to production",
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
          <a href="#studio">Studio</a>
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
              <p className={styles.kicker}>Open · local-first · writer-controlled</p>
              <h1>Your whole film.<span>One open studio.</span></h1>
              <p className={styles.lede}>
                PlotPickle connects screenwriting, the 24 Blocks method, visual storyboarding,
                an automatic comic pitch, feedback, diagnostics and production planning in one
                project that remains under your control.
              </p>
              <div className={styles.heroActions}>
                <button className={styles.primaryButton} type="button" onClick={onEnter}>
                  Open the studio
                </button>
                <a className={styles.lightButton} href="#builds">Choose your build</a>
                <a className={styles.textButton} href="#studio">Explore the features</a>
              </div>
              <div className={styles.trustRow} aria-label="PlotPickle operating principles">
                <span>Works without AI</span>
                <span>No required cloud account</span>
                <span>Official local edition</span>
                <span>GNU AGPLv3</span>
              </div>
            </div>

            <div className={styles.heroVisual} aria-label="PlotPickle canonical film project overview">
              <div className={styles.localBar}>
                <span><i aria-hidden="true" /> Running privately</span>
                <code>127.0.0.1</code>
              </div>
              <div className={styles.visualBody}>
                <div className={styles.visualHeading}>
                  <span>Canonical story project</span>
                  <h2>One story. Every workspace.</h2>
                  <p>Stable story IDs keep planning, pages, frames, notes and production evidence connected.</p>
                </div>
                <div className={styles.storyMap}>
                  <article>
                    <small>Story architecture</small>
                    <strong>4 acts · 12 sequences</strong>
                    <span>24 Blocks · 96 mini-blocks</span>
                  </article>
                  <article>
                    <small>Screenplay</small>
                    <strong>Scenes stay connected</strong>
                    <span>Treatment · action · dialogue</span>
                  </article>
                  <article>
                    <small>Visual development</small>
                    <strong>Identity-aware frames</strong>
                    <span>Visual Bible · shots · provenance</span>
                  </article>
                  <article className={styles.pitchPreview}>
                    <small>Automatic Pitch</small>
                    <strong>Complete comic deck</strong>
                    <span>24 pages · 96 panels · editable dialogue</span>
                    <div aria-hidden="true"><i /><i /><i /><i /></div>
                  </article>
                </div>
              </div>
              <div className={styles.projectFooter}>
                <span>Local project folder</span>
                <span>Portable .ppf exchange</span>
                <span>Optional GitHub proposals</span>
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
              <h2>A complete creative system, not a pile of disconnected tools.</h2>
              <span>Everything reads and writes the same approved story, from first lesson to production report.</span>
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
                <p>One connected path</p>
                <h2>Ten clear workspaces from discovery to polish.</h2>
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

            <div className={styles.featureGrid}>
              {featureHighlights.map((feature) => (
                <article key={feature.title}>
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
                visual development and the comic pitch deck. Nothing becomes canonical until
                the writer deliberately approves it.
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
              <h2>Write the story. See the film. Keep it yours.</h2>
              <p>Enter the studio now, or choose the Windows, macOS or Linux release from one verified download page.</p>
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
          <span><strong>PlotPickle</strong> · Local-first screenplay and film development</span>
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
