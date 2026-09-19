import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PLOTPICKLE_REPOSITORY_URL } from "@/lib/product-direction";
import styles from "./public-site.module.css";

export const metadata: Metadata = {
  title: "PlotPickle — Shape the Story",
  description: "A visual writer for the stories in your head. Human-only, AI-optional, local-first and writer-controlled.",
  alternates: { canonical: "https://plotpickle.com/" },
};

const productSpine = ["Dashboard", "Community", "LEARN", "PLAN", "BUILD", "Wyrmwood", "Settings"];
const creationModes = [
  ["HUMAN-ONLY", "Just you and the story", "Use the curriculum, planning rooms and visual structure without connecting a model."],
  ["AI-ASSISTED", "Invite help when it helps", "Ask a local or chosen cloud model to explain, explore, test or visualize. You accept every change."],
  ["AGENT-POWERED", "Give each helper a clear job", "Named Agents combine a role, relevant context and focused skills without becoming the author."],
] as const;
const boundaries = [
  ["Human profile", "Your private workspace, story authority and optional Human BUZZ identity."],
  ["PlotPickle Node", "One installation with its own durable device identity and local capability manifest."],
  ["Named Agents", "Sage and the helper roster have bounded roles and never inherit the Human signer."],
] as const;

export default function PublicSitePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="#top" className={styles.brand}>
          <img src="/brand/favicon/plotpickle-ouroboros-v2-128.png" alt="" />
          <span><strong>PlotPickle</strong><small>Shape the Story</small></span>
        </a>
        <nav aria-label="PlotPickle.com">
          <a href="#story-shaping">Story Shaping</a>
          <a href="#ai-choice">AI or No AI</a>
          <a href="#connected-world">Connected World</a>
          <a href="#community">Community</a>
          <Link href="/blog">Blog</Link>
        </nav>
        <a href={PLOTPICKLE_REPOSITORY_URL} className={styles.source}>GitHub</a>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>A visual writer for the stories in your head</p>
            <h1>Storywriting has changed. <span>Now shape it.</span></h1>
            <p className={styles.lede}>PlotPickle turns the lonely blank page into a living creative room where learning, planning, visual storytelling, named helpers and a real writers&apos; Community belong to the same story.</p>
            <p>You are still the author. Work entirely by hand, invite AI for one small task, or connect a deeper world of LLMs, Agents and skills. The door is yours to open.</p>
            <div className={styles.actions}>
              <a href="https://buzz.directory/">Visit the Community BBS</a>
              <a href={PLOTPICKLE_REPOSITORY_URL}>Explore the source</a>
              <Link href="/blog">Read the Blog</Link>
            </div>
            <div className={styles.trust}><span>HUMAN-ONLY</span><span>AI-OPTIONAL</span><span>LOCAL-FIRST</span><span>WRITER-CONTROLLED</span></div>
          </div>
          <div className={styles.console} aria-label="PlotPickle visual writer preview">
            <header><strong>PLOTPICKLE / VISUAL WRITER</strong><code>LOCAL NODE · READY</code></header>
            <div className={styles.consoleGrid}>
              <section>
                <small>CURRICULUM</small>
                <p>Foundations 01 · Complete</p><p>World 02 · In progress</p><p>Character 03 · Next frontier</p>
              </section>
              <section>
                <small>WORLD / PRESSURE MAP</small>
                <h2>What must this world force the hero to become?</h2>
                <p>One accepted choice changes only the story frames it truly touches.</p>
              </section>
              <section className={styles.sage}>
                <Image src="/assets/sage-brinewick-v2.png" width={72} height={72} alt="Sage Brinewick" />
                <div><small>CREATIVE ROOM</small><strong>Sage Brinewick</strong><p>“The idea is strong. What does this world make impossible?”</p></div>
              </section>
            </div>
          </div>
        </section>

        <section className={styles.metrics} aria-label="PlotPickle system">
          <strong>81 lessons</strong><strong>24 story Blocks</strong><strong>96 mini-Blocks</strong><strong>3 ways to create</strong><strong>1 portable PPF record</strong>
        </section>

        <section className={styles.section} id="story-shaping">
          <p className={styles.eyebrow}>From writing words to shaping worlds</p>
          <h2>A story is more than sentences in a row.</h2>
          <p>PlotPickle helps you see the system beneath the prose: what the world permits, what a character fears, what each choice changes and whether the whole story still holds together.</p>
          <div className={styles.three}>
            <article><span>01 LEARN</span><h3>Learn inside the work</h3><p>Move through the complete 81-lesson curriculum with Sage Brinewick beside you. The lesson remains the teaching authority.</p></article>
            <article><span>02 PLAN</span><h3>Turn learning into decisions</h3><p>Carry completed learning into editable story choices. Answers remain provisional until you accept them into the portable PPF creative record.</p></article>
            <article><span>03 BUILD</span><h3>See the story take shape</h3><p>Turn accepted decisions into reviewable visual frames. Revise what changed, preserve what did not and keep lineage visible.</p></article>
          </div>
          <div className={styles.spine}><small>CURRENT PRODUCT SPINE</small>{productSpine.map((item, index)=><span key={item}>{String(index+1).padStart(2,"0")} {item}</span>)}</div>
        </section>

        <section className={styles.section} id="ai-choice">
          <p className={styles.eyebrow}>Your room · your rules</p>
          <h2>AI is a choice, not the price of entry.</h2>
          <p>Start with the kind of help you want today and change your mind tomorrow. PlotPickle does not confuse automation with imagination.</p>
          <div className={styles.three}>{creationModes.map(([label,title,body])=><article key={label}><span>{label}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          <blockquote>AI may offer material. Only the Human can make it canon. <strong>DRAFT ≠ DECISION</strong></blockquote>
        </section>

        <section className={styles.section} id="connected-world">
          <p className={styles.eyebrow}>Human, Node and Agent boundaries</p>
          <h2>One person. One profile. Separate trusted identities.</h2>
          <p>Your PlotPickle profile owns your private workspace and optional Human BUZZ identity. The installation and every public Agent remain separate, attributable actors.</p>
          <div className={styles.three}>{boundaries.map(([title,body],index)=><article key={title}><span>0{index+1}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          <p className={styles.rule}>No Agent becomes the Human. No Community presence grants access to another person&apos;s models, files, GPU or story.</p>
        </section>

        <section className={styles.section} id="community">
          <p className={styles.eyebrow}>PLOTPICKLE COMMUNITY BBS · BUZZ · SIGNED HISTORY</p>
          <h2>A writers&apos; hall connected by BUZZ.</h2>
          <p>Meet people in the Great Hall, continue focused work in Story Rooms and discover official PlotPickle Agents through the same signed conversation layer used by BUZZ Desktop.</p>
          <ul><li>Private story work never uploads automatically</li><li>Sharing is explicit and destination-specific</li><li>Human and Agent authorship remains attributable</li><li>Community presence never becomes peer compute access</li></ul>
          <a className={styles.bigLink} href="https://buzz.directory/">Enter the PlotPickle Community</a>
        </section>

        <section className={styles.section}>
          <p className={styles.eyebrow}>The deeper connected world</p>
          <h2>One story room. Many kinds of intelligence.</h2>
          <div className={styles.four}><article><strong>LLMs</strong><p>Reason, explain, draft and compare.</p></article><article><strong>AGENTS</strong><p>Named helpers with bounded roles.</p></article><article><strong>SKILLS</strong><p>Focused ways to perform a real task.</p></article><article><strong>TOOLS</strong><p>Local media, story and community connections.</p></article></div>
          <p className={styles.rule}>LOCAL FIRST · OLLAMA · LM STUDIO · LLAMA.CPP · COMFYUI · BYOK CLOUD<br/>Nothing connects silently. No local-to-paid surprise.</p>
        </section>

        <section className={styles.section}>
          <p className={styles.eyebrow}>So what is a Plot Pickle?</p>
          <h2>Every story eventually finds one.</h2>
          <p>The hero solved the mystery too early. The world has rules but no pressure. The ending works, yet the middle refuses to get there. That is a plot pickle: the useful little tangle that tells you where the real decision is hiding.</p>
          <blockquote>Do not generate more noise. Find the choice that changed everything.</blockquote>
          <div className={styles.pickleGrid}><span>WHAT CHANGED?<strong>FIND THE TURN</strong></span><span>WHO PAYS FOR IT?<strong>FIND THE COST</strong></span><span>WHAT BECAME IMPOSSIBLE?<strong>FIND THE PRESSURE</strong></span><span>WHAT IS STILL MISSING?<strong>SHAPE IT</strong></span><span>WHAT MUST STAY TRUE?<strong>PROTECT IT</strong></span></div>
        </section>

        <section className={styles.final}>
          <p>OPEN SOURCE · AGPLv3</p>
          <h2>Your story is not a prompt. It is a world taking shape.</h2>
          <p>Learn it. Plan it. Build it. Share only what you choose.</p>
          <div className={styles.actions}><Link href="/blog">Blog</Link><a href="https://buzz.directory/">Community BBS</a><a href={PLOTPICKLE_REPOSITORY_URL}>GitHub</a></div>
        </section>
      </main>
      <footer className={styles.footer}><strong>PlotPickle</strong><span>Learn the craft. Make the decisions. See the story take shape.</span><Link href="/legal">Legal</Link></footer>
    </div>
  );
}
