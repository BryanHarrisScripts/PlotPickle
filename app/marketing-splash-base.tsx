"use client";

/* eslint-disable @next/next/no-img-element -- Marketing artwork is served from PlotPickle's local public assets. */

import {
  COLLABORATION_NAVIGATION,
  OPEN_SOURCE_FOUNDATIONS,
  PLOTPICKLE_POSITIONING,
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
  ["01", "Visual storyworld in one PPF", "Keep canon, characters, structure, screenplay material, visuals, shots, sound, approvals and provenance connected."],
  ["02", "Story logic you can see", "Use 24 Blocks, 96 mini-blocks and the learning system to expose hooks, turns, causality, arcs and continuity."],
  ["03", "Connected visual development", "Carry approved identities and locations through Graphic Novel panels, Storyboard frames and Production Shots."],
  ["04", "Review with evidence", "Use Feedback, Pitch and Reports to see readiness, continuity and unresolved decisions without automating the green-light decision."],
  ["05", "Local-first ownership", "Use the complete core before connecting AI, GitHub, Google, Buzz or a future media engine."],
] as const;

const featureHighlights = [
  ["Available now · Dashboard", "See the real current project", "Review the loaded story, Storyworld Overview, writing progress, GitHub state, local storage and unresolved canon decisions without fictional collaborators."],
  ["Available now · Graphic Novel + Storyboard", "Develop one approved visual language", "Carry canonical characters, locations and visual locks through panels, frames, production shots and animatic evidence."],
  ["Available now · Feedback + Reports", "Review meaning, not just files", "Keep structured feedback and resolution history permanent while Reports measure screenplay, continuity and production readiness."],
  ["Optional · Collab", "Propose and approve selectively", "Use GitHub Story Proposals, owner-controlled review, meetings and calendar coordination only when a repository is deliberately connected."],
  ["Optional · Buzz", "Add rooms and agents beside Collab", "Buzz provides rooms, media discussion and development activity. It remains dormant until configured under Settings → Integrations → Buzz."],
  ["Available now · Local-first", "Stay productive while disconnected", "Open, develop, visualize, review and export a PPF project without an AI key, Google account, Buzz runtime or required PlotPickle cloud service."],
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
        <a className={styles.brand} href="#top" aria-label="PlotPickle home">
          <img src="/brand/favicon/plotpickle-icon-128.png" alt="" aria-hidden="true" />
          <span><strong>PlotPickle</strong><small>Visual storyworld engine</small></span>
        </a>
        <nav className={styles.nav} aria-label="Splash page navigation">
          <a href="#studio">Product</a><a href="#builds">Desktop builds</a><a href="#collaboration">Collaboration</a><a href="#open-source">Open source</a>
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.sourceButton} href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">View source</a>
          <button className={styles.primaryButton} type="button" onClick={onEnter}>Enter PlotPickle</button>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>One installer · local-first · owner-controlled</p>
              <h1>Build better stories.<span>Review faster. Stay in control.</span></h1>
              <p className={styles.lede}>{PLOTPICKLE_POSITIONING.summary}</p>
              <div className={styles.heroActions}>
                <button className={styles.primaryButton} type="button" onClick={onEnter}>Open PlotPickle</button>
                <a className={styles.lightButton} href="#builds">Choose your build</a>
                <a className={styles.textButton} href="#studio">Explore the workflow</a>
              </div>
              <div className={styles.trustRow} aria-label="PlotPickle operating principles">
                <span>Portable PPF projects</span><span>Works without AI</span><span>Windows · macOS · Linux</span><span>Human-controlled approvals</span><span>Optional Buzz</span><span>GNU AGPLv3</span>
              </div>
            </div>

            <div className={styles.heroVisual} aria-label="Product-authentic PlotPickle Dashboard preview">
              <div className={styles.localBar}><span><i aria-hidden="true" /> Local project</span><code>127.0.0.1</code></div>
              <div className={styles.visualBody}>
                <div className={styles.visualHeading}>
                  <span>Dashboard · real project state</span>
                  <h2>One storyworld, visible from canon to approval.</h2>
                  <p>No mascot, fake avatar or fabricated online team. Every card represents a real project field or an honest connection state.</p>
                </div>
                <div className={styles.storyMap}>
                  <article><small>Storyworld Overview</small><strong>World · Characters · Locations</strong><span>24 Blocks · 96 mini-blocks · scenes and continuity</span></article>
                  <article><small>Writing Progress</small><strong>Development coverage</strong><span>Real planning evidence from the loaded PPF</span></article>
                  <article><small>GitHub Approvals</small><strong>Connected or local-only</strong><span>Story Proposals remain owner-controlled in Collab</span></article>
                  <article><small>Optional Buzz</small><strong>Not configured</strong><span>Dormant until Settings configuration is completed</span></article>
                  <article><small>Storage & Backups</small><strong>Local-first authority</strong><span>Projects remain separate from replaceable program files</span></article>
                  <article><small>Canon & Decisions</small><strong>Open questions</strong><span>Uncertainty stays visible instead of hiding in prose</span></article>
                </div>
              </div>
              <div className={styles.projectFooter}><span>PPF is the creative source of truth</span><span>GitHub is code and merge authority</span><span>Settings owns every optional connection</span></div>
            </div>
          </div>

          <div className={`${styles.wrap} ${styles.proofBar}`} aria-label="PlotPickle proof points">
            <div><strong>24</strong><span>story Blocks</span></div><div><strong>96</strong><span>mini-blocks and panels</span></div><div><strong>81</strong><span>learning modules</span></div><div><strong>3</strong><span>desktop builds</span></div><div><strong>1</strong><span>canonical PPF storyworld</span></div>
          </div>
        </section>

        <section className={styles.componentStrip} aria-label="Connected PlotPickle creative spine">
          <div className={styles.wrap}>{components.map((component) => <article key={component.id}><img src={component.icon} alt="" aria-hidden="true" /><div><strong>{component.label}</strong><span>{component.title}</span></div></article>)}</div>
        </section>

        <section className={`${styles.section} ${styles.studio}`} id="studio">
          <div className={styles.wrap}>
            <div className={styles.sectionHeading}><p>Why PlotPickle</p><h2>Visualize the story logic. Build the proof.</h2><span>PlotPickle focuses on structure, continuity, previsualization and review evidence while people retain authorship and approval authority.</span></div>
            <div className={styles.reasonGrid}>{reasons.map(([number, title, description]) => <article className={styles.reasonCard} key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>

            <div className={styles.workflowHeading}><div><p>One connected application</p><h2>The complete current workspace model.</h2></div><span>Settings configures services. Collab and Buzz use those connections without becoming a second source of canon.</span></div>
            <div className={styles.workflowGrid}>
              {[...PRIMARY_WORKFLOW_NAVIGATION, ...COLLABORATION_NAVIGATION].map((workspace, index) => <article key={workspace.id} data-zone={workspace.zone}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{workspace.label}</strong><p>{workspace.description}</p></div></article>)}
            </div>

            <div className={styles.workflowHeading}><div><p>Product-authentic capabilities</p><h2>Available features and optional connections are clearly separated.</h2></div><span>Native bundled Buzz binaries are not advertised as shipped until checksums, licences and clean-machine tests exist.</span></div>
            <div className={styles.featureGrid}>{featureHighlights.map(([eyebrow, title, description]) => <article data-status="available" key={title}><span>{eyebrow}</span><h3>{title}</h3><p>{description}</p><small>Human-controlled · local-first · inspectable</small></article>)}</div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.builds}`} id="builds">
          <div className={`${styles.wrap} ${styles.buildLayout}`}>
            <div className={styles.buildCopy}><p className={styles.kicker}>Windows · macOS · Linux</p><h2>One application. Three desktop packages.</h2><p>Each release candidate is built on its target operating system and published with a SHA-256 checksum. There is no required PlotPickle cloud account, administrator installation or background Windows service.</p><ul><li>One installer experience</li><li>Projects separated from program files</li><li>Reusable local runtime and recovery tools</li><li>Optional connections remain disconnected by default</li></ul><a className={styles.sourceLink} href={downloadUrl} target="_blank" rel="noreferrer">Open release downloads</a></div>
            <div className={styles.buildCards}>{PLOTPICKLE_DESKTOP_BUILDS.map((build, index) => <article key={build.id}><div className={styles.platformMark} aria-hidden="true">{String(index + 1).padStart(2, "0")}</div><div className={styles.buildCardCopy}><span>Desktop build</span><h3>{build.platform}</h3><p>{build.detail}</p><dl><div><dt>Archive</dt><dd>{build.archive}</dd></div><div><dt>Launcher</dt><dd>{build.launcher}</dd></div></dl></div><a href={downloadUrl} target="_blank" rel="noreferrer">Get {build.platform}</a></article>)}</div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.aiSection}`}>
          <div className={`${styles.wrap} ${styles.aiLayout}`}>
            <div className={styles.aiCopy}><p className={styles.kicker}>Optional assistance with visible human control</p><h2>Choose the helper. Keep the decision.</h2><p>AI, GitHub, Google and Buzz remain disconnected until deliberately configured. Credentials stay outside PPF projects, and nothing becomes canonical until a person approves it.</p><div className={styles.guardrails}><span>Credentials stay outside projects</span><span>Prompts and suggestions remain reviewable</span><span>Failed connections never block writing</span><span>Buzz is dormant by default</span></div></div>
            <div className={styles.aiChoices}>{aiChoices.map(([title, description]) => <article key={title}><strong>{title}</strong><span>{description}</span></article>)}</div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.collaboration}`} id="collaboration">
          <div className={`${styles.wrap} ${styles.collaborationLayout}`}>
            <div className={styles.collaborationCopy}><p className={styles.kicker}>Collab and Buzz have different jobs</p><h2>Approve formally. Discuss freely. Preserve canon.</h2><p>Collab owns GitHub Story Proposals, approvals, meetings and calendars. Buzz adds optional rooms, agents, media discussion and development activity. Feedback remains the permanent review record.</p><div className={styles.roles}>{collaborationRoles.map((role) => <span key={role}>{role}</span>)}</div><ul><li>Only a human GitHub merge changes shared canonical material</li><li>Buzz messages and agent suggestions never become PPF canon automatically</li><li>Developer Mode uses isolated worktrees and branch-only publishing</li><li>Settings owns connection setup, lifecycle, recovery and removal</li></ul></div>
            <div className={styles.collaborationImage}><img src="/brand/marketing/plotpickle-multi-server-collaboration.svg" alt="Complete PlotPickle installations collaborating through one owner-controlled GitHub film repository" /></div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.openSource}`} id="open-source">
          <div className={styles.wrap}><div className={styles.sectionHeading}><p>Open source with clear boundaries</p><h2>Open software. Open method. Your story.</h2><span>PlotPickle separates software rights, educational material and each creator's original work.</span></div><div className={styles.openGrid}>{OPEN_SOURCE_FOUNDATIONS.map((foundation) => <article key={foundation.label}><span>{foundation.label}</span><h3>{foundation.title}</h3><p>{foundation.summary}</p></article>)}</div></div>
        </section>

        <section className={styles.finalSection}><div className={`${styles.wrap} ${styles.finalCard}`}><div><span>PlotPickle</span><h2>Shape the storyworld. Review the evidence. Stay in control.</h2><p>Use the complete local core now, then add GitHub, Google, AI or Buzz only when the project truly needs them.</p></div><div className={styles.finalActions}><button className={styles.primaryButton} type="button" onClick={onEnter}>Enter PlotPickle</button><a className={styles.lightButton} href={downloadUrl} target="_blank" rel="noreferrer">View all three builds</a></div></div></section>
      </main>

      <footer className={styles.footer}><div className={styles.wrap}><span>Visual storyworld collaboration and previsualization engine</span><nav aria-label="PlotPickle information"><a href="/about">About</a><a href="/legal">Licensing</a><a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source</a></nav><span>Windows · macOS · Linux</span></div></footer>
    </div>
  );
}
