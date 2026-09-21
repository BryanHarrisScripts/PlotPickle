import type { Metadata } from "next";
import Link from "next/link";
import { PLOTPICKLE_REPOSITORY_URL } from "@/lib/product-direction";
import styles from "./public-site.module.css";

export const metadata: Metadata = {
  title: "PlotPickle — Shape the Story",
  description: "A local-first, writer-controlled story operating system where the Human remains the author and AI stays optional.",
  alternates: { canonical: "https://plotpickle.com/" },
};

const matrixDomains = [
  ["Explore", "Learn · Community · Library"],
  ["Develop", "Discover · Write · Edit"],
  ["Visualize", "Story · Outline · Storyboard · Previs · Timeline · Production"],
  ["Review", "Feedback · Refine · Analytics"],
  ["Pitch", "Package · Deck"],
  ["Play", "Identity · Wyrmwood · Written"],
  ["System", "Settings · Service · Legal"],
] as const;

const creationModes = [
  ["HUMAN-ONLY", "Write without a model", "Use the curriculum, story structure, review tools and project record without connecting AI."],
  ["AI-ASSISTED", "Invite help deliberately", "Ask a local or chosen cloud model to explain, explore, test or visualize. You decide what survives."],
  ["AGENT-POWERED", "Give each helper a job", "Named Agents combine a bounded role, relevant context and focused skills without becoming the author."],
] as const;

const scoreDimensions = ["Alignment", "Verbosity", "Erosion", "Progression", "Coverage"] as const;

const architectureLayers = [
  ["01", "Experience Skins", "Replaceable presentation for an audience or device."],
  ["02", "Expanded Experience Layer", "The stable product contract behind every Skin."],
  ["03", "Governed Production Orchestration", "Authority, consent, lifecycle and execution control."],
  ["04", "Agent & Skill Mesh", "Specialists collaborating within approved scope."],
  ["05", "Story, Canon & Evidence Core", "Deterministic story state and one durable canon authority."],
  ["06", "AI / Provider Runtime", "Replaceable local and cloud inference routes."],
  ["07", "Validation & Operations", "Independent evidence, diagnostics and release checks."],
] as const;

const ossSystems = [
  "React", "Vite", "Vinext", "Tailwind CSS", "Mastra", "Vercel AI SDK", "Drizzle ORM", "libsodium", "JetBrains Mono",
  "BUZZ", "Ollama", "llama.cpp", "whisper.cpp", "ComfyUI", "FFmpeg / ffprobe", "Lazy Frames", "Portless", "Pi coding agent", "Cline",
] as const;

const architectureUrl = `${PLOTPICKLE_REPOSITORY_URL}/tree/main/architecture`;
const ossRegistryUrl = `${PLOTPICKLE_REPOSITORY_URL}/blob/main/config/third-party-oss.json`;

