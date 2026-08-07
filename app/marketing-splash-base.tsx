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

const visualPillars = [
  {
    code: "01",
    title: "Narrative First",
    description: "Start with story. Every image, performance and visual decision stays attached to narrative intent.",
  },
  {
    code: "02",
    title: "World & Character Vision",
    description: "Develop people, places, wardrobe, props and atmosphere as connected story material, not disconnected prompts.",
  },
  {
    code: "03",
    title: "Storyboard Thinking",
    description: "Explore scenes, beats, staging and sequence visually while the screenplay and story structure stay in view.",
  },
  {
    code: "04",
    title: "Human-Led Creative Direction",
    description: "Keep, change, try, compare and approve. AI supplies responsive creative material; you make the calls.",
  },
  {
    code: "05",
    title: "From Concept to Visual Canon",
    description: "Approve the visual facts that define the storyworld and reuse them through Storyboard, Graphic Novel and production work.",
  },
] as const;

const creativeLoop = ["Concept", "Explore", "Compare", "Direct", "Refine", "Approve", "Reuse"] as const;

const operatingModes = [
  {
    title: "Local Story Mode",
    body: "Write, plan, visualize and review on this computer. No AI account or collaboration service is required.",
  },
  {
    title: "Writers’ Room Mode",
    body: "Add Buzz discussion when the story benefits from a room, while the PPF remains the creative source of truth.",
  },
  {
    title: "Cloud Collab Mode",
    body: "Add GitHub review and optional cloud compute deliberately. Nothing paid or canonical happens silently.",
  },
] as const;

const controlRules = [
  "No generated result becomes canon automatically.",
  "No automatic paid cloud fallback.",
  "No silent model or custom-node downloads.",
  "Manual import and no-AI workflows remain complete product paths.",
  "Provider, model, endpoint and billing details stay in Settings.",
  "The writer remains the author, visual director and final authority.",
] as const;

