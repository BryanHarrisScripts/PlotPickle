"use client";

import { useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import styles from "./learning-studio.module.css";

type Props = {
  project: PlotPickleProject;
  blockNumber: number;
  miniBlockNumber: number;
  onBlockChange: (blockNumber: number) => void;
  onMiniBlockChange: (miniBlockNumber: number) => void;
  onOpenTreatment: () => void;
  onOpenScreenplay: () => void;
  onOpenBlock: (blockNumber: number) => void;
};

type Lesson = {
  id: string;
  path: "Start" | "Character" | "Structure" | "Scenes" | "Dialogue" | "Revision" | "Tools";
  title: string;
  summary: string;
  principles: string[];
  exercise: string;
  apply: "Treatment" | "Screenplay" | "Block plan";
  tags: string[];
};

const lessons: Lesson[] = [
  { id: "concept", path: "Start", title: "From concept to a working treatment", summary: "Move from the original idea through research, logline, beats, outline and treatment before screenplay formatting. A treatment is the present-tense prose version of the movie.", principles: ["Clarify the central conflict and character journey first.", "Use the treatment to test causality before polishing pages.", "Let each mini-block answer what changes and why the next movement is necessary."], exercise: "Write this mini-block as a short present-tense scene: condition, attempt, pressure and visible turn.", apply: "Treatment", tags: ["idea", "logline", "outline", "treatment", "workflow"] },
  { id: "character", path: "Character", title: "Character choices drive plot", summary: "Characters are not passengers in the structure. Their goals, contradictions and decisions create consequences that propel the next block.", principles: ["Give the character a conscious objective and a less conscious need.", "Make strengths and flaws useful until pressure changes their cost.", "Show transformation through choices and behaviour, not explanation."], exercise: "Name the choice available here, the protective habit that shapes it, and the consequence that exposes character.", apply: "Block plan", tags: ["character", "motivation", "choice", "arc", "ghost"] },
  { id: "inner-journey", path: "Character", title: "Track the inner journey under the action", summary: "The external plot gains emotional meaning when each confrontation tests the character's old belief and makes a new truth increasingly necessary.", principles: ["Connect the past wound to a present strategy.", "Let failure challenge the old strategy in stages.", "Prove change through the final action under pressure."], exercise: "Describe the entry belief and exit belief for this mini-block. What evidence shifts the character between them?", apply: "Treatment", tags: ["inner journey", "belief", "transformation", "failure", "arc"] },
  { id: "dramatic-question", path: "Structure", title: "Keep the dramatic question alive", summary: "A dramatic question gives the audience something active to track. Every answer should create a sharper question until the story earns its final answer.", principles: ["State the question in terms of uncertain outcome.", "Keep at least two plausible answers alive.", "Use revelations to reframe the route, not merely delay it."], exercise: "What does the audience believe before this movement, and what new possibility must they consider after it?", apply: "Block plan", tags: ["dramatic question", "audience", "suspense", "pickle", "reveal"] },
  { id: "dynamic-scenes", path: "Scenes", title: "Build a scene as a mini-story", summary: "An effective scene establishes a condition, develops conflict and ends with a changed circumstance, relationship or challenge.", principles: ["Enter with a specific scene purpose.", "Give someone an objective and meaningful resistance.", "Exit on a turn that moves plot or character."], exercise: "Write one sentence each for the scene's beginning, pressure-filled middle and changed ending.", apply: "Treatment", tags: ["scene", "goal", "conflict", "turn", "purpose"] },
  { id: "visual-writing", path: "Scenes", title: "Write what the audience can see and hear", summary: "Film communicates through behaviour, images, sound and juxtaposition. Translate explanation into observable evidence whenever possible.", principles: ["Choose concrete actions over abstract emotional labels.", "Use the environment to apply pressure or reveal character.", "Leave room for performance and production interpretation."], exercise: "Replace one internal explanation with a physical choice, prop, look, sound or change in distance.", apply: "Screenplay", tags: ["visual", "show don't tell", "action", "image", "sound"] },
  { id: "dialogue", path: "Dialogue", title: "Make every voice character-specific", summary: "Dialogue reveals strategy, status and worldview through rhythm and vocabulary. It should do more than transfer information.", principles: ["Let background and social context shape language.", "Give each speaker a persuasion strategy and verbal fingerprint.", "Use conflict to make exposition active."], exercise: "Write the same request in two characters' voices. Change sentence shape, vocabulary and what each refuses to say.", apply: "Screenplay", tags: ["dialogue", "voice", "rhythm", "exposition", "status"] },
  { id: "subtext", path: "Dialogue", title: "Let the real conversation live underneath", summary: "Subtext appears when the spoken words serve a strategy while the deeper want, fear or conflict remains unstated.", principles: ["Know what each speaker wants from the exchange.", "Let behaviour contradict or complicate the words.", "Avoid explaining subtext after the audience can infer it."], exercise: "Write the literal line, then write what the character actually means. Keep only the line that creates useful tension.", apply: "Screenplay", tags: ["subtext", "conflict", "strategy", "emotion", "dialogue"] },
  { id: "silence", path: "Dialogue", title: "Use silence as dramatic action", summary: "A pause, refusal, interruption or physical response can carry more pressure than another line of dialogue.", principles: ["Silence must change the exchange, not simply decorate it.", "Anchor the pause in behaviour the audience can read.", "Use absence of response to shift status or expectation."], exercise: "Remove the most explanatory response in the scene. Replace it with one playable action that changes power.", apply: "Screenplay", tags: ["silence", "pause", "action", "power", "dialogue"] },
  { id: "theme", path: "Structure", title: "Express theme through competing choices", summary: "Theme becomes dramatic when characters embody different answers and the plot tests those answers through consequence.", principles: ["Frame theme as an argument, not a slogan.", "Give the anti-theme genuine short-term power.", "Let the ending prove meaning through action."], exercise: "Which belief wins this mini-block, and what price or benefit makes that belief persuasive?", apply: "Block plan", tags: ["theme", "anti-theme", "meaning", "choice", "ending"] },
  { id: "pacing", path: "Revision", title: "Revise pacing through cause and pressure", summary: "Pacing is not only speed. It is the rate at which meaningful information, choices, consequences and emotional shifts reach the audience.", principles: ["Cut repetition that does not deepen meaning.", "Enter after the setup is understood and leave on the turn.", "Vary scene shape while preserving causal momentum."], exercise: "Underline the new information, choice and consequence here. If one is missing, add it; if a beat repeats, compress it.", apply: "Treatment", tags: ["pacing", "revision", "compression", "cause", "consequence"] },
  { id: "revision", path: "Revision", title: "Diagnose before rewriting", summary: "Record the reader experience first, identify evidence, then find the underlying story cause before changing pages.", principles: ["Separate the visible symptom from the root problem.", "Revise one intention at a time.", "Protect what already works while testing the change."], exercise: "State the problem as an audience experience, cite the exact evidence, and write one question that could reveal the cause.", apply: "Treatment", tags: ["revision", "critique", "diagnosis", "feedback", "draft"] },
  { id: "markdown", path: "Tools", title: "Use Markdown as a lightweight story workspace", summary: "Headings, emphasis, lists, task boxes and quotes make treatments and revision notes readable without locking the writer into a proprietary document format.", principles: ["Use headings for story movements, not decorative size.", "Use lists for beats and tasks for revision work.", "Export plain Markdown whenever you need a portable copy."], exercise: "Add a heading for the movement, a three-item beat list and one unchecked revision task.", apply: "Treatment", tags: ["markdown", "formatting", "notes", "export", "workflow"] },
];

function miniBlocks(project: PlotPickleProject, blockNumber: number) {
  return project.blocks[blockNumber - 1].scenes.flatMap((scene) => scene.miniBlocks);
}

export default function LearningStudio({ project, blockNumber, miniBlockNumber, onBlockChange, onMiniBlockChange, onOpenTreatment, onOpenScreenplay, onOpenBlock }: Props) {
  const [query, setQuery] = useState("");
  const [path, setPath] = useState("All");
  const block = project.blocks[blockNumber - 1];
  const minis = miniBlocks(project, blockNumber);
  const mini = minis[miniBlockNumber - 1];
  const paths = ["All", "Start", "Character", "Structure", "Scenes", "Dialogue", "Revision", "Tools"];
  const recommendedIds = miniBlockNumber === 1 ? ["concept", "dynamic-scenes", "visual-writing"] : miniBlockNumber === 2 ? ["character", "dialogue", "subtext"] : miniBlockNumber === 3 ? ["dramatic-question", "inner-journey", "pacing"] : ["theme", "silence", "revision"];
  const filtered = useMemo(() => lessons.filter((lesson) => {
    const haystack = `${lesson.title} ${lesson.summary} ${lesson.path} ${lesson.tags.join(" ")}`.toLowerCase();
    return (path === "All" || lesson.path === path) && haystack.includes(query.trim().toLowerCase());
  }).sort((left, right) => Number(recommendedIds.includes(right.id)) - Number(recommendedIds.includes(left.id))), [path, query, recommendedIds.join("|")]);

  function applyLesson(lesson: Lesson) {
    if (lesson.apply === "Screenplay") onOpenScreenplay();
    else if (lesson.apply === "Block plan") onOpenBlock(block.number);
    else onOpenTreatment();
  }

  return <div className={styles.page}>
    <header className={styles.header}><div><span>Read & Learn</span><h1>Learn the craft while building the story.</h1><p>Short lessons from the PlotPickle screenwriting library follow the current Block and mini-block, then point directly to the workspace where the idea can be applied.</p></div><div className={styles.licence}><strong>Shared teaching, private writing</strong><span>Educational guidance: CC BY-SA 4.0</span><small>Your original story and screenplay remain yours.</small></div></header>

    <section className={styles.position}>
      <div><span>Current story position</span><h2>Block {block.number}.{mini.number}: {mini.label}</h2><p>{mini.function}</p></div>
      <label>Block<select value={blockNumber} onChange={(event) => { onBlockChange(Number(event.target.value)); onMiniBlockChange(1); }}>{project.blocks.map((item) => <option value={item.number} key={item.id}>{item.number} · {item.title}</option>)}</select></label>
      <label>Mini-block<select value={miniBlockNumber} onChange={(event) => onMiniBlockChange(Number(event.target.value))}>{minis.map((item) => <option value={item.number} key={item.id}>{block.number}.{item.number} · {item.label}</option>)}</select></label>
    </section>

    <section className={styles.filters}>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scenes, dialogue, subtext, character, pacing…" aria-label="Search screenwriting lessons" />
      <div>{paths.map((item) => <button type="button" className={path === item ? styles.active : ""} onClick={() => setPath(item)} key={item}>{item}</button>)}</div>
    </section>

    <main className={styles.lessonGrid}>{filtered.map((lesson) => <article className={recommendedIds.includes(lesson.id) ? styles.recommended : ""} key={lesson.id}>
      <div className={styles.lessonHead}><span>{lesson.path}</span>{recommendedIds.includes(lesson.id) ? <strong>Recommended here</strong> : null}</div>
      <h2>{lesson.title}</h2><p>{lesson.summary}</p>
      <ul>{lesson.principles.map((principle) => <li key={principle}>{principle}</li>)}</ul>
      <div className={styles.exercise}><span>Apply it to Block {block.number}.{mini.number}</span><p>{lesson.exercise}</p></div>
      <button type="button" onClick={() => applyLesson(lesson)}>Open {lesson.apply}</button>
    </article>)}</main>
    {!filtered.length ? <div className={styles.empty}>No lesson matches that search. Try a craft term such as scene, character, dialogue, theme or revision.</div> : null}
  </div>;
}