export default function PublicSitePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="#top" className={styles.brand}>
          <img src="/brand/favicon/plotpickle-ouroboros-v2-128.png" alt="" />
          <span><strong>PlotPickle</strong><small>Shape the Story</small></span>
        </a>
        <nav aria-label="PlotPickle.com">
          <a href="#matrix">Matrix</a>
          <a href="#story-math">24 / 96</a>
          <a href="#human-authority">Human + AI</a>
          <a href="#architecture">Architecture</a>
          <a href="#open-source">Open Source</a>
          <Link href="/blog">Blog</Link>
        </nav>
        <a href={PLOTPICKLE_REPOSITORY_URL} className={styles.source}>GitHub</a>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AI-Native Agentic Story Operating System</p>
            <h1>Shape the whole story. <span>Keep it yours.</span></h1>
            <p className={styles.lede}>PlotPickle is a visual writing and creative-direction studio for moving from idea to screenplay to screen without giving away creative authority.</p>
            <p>The Human remains the author. AI can explain, suggest, draft, visualize and test ideas, but generated material never silently becomes canon.</p>
            <div className={styles.actions}>
              <a href={PLOTPICKLE_REPOSITORY_URL}>Explore the source</a>
              <Link href="/blog">Read the Blog</Link>
              <a href="https://buzz.directory/">Visit Community</a>
            </div>
            <div className={styles.trust}><span>HUMAN AUTHOR</span><span>AI OPTIONAL</span><span>LOCAL FIRST</span><span>WRITER CONTROLLED</span></div>
            <p className={styles.releaseNote}><strong>PRE-RELEASE</strong> PlotPickle is under active development. There is no public Windows installer yet.</p>
          </div>

          <div className={styles.matrixConsole} aria-label="PlotPickle Matrix experience map">
            <header><strong>PLOTPICKLE / MATRIX</strong><code>HUMAN AUTHORITY · ACTIVE</code></header>
            <div className={styles.matrixHeader}><span>EXPERIENCE</span><span>VISIBLE WORKSPACES</span></div>
            <div className={styles.matrixRows}>
              {matrixDomains.map(([domain, surfaces], index) => (
                <div className={styles.matrixRow} key={domain}>
                  <span><small>{String(index + 1).padStart(2, "0")}</small>{domain}</span>
                  <p>{surfaces}</p>
                </div>
              ))}
            </div>
            <footer>ONE PROJECT · ONE CANON PATH · EXPLICIT ACCEPTANCE</footer>
          </div>
        </section>

        <section className={styles.metrics} aria-label="PlotPickle structural model">
          <strong><small>DEFAULT RUNTIME</small>120 minutes</strong>
          <strong><small>STORY RHYTHM</small>12 sequences</strong>
          <strong><small>STRUCTURE</small>24 Story Blocks</strong>
          <strong><small>PRECISION</small>96 Mini-Blocks</strong>
          <strong><small>PRODUCTION GRID</small>2,400 render slots</strong>
        </section>

        <section className={styles.section} id="matrix">
          <p className={styles.eyebrow}>The current user-facing experience</p>
          <h2>Matrix organizes the work without becoming the story authority.</h2>
          <p>Explore, Develop, Visualize, Review, Pitch, Play and System form the current top-level map. Learn, Community and Library remain visible parts of the workflow, while story development continues through writing, visual planning, review, presentation and playable-story work.</p>
          <p className={styles.rule}>This is the governed experience map, not a claim that every inventoried or in-transit surface is complete or publicly released.</p>
          <div className={styles.workflow} aria-label="Visible story workflow">
            <span>DISCOVER</span><i>→</i><span>WRITE</span><i>→</i><span>EDIT</span><i>→</i><span>STORY</span><i>→</i><span>OUTLINE</span><i>→</i><span>STORYBOARD</span><i>→</i><span>PREVIS</span><i>→</i><span>TIMELINE</span><i>→</i><span>PRODUCTION</span>
          </div>
        </section>

        <section className={`${styles.section} ${styles.mathSection}`} id="story-math">
          <p className={styles.eyebrow}>The 24 / 96 mathematical narrative model</p>
          <h2>A stable address for every part of the story.</h2>
          <p>PlotPickle converts normalized story time into a shared coordinate system. It lets learning, writing, visual development, feedback and production refer to the same structural region without forcing the story into a rigid template.</p>
          <div className={styles.coordinateRail} aria-label="Normalized narrative coordinate system">
            <div><small>01</small><strong>Runtime</strong><span>the whole story</span></div>
            <b>→</b>
            <div><small>02</small><strong>12 sequences</strong><span>narrative movement</span></div>
            <b>→</b>
            <div><small>03</small><strong>24 Story Blocks</strong><span>stable regions</span></div>
            <b>→</b>
            <div><small>04</small><strong>96 Mini-Blocks</strong><span>precise evidence</span></div>
            <b>→</b>
            <div><small>05</small><strong>Production / timecode</strong><span>screen coordinates</span></div>
          </div>
          <div className={styles.twoColumn}>
            <article>
              <span className={styles.cardLabel}>DEFAULT 120-MINUTE FEATURE</span>
              <h3>Five minutes per Block. Seventy-five seconds per Mini-Block.</h3>
              <p>These durations are normalized reference regions. Scenes, beats and shots may span, compress or cross them whenever the story requires.</p>
              <strong className={styles.emphasis}>Stable structural addresses, not creative handcuffs.</strong>
            </article>
            <article>
              <span className={styles.cardLabel}>PRODUCTION ADDRESSING</span>
              <h3>24 Blocks → 96 Mini-Blocks → 2,400 technical three-second render slots.</h3>
              <p>The grid supports stable production addresses and surgical regeneration. It does not mean 2,400 clips must be generated or stored up front.</p>
              <strong className={styles.emphasis}>Regenerate the failed slot, not the entire scene.</strong>
            </article>
          </div>
        </section>

        <section className={styles.section} id="score">
          <p className={styles.eyebrow}>PlotPickle Score</p>
          <h2>Deterministic structural measurement, with limits you can see.</h2>
          <p>PlotPickle Score measures available structural evidence across five transparent dimensions. When evidence is insufficient, the result is <strong>NR / Not Rated</strong> instead of a fabricated number.</p>
          <div className={styles.scoreGrid}>{scoreDimensions.map((dimension, index) => <article key={dimension}><small>0{index + 1}</small><strong>{dimension}</strong></article>)}</div>
          <p className={styles.rule}>The score is not an AI-authorship detector and never replaces Human creative judgment. Human-written, AI-assisted, generated and imported material use the same evidence contract.</p>
        </section>

        <section className={styles.section} id="human-authority">
          <p className={styles.eyebrow}>Your room · your rules</p>
          <h2>AI is a choice, not the price of entry.</h2>
          <div className={styles.three}>{creationModes.map(([label, title, body]) => <article key={label}><span>{label}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          <blockquote>AI may offer material. Only the Human can make it canon. <strong>DRAFT ≠ DECISION</strong></blockquote>
          <div className={styles.runtimeGrid}>
            <article><small>LOCAL TEXT + REASONING</small><h3>Ollama, llama.cpp and compatible endpoints</h3><p>Choose models that run on your own hardware or a private endpoint.</p></article>
            <article><small>LOCAL MEDIA + VOICE</small><h3>ComfyUI and whisper.cpp</h3><p>Use optional local image/video workflows and local dictation where configured.</p></article>
            <article><small>EXPLICIT CONNECTIONS</small><h3>Cloud / BYOK and LM Studio</h3><p>Cloud providers remain deliberate choices. LM Studio may be used as a compatible connection; it is not described as open source.</p></article>
          </div>
        </section>

        <section className={styles.section} id="architecture">
          <p className={styles.eyebrow}>Seven canonical architectural layers</p>
          <h2>One system, with authority boundaries that stay visible.</h2>
          <p>The public explanation follows the repository architecture rather than inventing a second version of it. Presentation can change; story authority, provider choice and validation boundaries remain explicit.</p>
          <div className={styles.layerStack}>{architectureLayers.map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          <a className={styles.bigLink} href={architectureUrl}>Review the architecture evidence on GitHub</a>
        </section>

        <section className={styles.section} id="community">
          <p className={styles.eyebrow}>Community · BUZZ · signed history</p>
          <h2>A writers&apos; hall without a back door into your story.</h2>
          <p>Meet people in the Great Hall, continue focused work in Story Rooms and discover official PlotPickle Agents through BUZZ. Community material remains separate from canon until the Human deliberately brings it into the governed approval path.</p>
          <ul><li>Private story work never uploads automatically</li><li>Sharing is explicit and destination-specific</li><li>Human and Agent authorship remains attributable</li><li>Community presence never becomes peer compute access</li></ul>
          <a className={styles.bigLink} href="https://buzz.directory/">Enter the PlotPickle Community</a>
        </section>

        <section className={styles.section} id="open-source">
          <p className={styles.eyebrow}>Built in the open</p>
          <h2>Open source is part of the architecture, not a footnote.</h2>
          <p>The repository records the software, tools and reference work that materially contribute to PlotPickle. The machine-readable inventory is authoritative for usage, source, version evidence and licence scope.</p>
          <div className={styles.ossCloud}>{ossSystems.map((system) => <span key={system}>{system}</span>)}</div>
          <p className={styles.rule}>Supported does not automatically mean open source. LM Studio and configured proprietary or cloud services are kept outside the OSS inventory rather than being misclassified.</p>
          <div className={styles.actions}><a href={ossRegistryUrl}>Read the OSS registry</a><a href={`${PLOTPICKLE_REPOSITORY_URL}/blob/main/README.md`}>Read the current README</a></div>
        </section>

        <section className={styles.final}>
          <p className={styles.eyebrow}>PRE-RELEASE · OPEN SOURCE · AGPLv3</p>
          <h2>Your story is not a prompt. It is a world taking shape.</h2>
          <p>Learn the craft. Make the decisions. See the story take shape.</p>
          <p className={styles.releaseNote}>There is no public PlotPickleSetup.exe or downloadable Windows installer yet. Follow the repository and Blog for reviewed release progress.</p>
          <div className={styles.actions}><a href={PLOTPICKLE_REPOSITORY_URL}>GitHub</a><Link href="/blog">Blog</Link><a href="https://buzz.directory/">Community</a></div>
        </section>
      </main>

      <footer className={styles.footer}>
        <strong>PlotPickle</strong>
        <span>Human-authored · AI-optional · Local-first</span>
        <nav aria-label="Footer"><Link href="/blog">Blog</Link><Link href="/legal">Legal</Link><a href={PLOTPICKLE_REPOSITORY_URL}>Source</a></nav>
      </footer>
    </div>
  );
}
