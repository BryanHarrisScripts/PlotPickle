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
  ["01", "Learn while you build", "Use 81 self-paced modules, local guides and the open Afterglow example to move from story fundamentals into a working project."],
  ["02", "See the whole story graph", "Map characters, locations, beats, scenes, arcs and dependencies as one connected storyworld instead of scattered documents."],
  ["03", "Keep one portable PPF", "Carry canon, story logic, screenplay material, visuals, feedback, approvals and provenance in one open, portable project."],
  ["04", "Test story logic visually", "Use 24 Blocks and 96 mini-blocks to expose hooks, turning points, causality, continuity and unresolved story decisions."],
  ["05", "Write and pitch visually", "Move from structure to screenplay, Graphic Novel, Storyboard, Production Shots, Pitch and Reports without rebuilding the story each time."],
  ["06", "Invite feedback without losing canon", "Use Buzz community discussion, GitHub Story Proposals or the sanitized Suggest / Report path while every official change remains human-approved."],
] as const;

const operatingModes = [
  {
    title: "Local Story Mode",
    subtitle: "Private creation on this computer",
    status: "PlotPickle installed locally",
    experience: "PlotPickle Playhouse · local compute",
    storyline: "Afterglow or your own local story",
    learning: "Learn workspace · 81 modules · local guides",
    collaboration: "Not required",
    data: "PPF · canonical JSON · assets · rolling backups",
    cost: "Lowest ongoing cost · minimal paid-token use",
  },
  {
    title: "Writers’ Room Mode",
    subtitle: "Community discussion through Buzz",
    status: "PlotPickle installed locally · Buzz optional",
    experience: "PlotPickle Playhouse · Buzz Community",
    storyline: "Afterglow or your story shared through Buzz context",
    learning: "Learn workspace · 81 modules · local guides",
    collaboration: "Rooms · messages · huddles · canon-safe proposals",
    data: "Local PPF plus community discussion references",
    cost: "Local core first · collaboration added only when needed",
  },
  {
    title: "Cloud Collab Mode",
    subtitle: "Reviewed history across machines",
    status: "PlotPickle installed locally · GitHub optional",
    experience: "PlotPickle Playhouse · GitHub · optional cloud compute",
    storyline: "Afterglow or your story through a GitHub repository",
    learning: "Learn workspace · 81 modules · local guides",
    collaboration: "Branches · Story Proposals · revision history",
    data: "Local PPF plus GitHub repository history",
    cost: "Local work by default · remote compute only by choice",
  },
] as const;

const featureHighlights = [
  ["Available now · Dashboard", "See the real current project", "Review the loaded story, Storyworld Overview, writing progress, GitHub state, local storage and unresolved canon decisions without fictional collaborators."],
  ["Available now · Graphic Novel + Storyboard", "Develop one approved visual language", "Carry canonical characters, locations and visual locks through panels, frames, production shots and animatic evidence."],
  ["Available now · Feedback + Reports", "Review meaning, not just files", "Keep structured feedback and resolution history permanent while Reports measure screenplay, continuity and production readiness."],
  ["Optional · Collab", "Propose and approve selectively", "Use GitHub Story Proposals, owner-controlled review, meetings and calendar coordination only when a repository is deliberately connected."],
  ["Optional · Buzz", "Add rooms and agents beside Collab", "Buzz provides rooms, media discussion and development activity. It remains dormant until configured under Settings → Integrations → Buzz."],
  ["Available now · Suggest / Report", "Turn feedback into a reviewed GitHub draft", "Create a sanitized feature, bug or usability report without attaching story files, local paths or credentials. The user reviews and submits it explicitly."],
  ["Optional · ComfyUI + native H3", "Choose local creative compute deliberately", "Connect user-owned ComfyUI models and unlock native MiniMax H3 only when an official-source workflow, required nodes, model files and compatible hardware are verified."],
  ["Available now · Local-first", "Stay productive while disconnected", "Open, develop, visualize, review and export a PPF project without an AI key, Google account, Buzz runtime or required PlotPickle cloud service."],
] as const;