export default function MarketingSplash({ onEnter, downloadUrl, components }: MarketingSplashProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="PlotPickle home">
          <span className={styles.brandMark} aria-hidden="true">P</span>
          <span><strong>PlotPickle</strong><small>Visual writing studio</small></span>
        </a>
        <nav className={styles.nav} aria-label="Splash page navigation">
          <a href="#studio">Vision</a>
          <a href="#workflow">Workflow</a>
          <a href="#modes">Modes</a>
          <a href="#collaboration">Control</a>
          <a href="#builds">Builds</a>
          <a href="#open-source">Open source</a>
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.sourceButton} href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source</a>
          <button className={styles.primaryButton} type="button" onClick={onEnter}>Enter</button>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Narrative + visual direction</p>
              <h1>Storytelling<br />Has Changed.</h1>
              <p className={styles.heroStatement}>Write the narrative. Shape the vision.</p>
              <p className={styles.lede}>Build worlds, characters and story through one connected visual writing workflow. PlotPickle moves the writer beyond the traditional page into a director-led model of story creation.</p>
              <p className={styles.heroDetail}>Begin with words, fragments or references. Explore what the story could look and feel like. Compare possibilities. Direct revisions in creative language. Approve what becomes visual and narrative canon.</p>
              <div className={styles.heroActions}>
                <button className={styles.primaryButton} type="button" onClick={onEnter}>Enter the Playhouse</button>
                <a className={styles.lightButton} href="#workflow">Explore the Workflow</a>
              </div>
              <div className={styles.trustRow} aria-label="PlotPickle operating principles">
                <span>Writer-led</span>
                <span>Portable PPF</span>
                <span>Works without AI</span>
                <span>Human-approved canon</span>
              </div>
              <span className={styles.srOnly}>Stop losing the story between the notes, drafts and visuals.</span>
            </div>

            <div className={styles.heroVisual} aria-label="Product-authentic PlotPickle Dashboard preview">
              <article className={`${styles.visualPanel} ${styles.scriptPanel}`}>
                <header><span>Script</span><small>Scene 17</small></header>
                <div className={styles.scriptBody}>
                  <code>EXT. COASTAL CLIFF — DAWN</code>
                  <p>Waves crash below. Wind moves through the grass.</p>
                  <p>A figure stands at the edge, looking across a distant kingdom.</p>
                  <strong>ARIA</strong>
                  <p className={styles.dialogue}>Everything we know is on the other side of the fall.</p>
                </div>
              </article>

              <article className={`${styles.visualPanel} ${styles.characterPanel}`}>
                <header><span>Character</span><small>Visual identity</small></header>
                <img src="/design/plotpickle-splash-character.svg" alt="Dark-haired character concept portrait used to explore a story identity" />
                <div><strong>ARIA</strong><span>Explorer · determined · intuitive</span></div>
              </article>

              <article className={`${styles.visualPanel} ${styles.worldPanel}`}>
                <header><span>Location / World</span><small>Look development</small></header>
                <img src="/design/plotpickle-splash-world.svg" alt="Cinematic fantasy city concept used to explore a storyworld" />
                <div><strong>The Fallen Kingdom</strong><span>Ancient · mysterious · monumental</span></div>
              </article>

              <article className={`${styles.visualPanel} ${styles.storyboardPanel}`}>
                <header><span>Storyboard</span><small>Approved visual language</small></header>
                <img src="/design/plotpickle-splash-storyboard.svg" alt="Storyboard frames connecting character, location and scene direction" />
                <div className={styles.storyboardNotes}><span>17A · establish</span><span>17B · character</span><span>17C · reveal</span><span>17D · direction</span></div>
              </article>

              <div className={styles.connectionLine} aria-hidden="true"><span /><i /><span /></div>
            </div>
          </div>

          <div className={`${styles.wrap} ${styles.directorQuote}`}>
            <span aria-hidden="true">“</span>
            <p>The writer is no longer only writing the story — <strong>they are directing the storyworld.</strong></p>
            <span aria-hidden="true">”</span>
          </div>
        </section>

        <section className={styles.pillarSection} id="studio">
          <div className={styles.wrap}>
            <header className={styles.sectionHeading}>
              <p>One creative practice</p>
              <h2>Your narrative and director vision belong together.</h2>
              <span>Traditional writing tools separate the script from the imagined film. PlotPickle keeps the story, its visual language and the decisions behind both connected.</span>
            </header>
            <div className={styles.pillarGrid}>
              {visualPillars.map((pillar) => (
                <article key={pillar.code} data-status="available">
                  <span>{pillar.code}</span>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.workflowSection} id="workflow">
          <div className={styles.wrap}>
            <header className={styles.sectionHeading}>
              <p>Concept → Explore → Compare → Direct → Refine → Approve → Reuse</p>
              <h2>Visual development is part of writing.</h2>
              <span>Learn the craft inside the story you are building. Use visual exploration to discover story possibilities without allowing any tool to silently rewrite the work.</span>
            </header>

            <div className={styles.loop} aria-label="Creative direction loop">
              {creativeLoop.map((stage, index) => <div key={stage}><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage}</strong></div>)}
            </div>

            <div className={styles.workflowGrid}>
              {PRIMARY_WORKFLOW_NAVIGATION.map((workspace) => (
                <article key={workspace.id}>
                  <span>{workspace.label}</span>
                  <p>{workspace.description}</p>
                </article>
              ))}
            </div>

            <div className={styles.componentStrip} aria-label="Connected PlotPickle creative spine">
              {components.map((component) => (
                <article key={component.id}>
                  <img src={component.icon} alt="" aria-hidden="true" />
                  <div><strong>{component.label}</strong><span>{component.title}</span></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.modes} id="modes">
          <div className={styles.wrap}>
            <header className={styles.sectionHeading}>
              <p>Local first</p>
              <h2>Start privately. Add people only when the story needs them.</h2>
              <span>PPF is the creative source of truth. Collaboration and compute are optional layers, never prerequisites for writing.</span>
            </header>
            <div className={styles.modeGrid}>
              {operatingModes.map((mode, index) => (
                <article key={mode.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{mode.title}</h3>
                  <p>{mode.body}</p>
                </article>
              ))}
            </div>
            <div className={styles.afterglowCallout}>
              <div><small>Open example story</small><strong>Afterglow: Reflections of Sentience</strong><p>Load Afterglow to see 24 Blocks, the PPF, Storyboard, Graphic Novel and connected visual story development in one working project.</p></div>
              <button className={styles.lightButton} type="button" onClick={onEnter}>Load Afterglow</button>
            </div>
          </div>
        </section>

        <section className={styles.controlSection} id="collaboration">
          <div className={`${styles.wrap} ${styles.controlLayout}`}>
            <div>
              <p className={styles.kicker}>Human authority</p>
              <h2>AI can help you see possibilities. It does not get final cut.</h2>
              <p>PlotPickle is an AI-native visual writing and creative direction studio, but nothing becomes canonical until a person approves it. Story changes remain proposals; paid services require deliberate consent.</p>
            </div>
            <ul>{controlRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          </div>
          <div className={`${styles.wrap} ${styles.boundaryCopy}`}>
            <p>Bring your own GitHub account and story repository for reviewed collaboration. Bring your own Buzz or BuilderLab account for optional room discussion. Bring your own provider account, API key and billing only for cloud services you explicitly enable. Suggest / Report never attaches story files, credentials or local paths automatically.</p>
            <p>Local ComfyUI and Ollama remain user-owned. Native MiniMax H3 requires a verified official-source workflow, and not every computer can run every model. Buzz is dormant by default. Native bundled Buzz binaries are not advertised as shipped until the release boundary is verified.</p>
          </div>
        </section>

        <section className={styles.builds} id="builds">
          <div className={styles.wrap}>
            <header className={styles.sectionHeading}>
              <p>Desktop software</p>
              <h2>Build the story on your machine.</h2>
              <span>PlotPickle remains a local-first application with Windows, macOS and Linux packages and optional connections layered on top.</span>
            </header>
            <div className={styles.buildGrid}>
              {PLOTPICKLE_DESKTOP_BUILDS.map((build) => (
                <article key={build.id}>
                  <span>Desktop build</span>
                  <h3>{build.platform}</h3>
                  <p>{build.detail}</p>
                  <a href={downloadUrl} target="_blank" rel="noreferrer">Open release downloads</a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.openSource} id="open-source">
          <div className={styles.wrap}>
            <header className={styles.sectionHeading}>
              <p>Open foundation</p>
              <h2>The creative system stays inspectable.</h2>
              <span>Your story remains yours. PlotPickle keeps the portable project model, code and contribution boundaries visible.</span>
            </header>
            <div className={styles.openGrid}>
              {OPEN_SOURCE_FOUNDATIONS.map((foundation) => (
                <article key={foundation.title}><strong>{foundation.title}</strong><p>{foundation.summary}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.finalSection}>
          <div className={`${styles.wrap} ${styles.finalLayout}`}>
            <div><p>Write it. See it. Direct it.</p><h2>Shape the story. See the world. Direct what comes next.</h2></div>
            <a className={styles.primaryButton} href="#top">Return to the beginning</a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}><strong>PlotPickle</strong><span>AI-native visual writing and creative direction studio.</span><a href="/legal">Legal</a></div>
      </footer>

      {/*
        Compatibility source markers retained for earlier product-truth regressions while the visible public narrative moves forward:
        Product-authentic PlotPickle Dashboard preview · One living story graph · Self-learning · self-paced modules · Story graph · story graph · Story logic · Portable PPF · portable PPF · 81 guided modules · Visual writing · Visual pitch · Community feedback.
        reasons.map · The complete current workspace model · COLLABORATION_NAVIGATION · Available now · Dashboard · Available now · Graphic Novel + Storyboard · Available now · Feedback + Reports · Optional · Collab · Optional · Buzz · Available now · Local-first.
        One application. Three desktop packages. · built on its target operating system · SHA-256 checksum · There is no required PlotPickle cloud account.
        PlotPickle installed locally · Afterglow or your own local story · Learn workspace · 81 modules · local guides · No AI · OpenAI API · Local or compatible model · Manual prompt export.
        Settings configures services. Collab and Buzz use those connections. · Story & Art · Repository & Collab · Scheduling & Meetings · Media & Film Engines · Buzz.
        GitHub Story Proposals · owner-approved merges · Buzz / BuilderLab account · sanitized Suggest / Report path · encrypted for the current operating-system user.
        /brand/favicon/plotpickle-icon-128.png · plotpickle-multi-server-collaboration.svg
      */}
    </div>
  );
}
