import Link from "next/link";
import styles from "./engine-hub.module.css";

type RefineSection = {
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

const refineSections: RefineSection[] = [
  {
    code: "DQ",
    title: "Overview & Diagnostic Queue",
    href: "/diagnostics?return=refine",
    stage: "Choose the next pass",
    question: "Which evidence-backed problem should be diagnosed next?",
    summary: "Collect unresolved structural, story, character, dialogue, page and draft signals without opening another canonical editor.",
    useWhen: "Use it when several symptoms compete for attention or the most useful next diagnostic pass is unclear.",
    connects: ["Shared project evidence", "Open feedback", "Report signals", "Revision priorities"],
    result: "A bounded diagnostic queue with an explicit owning workspace for every proposed change.",
  },
  {
    code: "SP",
    title: "Structure & Pacing Diagnostics",
    href: "/diagnostics?focus=structure",
    stage: "Read arrangement",
    question: "Where does causality, escalation, duration or handoff weaken?",
    summary: "Read the canonical 24 Blocks, 96 mini-blocks, scenes and Story Clock without moving or rewriting them.",
    useWhen: "Use it when the film drags, jumps, repeats, loses causality or gives key turns the wrong amount of space.",
    connects: ["24 Blocks", "96 mini-blocks", "Stable scene IDs", "Story Clock"],
    result: "Evidence and proposed priorities routed back to Build for structural changes.",
  },
  {
    code: "RE",
    title: "Story & Theme through Resonance",
    href: "/resonance?return=refine",
    stage: "Test meaning",
    question: "What is the story proving through choices and consequences?",
    summary: "Trace dramatic question, competing answers, character choices, motifs, opening and ending evidence, and dialogue subtext.",
    useWhen: "Use it when plot mechanics work but meaning feels scattered, obvious or disconnected from the ending.",
    connects: ["Dramatic question", "Theme and anti-theme", "Character evidence", "Motif patterns"],
    result: "A diagnostic pattern and Plan-facing proposals rather than an automatic thematic rewrite.",
  },
  {
    code: "CD",
    title: "Character & Dialogue Diagnostics",
    href: "/labs?scope=refine&return=refine",
    stage: "Compare voice evidence",
    question: "Where do character strategy, voice contrast or subtext become inconsistent?",
    summary: "Use bounded prompt and Dialogue Lab comparisons against Plan-owned voice definitions and Write-owned screenplay text.",
    useWhen: "Use it when characters sound interchangeable, a line states the subtext or relationship pressure is not audible.",
    connects: ["Plan voice definitions", "Write screenplay IDs", "Dialogue evidence", "Explicit review gate"],
    result: "A reviewable proposal handed to Write only after explicit human approval.",
  },
  {
    code: "PF",
    title: "Page & Scene Diagnostics through PageFlow",
    href: "/pageflow?return=refine",
    stage: "Read the page",
    question: "Can the reader clearly see, follow and play what is written?",
    summary: "Scan the current screenplay for invisible information, dense paragraphs, weak action phrases, emotion labels and unnecessary directing language.",
    useWhen: "Use it when pages feel novelistic, vague, slow, over-directed or difficult for an actor to play.",
    connects: ["Write-owned screenplay text", "Scene IDs", "Visual beats", "PageFlow signals"],
    result: "Read-only page evidence and a proposed Write pass, never a second screenplay editor.",
  },
  {
    code: "DL",
    title: "Full-Draft Diagnosis through DraftLens",
    href: "/draftlens?return=refine",
    stage: "Review the whole draft",
    question: "What did the reader experience, and what caused it?",
    summary: "Review story, character, structure, page experience, dialogue and surprise as one complete draft before solving individual symptoms.",
    useWhen: "Use it after a complete pass, table read or feedback session and before rewriting isolated scenes.",
    connects: ["First-read response", "Character evidence", "Block evidence", "Continuity"],
    result: "A root-cause revision plan that preserves the writer’s authorship.",
  },
  {
    code: "RP",
    title: "Revision Passes & Essential Craft Audit",
    href: "/story-craft-essentials?scope=refine&return=refine#audit",
    stage: "Propose the pass",
    question: "Which bounded revision pass best addresses the diagnosed root cause?",
    summary: "Run the evidence-based Essential Craft Audit, separate symptom from cause and record a deliberate revision priority.",
    useWhen: "Use it after diagnosis, before opening the workspace that owns the actual change.",
    connects: ["Diagnostic evidence", "Revision snapshots", "Feedback approval", "Owning workspace"],
    result: "An explicit revision proposal; no canonical story, screenplay, storyboard or production content changes silently.",
  },
];

const movedCapabilities = [
  ["Learn", "Lessons and CraftLoop", "/?workspace=learn"],
  ["Plan", "Research, canon, story experience, motifs and voice definitions", "/?workspace=plan"],
  ["Storyboard", "Visual Bible, Shot Designer and Animatic", "/?workspace=storyboard"],
  ["Pitch", "Loglines, pitch packages, comic deck and exports", "/?workspace=pitch"],
  ["Build", "Sonic Bible, breakdowns, schedule and distribution planning", "/?workspace=build"],
  ["Feedback", "Anchored review, revision compare and saved-pass approval", "/?workspace=feedback"],
  ["Reports", "Read-only production and provenance summaries", "/?workspace=reports"],
] as const;

export default function EngineHub({ onOpenBuild }: { onOpenBuild: () => void }) {
  return (
    <section className={styles.page} aria-labelledby="engines-title">
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Refine · diagnostic workspace</p>
          <h1 id="engines-title">Diagnose and propose. Change the story in its owning workspace.</h1>
          <p>
            Refine reads the same canonical PlotPickle project as every other workspace. It identifies evidence,
            separates symptoms from root causes and prepares bounded revision passes; it is not another structure,
            screenplay, storyboard, pitch, production or approval editor.
          </p>
        </div>
        <div className={styles.sharedProject}>
          <span>Governing rule</span>
          <strong>Refine diagnoses and proposes.</strong>
          <p>Plan, Build, Write and Storyboard own changes. Feedback owns discussion and approval. Reports owns read-only summaries.</p>
        </div>
      </div>

      <section className={styles.structureBoundary} aria-label="Structure workspace boundary">
        <div>
          <span>Structure diagnostics</span>
          <strong>Build owns arrangement. Refine reads the same structure for diagnosis.</strong>
          <p>Use the diagnostic pass to identify pacing and causal problems. Open Build only when you deliberately choose to move Blocks or mini-blocks.</p>
        </div>
        <button type="button" onClick={onOpenBuild}>Open Build structure editor</button>
      </section>

      <div className={styles.process} aria-label="Refine diagnostic order">
        {refineSections.map((section, index) => (
          <div key={section.code}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{section.title}</strong>
            {index < refineSections.length - 1 ? <i aria-hidden="true">→</i> : null}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {refineSections.map((section, index) => (
          <article className={styles.card} key={section.code}>
            <header>
              <div className={styles.code}>{section.code}</div>
              <div>
                <p>{String(index + 1).padStart(2, "0")} · {section.stage}</p>
                <h2>{section.title}</h2>
              </div>
            </header>
            <p className={styles.question}>{section.question}</p>
            <p className={styles.summary}>{section.summary}</p>
            <div className={styles.detail}><span>Use it when</span><p>{section.useWhen}</p></div>
            <div className={styles.connection}>
              <span>Reads shared canonical evidence</span>
              <div>{section.connects.map((item) => <small key={item}>{item}</small>)}</div>
            </div>
            <div className={styles.result}><span>Expected result</span><strong>{section.result}</strong></div>
            <Link href={section.href} className={styles.openButton}>Open diagnostic <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </div>

      <footer className={styles.footerNote}>
        <strong>Tools that edit or approve now open from their owner.</strong>
        <div className={styles.connection}>
          <div>{movedCapabilities.map(([owner, capability, href]) => <Link href={href} key={owner}>{owner}: {capability}</Link>)}</div>
        </div>
      </footer>
    </section>
  );
}