const aiChoices = [
  ["No AI", "Every core writing and project feature remains available."],
  ["OpenAI API or MiniMax cloud", "Bring your own provider account, API key and billing through the encrypted local credential gateway."],
  ["Local or compatible model", "Use Ollama or ComfyUI with user-owned models. Native MiniMax H3 stays locked until an official-source workflow is verified, and not every computer can run every model."],
  ["Manual prompt export", "Prepare context without giving a provider project access."],
  ["GitHub account", "Bring your own GitHub account and story repository for branches, Story Proposals and owner-approved merges."],
  ["Buzz / BuilderLab account", "Bring your own Buzz or BuilderLab account when you choose Writers’ Room community discussion."],
  ["Provider account and billing", "Bring your own cloud-provider account, key and billing only for the paid services you deliberately enable."],
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
          <a href="#studio">Product</a><a href="#modes">Three modes</a><a href="#builds">Builds</a><a href="#collaboration">Collaboration</a><a href="#open-source">Open source</a>
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
              <p className={styles.kicker}>Learn the craft · see the logic · own the story</p>
              <h1>Stop losing the story<span>between the notes, drafts and visuals.</span></h1>
              <p className={styles.lede}>PlotPickle is a self-learning visual story studio. Build one connected story graph, preserve it in a portable PPF, test the logic, write visually, shape the pitch and invite feedback without surrendering canon.</p>
              <div className={styles.heroActions}>
                <button className={styles.primaryButton} type="button" onClick={onEnter}>Open PlotPickle</button>
                <a className={styles.lightButton} href="#studio">See what connects</a>
                <a className={styles.textButton} href="#modes">Compare the three modes</a>
              </div>
              <div className={styles.trustRow} aria-label="PlotPickle operating principles">
                <span>Portable PPF projects</span><span>Works without AI</span><span>Windows · macOS · Linux</span><span>Encrypted local credentials</span><span>Human-controlled approvals</span><span>Optional Buzz</span><span>GNU AGPLv3</span>
              </div>
            </div>

            <div className={styles.heroVisual} aria-label="Product-authentic PlotPickle Dashboard preview">
              <div className={styles.localBar}><span><i aria-hidden="true" /> Local project</span><code>127.0.0.1</code></div>
              <div className={styles.visualBody}>
                <div className={styles.visualHeading}>
                  <span>One living story graph</span>
                  <h2>Learn it. Map it. Write it. Show it.</h2>
                  <p>Afterglow demonstrates the complete path, while every module, visual and decision stays connected to the same PPF storyworld.</p>
                </div>
                <div className={styles.storyMap}>
                  <article><small>Self-learning</small><strong>81 guided modules</strong><span>Story craft beside the work, not in a separate course</span></article>
                  <article><small>Story graph</small><strong>World · Characters · Locations</strong><span>24 Blocks · 96 mini-blocks · scenes, arcs and continuity</span></article>
                  <article><small>Portable PPF</small><strong>One creative source of truth</strong><span>Canon, writing, visuals, feedback and provenance stay connected</span></article>
                  <article><small>Visual writing</small><strong>Graphic Novel · Storyboard</strong><span>Turn structural choices into readable visual proof</span></article>
                  <article><small>Visual pitch</small><strong>Pitch · Reports · evidence</strong><span>Show what the project is and what still needs a decision</span></article>
                  <article><small>Community feedback</small><strong>Buzz · GitHub · Suggest / Report</strong><span>Discuss, propose or report without allowing conversation to rewrite canon</span></article>
                </div>
              </div>
              <div className={styles.projectFooter}><span>PPF is the creative source of truth</span><span>GitHub is code and merge authority</span><span>Settings owns every optional connection and credential</span></div>
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
            <div className={styles.sectionHeading}><p>From interest to proof</p><h2>Learn the craft inside the story you are building.</h2><span>PlotPickle connects learning, structure, writing, visualization, pitch and feedback so each step strengthens the same storyworld.</span></div>
            <div className={styles.reasonGrid}>{reasons.map(([number, title, description]) => <article className={styles.reasonCard} key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>

            <div className={styles.workflowHeading}><div><p>One connected application</p><h2>The complete current workspace model.</h2></div><span>Settings configures services. Collab and Buzz use those connections without becoming a second source of canon.</span></div>
            <div className={styles.workflowGrid}>
              {[...PRIMARY_WORKFLOW_NAVIGATION, ...COLLABORATION_NAVIGATION].map((workspace, index) => <article key={workspace.id} data-zone={workspace.zone}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{workspace.label}</strong><p>{workspace.description}</p></div></article>)}
            </div>

            <div className={styles.workflowHeading}><div><p>Product-authentic capabilities</p><h2>Available features and optional connections are clearly separated.</h2></div><span>Native bundled Buzz binaries are not advertised as shipped until checksums, licences and clean-machine tests exist.</span></div>
            <div className={styles.featureGrid}>{featureHighlights.map(([eyebrow, title, description]) => <article data-status="available" key={title}><span>{eyebrow}</span><h3>{title}</h3><p>{description}</p><small>Human-controlled · local-first · inspectable</small></article>)}</div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.modes}`} id="modes">
          <div className={styles.wrap}>
            <div className={styles.sectionHeading}><p>One project · three ways to work</p><h2>Start privately. Add people only when the story needs them.</h2><span>PlotPickle remains installed locally in every mode. Afterglow, the Learn workspace and the PPF story model flow through all three.</span></div>
            <div className={styles.modeComparison}>
              {operatingModes.map((mode) => <article key={mode.title}>
                <header><span>{mode.status}</span><h3>{mode.title}</h3><p>{mode.subtitle}</p></header>
                <dl>
                  <div><dt>User experience</dt><dd>{mode.experience}</dd></div>
                  <div><dt>Storyline</dt><dd>{mode.storyline}</dd></div>
                  <div><dt>Learning</dt><dd>{mode.learning}</dd></div>
                  <div><dt>Data &amp; storage</dt><dd>{mode.data}</dd></div>
                  <div><dt>Collaboration</dt><dd>{mode.collaboration}</dd></div>
                  <div><dt>Cost profile</dt><dd>{mode.cost}</dd></div>
                </dl>
              </article>)}
            </div>
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
            <div className={styles.aiCopy}><p className={styles.kicker}>Local ComfyUI · cloud providers · no AI</p><h2>Choose the compute path. Keep the decision.</h2><p>AI, GitHub, Google and Buzz remain disconnected until deliberately configured. Native MiniMax H3 activates only after official-source workflow, node, model-file and hardware checks pass; not every computer can run every model, and nothing becomes canonical until a person approves it.</p><div className={styles.guardrails}><span>Credentials are encrypted for the current operating-system user</span><span>No silent model or custom-node downloads</span><span>No automatic paid cloud fallback</span><span>Buzz is dormant by default</span><span>Every generated asset remains reviewable</span></div></div>
            <div className={styles.aiChoices}>{aiChoices.map(([title, description]) => <article key={title}><strong>{title}</strong><span>{description}</span></article>)}</div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.collaboration}`} id="collaboration">
          <div className={`${styles.wrap} ${styles.collaborationLayout}`}>
            <div className={styles.collaborationCopy}><p className={styles.kicker}>Collab and Buzz have different jobs</p><h2>Approve formally. Discuss freely. Preserve canon.</h2><p>Collab owns GitHub Story Proposals, approvals, meetings and calendars. Buzz adds optional rooms, agents, media discussion and development activity. Suggest / Report creates a sanitized GitHub draft for community feedback, while Feedback remains the permanent review record.</p><div className={styles.roles}>{collaborationRoles.map((role) => <span key={role}>{role}</span>)}</div><ul><li>Only a human GitHub merge changes shared canonical material</li><li>Buzz messages and agent suggestions never become PPF canon automatically</li><li>Suggest / Report never attaches story files, credentials or local paths automatically</li><li>Developer Mode uses isolated worktrees and branch-only publishing</li><li>Settings owns connection setup, lifecycle, recovery and removal</li></ul></div>
            <div className={styles.collaborationImage}><img src="/brand/marketing/plotpickle-multi-server-collaboration.svg" alt="Complete PlotPickle installations collaborating through one owner-controlled GitHub film repository" /></div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.openSource}`} id="open-source">
          <div className={styles.wrap}><div className={styles.sectionHeading}><p>Open source with clear boundaries</p><h2>Open software. Open method. Your story.</h2><span>PlotPickle separates software rights, educational material and each creator&apos;s original work.</span></div><div className={styles.openGrid}>{OPEN_SOURCE_FOUNDATIONS.map((foundation) => <article key={foundation.label}><span>{foundation.label}</span><h3>{foundation.title}</h3><p>{foundation.summary}</p></article>)}</div></div>
        </section>

        <section className={styles.finalSection}><div className={`${styles.wrap} ${styles.finalCard}`}><div><span>Start with a working story</span><h2>Open Afterglow. See the graph. Then build your own.</h2><p>Use the complete local core now, learn through the example, and add ComfyUI, MiniMax H3, Buzz, GitHub or provider accounts only when the project truly needs them.</p></div><div className={styles.finalActions}><button className={styles.primaryButton} type="button" onClick={onEnter}>Load Afterglow</button><a className={styles.lightButton} href={downloadUrl} target="_blank" rel="noreferrer">Get the open-source build</a></div></div></section>
      </main>

      <footer className={styles.footer}><div className={styles.wrap}><span>Visual storyworld collaboration and previsualization engine</span><nav aria-label="PlotPickle information"><a href="/about">About</a><a href="/legal">Licensing</a><a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source</a></nav><span>Windows · macOS · Linux</span></div></footer>
    </div>
  );
}
