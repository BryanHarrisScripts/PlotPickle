import Link from "next/link";
import styles from "./engine-hub.module.css";

type EngineDefinition = {
  code: string;
  title: string;
  href: string;
  stage: string;
  question: string;
  summary: string;
  useWhen: string;
  connects: string[];
  result: string;
};

const engines: EngineDefinition[] = [
  {
    code: "ST",
    title: "Structure Engine",
    href: "/structure",
    stage: "Organize the film",
    question: "How does the complete story unfold in time?",
    summary:
      "Expand the four-act spine into twelve sequences, twenty-four blocks, a flexible scene plan and ninety-six mini-blocks, then see the whole movie on a live Story Clock.",
    useWhen:
      "Use it after the 24-block spine exists, or whenever pacing, scene placement, scene count, sequence turns, beats or shot targets need to be clarified.",
    connects: ["Target runtime", "12 sequences", "24 blocks", "Flexible scenes", "96 mini-blocks", "Beat and shot targets"],
    result: "A timed, navigable dramatic hierarchy from act to shot, with forty-eight scenes as a starting template rather than a limit.",
  },
  {
    code: "RE",
    title: "Resonance Engine",
    href: "/resonance",
    stage: "Test the idea",
    question: "What is the story really proving through action?",
    summary:
      "Align the central question, theme and credible counter-answer with character choices, consequences, opening and closing images, motifs, locations and dialogue subtext.",
    useWhen:
      "Use it when the plot works mechanically but the meaning feels scattered, obvious, preachy or disconnected from the ending.",
    connects: ["Dramatic question", "Theme and anti-theme", "Character arcs", "Block turns", "Visual language", "Recurring dialogue"],
    result: "A pattern of dramatic evidence rather than a stated moral.",
  },
  {
    code: "VO",
    title: "Voiceprint Engine",
    href: "/voiceprint",
    stage: "Shape the voice",
    question: "Why does each character sound like only themselves?",
    summary:
      "Build speech from origin, social context, expertise, worldview, rhythm, vocabulary, emotional access, status shifts and persuasion strategy.",
    useWhen:
      "Use it before a dialogue pass, when characters sound interchangeable, or when a relationship and scene pressure should change how someone speaks.",
    connects: ["Character history", "World vernacular", "Voice contrast", "Subtext rules", "Relationships", "Selected block pressure"],
    result: "Distinct, playable voices with concise scene-ready rules.",
  },
  {
    code: "PF",
    title: "PageFlow Engine",
    href: "/pageflow",
    stage: "Write the page",
    question: "Can the reader clearly see and play what is written?",
    summary:
      "Turn block planning into active, visible, economical screenplay description while checking for invisible information, weak phrasing, dense paragraphs and unnecessary directing language.",
    useWhen:
      "Use it while drafting scenes or when screenplay action feels novelistic, slow, vague, over-directed or difficult for an actor to play.",
    connects: ["Block goal and conflict", "Script excerpt", "Visual sequence", "Character entrance", "Action diagnostics", "Visual Board frames"],
    result: "Readable screenplay action built from visible behaviour and strong verbs.",
  },
  {
    code: "DL",
    title: "DraftLens Engine",
    href: "/draftlens",
    stage: "Review the draft",
    question: "What did the reader experience, and what caused it?",
    summary:
      "Review the whole screenplay through story, character, structure, page experience, dialogue and surprise lenses, then separate symptoms from root causes.",
    useWhen:
      "Use it after a complete pass, table read or feedback session—before rewriting individual scenes or accepting someone else’s proposed solution.",
    connects: ["First-read response", "Character evidence", "Block evidence", "Continuity", "Revision priorities", "Open questions and sources"],
    result: "A diagnosis-led revision plan that preserves the writer’s authorship.",
  },
  {
    code: "CL",
    title: "CraftLoop Engine",
    href: "/craftloop",
    stage: "Practise and repeat",
    question: "Which craft pass will make this block stronger next?",
    summary:
      "Run one character and one block through audience engagement, opening contract, scene turn, character pressure, human voice, page compression, pitching and reflection.",
    useWhen:
      "Use it as a repeatable studio exercise, a capstone check, or a way to decide which specialist engine should receive the next focused pass.",
    connects: ["The Pickle", "Opening contract", "Block cause and turn", "Character pressure", "PageFlow signal", "Pitch and craft research"],
    result: "A deliberate-practice loop that connects the full PlotPickle method.",
  },
  {
    code: "LB",
    title: "Specialist Labs",
    href: "/labs",
    stage: "Experiment with approval",
    question: "What can be explored safely before the writer commits it to the story?",
    summary:
      "Use focused prompt, dialogue, research, visual and provenance labs beside the active project, compare every proposed change and retain only what the writer explicitly approves.",
    useWhen:
      "Use the labs when an idea needs controlled exploration, sourced canon, a dialogue alternative, a visual-bible pass, prompt development or a complete record of generated assets and human decisions.",
    connects: ["Canonical project context", "Screenplay elements", "Research sources", "Visual assets", "AI provenance", "Revision snapshots"],
    result: "Reviewable specialist suggestions with before-and-after evidence, provenance and no automatic project changes.",
  },
];

export default function EngineHub() {
  return (
    <section className={styles.page} aria-labelledby="engines-title">
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Fourth connected workspace</p>
          <h1 id="engines-title">Choose the right engine or lab for the next story problem.</h1>
          <p>
            The Story Planner holds the project. The Engines and Specialist Labs provide focused passes over that same project. Nothing is copied into a separate database, and every specialist screen reads and writes the active PlotPickle story.
          </p>
        </div>
        <div className={styles.sharedProject}>
          <span>One active project</span>
          <strong>Plan once. Refine through engines and labs.</strong>
          <p>Open a specialist only after reading what it is designed to solve. Return here whenever the next useful pass is unclear.</p>
        </div>
      </div>

      <div className={styles.process} aria-label="Recommended engine and lab order">
        {engines.map((engine, index) => (
          <div key={engine.code}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{engine.title.replace(" Engine", "")}</strong>
            {index < engines.length - 1 ? <i aria-hidden="true">→</i> : null}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {engines.map((engine, index) => (
          <article className={styles.card} key={engine.code}>
            <header>
              <div className={styles.code}>{engine.code}</div>
              <div>
                <p>{String(index + 1).padStart(2, "0")} · {engine.stage}</p>
                <h2>{engine.title}</h2>
              </div>
            </header>

            <p className={styles.question}>{engine.question}</p>
            <p className={styles.summary}>{engine.summary}</p>

            <div className={styles.detail}>
              <span>Use it when</span>
              <p>{engine.useWhen}</p>
            </div>

            <div className={styles.connection}>
              <span>Works with shared project data</span>
              <div>
                {engine.connects.map((item) => <small key={item}>{item}</small>)}
              </div>
            </div>

            <div className={styles.result}>
              <span>Expected result</span>
              <strong>{engine.result}</strong>
            </div>

            <Link href={engine.href} className={styles.openButton}>
              Open {engine.title} <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </div>

      <footer className={styles.footerNote}>
        <strong>There is no required order.</strong>
        <p>Use the suggested sequence for a full development pass, or enter the engine or lab that addresses the problem currently slowing the story down.</p>
      </footer>
    </section>
  );
}
