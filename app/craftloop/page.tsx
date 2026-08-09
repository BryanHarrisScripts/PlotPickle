"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type PlotPickleProject,
} from "@/lib/project";
import { scanPageFlowDraft } from "@/lib/pageflow";
import styles from "./craftloop.module.css";

const STORAGE_KEY = "plotpickle.project.v1";

type PickleKey =
  | "centralTension"
  | "audienceQuestion"
  | "expectedDestination"
  | "unpredictableRoute"
  | "signatureMove";
type StoryKey = "hook" | "theme" | "catalyst";
type WorldKey = "ordinaryWorld";
type BlockKey =
  | "audienceExpectation"
  | "pickleTurn"
  | "goal"
  | "conflict"
  | "choice"
  | "action"
  | "consequence"
  | "emotionalTurn"
  | "scriptExcerpt"
  | "storyboardDirection";
type DialogueKey = "fieldworkNotes" | "subtext";
type PitchKey = "oneSentence" | "shortPitch";
type NoteKey = "research";

function filled(values: Array<string | undefined>) {
  return values.filter((value) => value?.trim()).length;
}

function calculateCoverage(project: PlotPickleProject, blockNumber: number, characterId: string) {
  const block = project.blocks.find((candidate) => candidate.number === blockNumber) ?? project.blocks[0];
  const opening = project.blocks[0];
  const character = project.characters.find((candidate) => candidate.id === characterId) ?? project.characters[0];
  const page = scanPageFlowDraft(block.scriptExcerpt);

  const audience = filled([
    project.development.pickle.centralTension,
    project.development.pickle.audienceQuestion,
    project.development.pickle.expectedDestination,
    project.development.pickle.unpredictableRoute,
    project.development.pickle.signatureMove,
    block.audienceExpectation,
    block.pickleTurn,
  ]);
  const openingContract = filled([
    project.story.hook,
    project.story.theme,
    project.story.catalyst,
    project.world.ordinaryWorld,
    opening.summary,
    opening.conflict,
  ]);
  const sceneTurn = filled([
    block.goal,
    block.conflict,
    block.choice || block.action,
    block.consequence,
    block.emotionalTurn,
  ]);
  const pressure = character
    ? filled([character.want, character.need, character.ghost, character.fatalFlaw, character.arc])
    : 0;
  const voice = character
    ? filled([
        character.voice,
        project.development.dialogue.fieldworkNotes,
        project.development.dialogue.subtext,
        project.development.dialogue.voiceContrast,
      ])
    : filled([
        project.development.dialogue.fieldworkNotes,
        project.development.dialogue.subtext,
        project.development.dialogue.voiceContrast,
      ]);
  const pageReady = block.scriptExcerpt.trim()
    ? Math.round((page.signal / 100) * 3) + filled([block.storyboardDirection])
    : 0;
  const pitch = filled([
    project.development.pitch.oneSentence,
    project.development.pitch.shortPitch,
  ]);

  const signal = Math.round(
    (audience / 7) * 16 +
      (openingContract / 6) * 14 +
      (sceneTurn / 5) * 20 +
      (pressure / 5) * 14 +
      (voice / 4) * 12 +
      (pageReady / 4) * 14 +
      (pitch / 2) * 10,
  );

  return {
    audience,
    openingContract,
    sceneTurn,
    pressure,
    voice,
    pageReady,
    pitch,
    signal: Math.max(0, Math.min(100, signal)),
  };
}

function Field({
  label,
  help,
  value,
  onChange,
  rows = 6,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      <small>{help}</small>
    </label>
  );
}

function EvidenceCard({ label, value, empty }: { label: string; value: string; empty: string }) {
  return (
    <article className={styles.evidenceCard}>
      <span>{label}</span>
      <p>{value || empty}</p>
    </article>
  );
}

export default function CraftLoopPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(1);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Loading the active PlotPickle project…");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setStatus("No saved project was found. Open PlotPickle or begin with the blank project shown here.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) {
          setStatus("The saved project could not be upgraded. A blank project is shown instead.");
          return;
        }
        setProject(normalized);
        setSelectedCharacterId(normalized.characters[0]?.id ?? "");
        setStatus("Connected to the active PlotPickle project.");
      } catch {
        setStatus("The saved project could not be opened. A blank project is shown instead.");
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const selectedBlock = project.blocks.find((block) => block.number === selectedBlockNumber) ?? project.blocks[0];
  const openingBlock = project.blocks[0];
  const selectedCharacter = project.characters.find((character) => character.id === selectedCharacterId) ?? project.characters[0];
  const pageScan = useMemo(() => scanPageFlowDraft(selectedBlock.scriptExcerpt), [selectedBlock.scriptExcerpt]);
  const coverage = useMemo(
    () => calculateCoverage(project, selectedBlockNumber, selectedCharacterId),
    [project, selectedBlockNumber, selectedCharacterId],
  );

  function commit(next: PlotPickleProject, message = "Saved to this device.") {
    const updated: PlotPickleProject = {
      ...next,
      metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
    };
    setProject(updated);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setStatus(message);
  }

  function updatePickle(key: PickleKey, value: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        pickle: { ...project.development.pickle, [key]: value },
      },
    });
  }

  function updateStory(key: StoryKey, value: string) {
    commit({ ...project, story: { ...project.story, [key]: value } });
  }

  function updateWorld(key: WorldKey, value: string) {
    commit({ ...project, world: { ...project.world, [key]: value } });
  }

  function updateBlock(key: BlockKey, value: string) {
    commit({
      ...project,
      blocks: project.blocks.map((block) =>
        block.number === selectedBlock.number ? { ...block, [key]: value } : block,
      ),
    });
  }

  function updateDialogue(key: DialogueKey, value: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        dialogue: { ...project.development.dialogue, [key]: value },
      },
    });
  }

  function updatePitch(key: PitchKey, value: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        pitch: { ...project.development.pitch, [key]: value },
      },
    });
  }

  function updateNote(key: NoteKey, value: string) {
    commit({
      ...project,
      development: {
        ...project.development,
        notes: { ...project.development.notes, [key]: value },
      },
    });
  }

  function updateCharacterVoice(value: string) {
    if (!selectedCharacter) return;
    commit({
      ...project,
      characters: project.characters.map((character) =>
        character.id === selectedCharacter.id ? { ...character, voice: value } : character,
      ),
    });
  }

  function exportProject() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plotpickle-project"}.plotpickle.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Project exported with the current CraftLoop work.");
  }

  const pageSignals = [
    ...pageScan.invisible.map((item) => `Invisible: ${item}`),
    ...pageScan.weak.map((item) => `Weak phrase: ${item}`),
    ...pageScan.directing.map((item) => `Direction: ${item}`),
    ...pageScan.emotions.map((item) => `Emotion label: ${item}`),
    ...(pageScan.longParagraphs ? [`Dense paragraphs: ${pageScan.longParagraphs}`] : []),
  ];

  return (
    <main className={`${styles.page} standalone-studio-surface`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>PlotPickle Playhouse · Deliberate-practice workspace</p>
            <h1>CraftLoop Engine</h1>
            <p>
              Apply the complete method to one block: engage the audience, establish the contract, turn the scene, increase
              character-specific pressure, observe human language, compress the page, and explain the story clearly.
            </p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.secondaryButton} href="/?workspace=refine">Back to Refine</Link>
            <Link className={styles.secondaryButton} href="/resonance">Resonance</Link>
            <Link className={styles.secondaryButton} href="/voiceprint">Voiceprint</Link>
            <Link className={styles.secondaryButton} href="/pageflow">PageFlow</Link>
            <Link className={styles.secondaryButton} href="/draftlens">DraftLens</Link>
            <button className={styles.button} type="button" onClick={exportProject}>Export project</button>
          </div>
        </header>

        <section className={styles.projectBar}>
          <div className={styles.projectTitle}>
            <strong>{project.metadata.title}</strong>
            <span>Project schema {project.schemaVersion} · {project.metadata.status}</span>
          </div>
          <label>
            <span>Practice block</span>
            <select value={selectedBlock.number} onChange={(event) => setSelectedBlockNumber(Number(event.target.value))}>
              {project.blocks.map((block) => <option value={block.number} key={block.id}>Block {block.number}: {block.title}</option>)}
            </select>
          </label>
          <label>
            <span>Character pressure</span>
            <select value={selectedCharacter?.id ?? ""} onChange={(event) => setSelectedCharacterId(event.target.value)} disabled={!project.characters.length}>
              {project.characters.map((character) => <option value={character.id} key={character.id}>{character.name} · {character.role}</option>)}
            </select>
          </label>
        </section>

        <section className={styles.signalPanel} aria-label="CraftLoop practice coverage signal">
          <div>
            <p className={styles.kicker}>Practice coverage</p>
            <div className={styles.signalNumber}>{coverage.signal}<span>/100</span></div>
            <p>This measures whether enough evidence exists for a complete practice pass. It is not a quality grade.</p>
          </div>
          <div className={styles.signalDetails}>
            <div className={styles.meter}><span style={{ width: `${coverage.signal}%` }} /></div>
            <div className={styles.metricGrid}>
              <div><strong>{coverage.audience}/7</strong><span>audience game</span></div>
              <div><strong>{coverage.openingContract}/6</strong><span>opening contract</span></div>
              <div><strong>{coverage.sceneTurn}/5</strong><span>scene turn</span></div>
              <div><strong>{coverage.pressure}/5</strong><span>character pressure</span></div>
              <div><strong>{coverage.voice}/4</strong><span>human voice</span></div>
              <div><strong>{coverage.pageReady}/4</strong><span>page evidence</span></div>
              <div><strong>{coverage.pitch}/2</strong><span>pitch clarity</span></div>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Pass 1 · Audience game</p>
            <h2>Give the audience something active to track.</h2>
            <p>Define the live question, the expected route, and the block-level change in audience belief.</p>
          </div>
          <div className={styles.twoColumns}>
            <Field label="Central tension" help="What unresolved force keeps the story active?" value={project.development.pickle.centralTension} onChange={(value) => updatePickle("centralTension", value)} />
            <Field label="Audience question" help="What is the audience trying to solve, predict, or understand?" value={project.development.pickle.audienceQuestion} onChange={(value) => updatePickle("audienceQuestion", value)} />
            <Field label="Expected destination" help="Where does the audience currently think the story is going?" value={project.development.pickle.expectedDestination} onChange={(value) => updatePickle("expectedDestination", value)} />
            <Field label="Unpredictable route" help="How can the journey remain earned without becoming obvious?" value={project.development.pickle.unpredictableRoute} onChange={(value) => updatePickle("unpredictableRoute", value)} />
            <Field label={`Block ${selectedBlock.number} audience expectation`} help="What does the audience believe before this block turns?" value={selectedBlock.audienceExpectation} onChange={(value) => updateBlock("audienceExpectation", value)} />
            <Field label={`Block ${selectedBlock.number} reframe`} help="What clue, reversal, complication, or near-answer changes that belief?" value={selectedBlock.pickleTurn} onChange={(value) => updateBlock("pickleTurn", value)} />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Pass 2 · Opening contract</p>
            <h2>Introduce enough to create trust and curiosity.</h2>
            <p>The opening should establish image, world, character pressure, question, and promise without explaining everything.</p>
          </div>
          <div className={styles.twoColumns}>
            <Field label="Opening hook" help="The first compelling image, condition, action, or contradiction." value={project.story.hook} onChange={(value) => updateStory("hook", value)} />
            <Field label="Ordinary world" help="The normal pattern the story is about to disturb." value={project.world.ordinaryWorld} onChange={(value) => updateWorld("ordinaryWorld", value)} />
            <Field label="Catalyst" help="The disruption that changes what the protagonist can continue doing." value={project.story.catalyst} onChange={(value) => updateStory("catalyst", value)} />
            <Field label="Theme pressure" help="The question or competing belief the opening begins to test." value={project.story.theme} onChange={(value) => updateStory("theme", value)} />
          </div>
          <div className={styles.evidenceGrid}>
            <EvidenceCard label="Block 1 purpose" value={openingBlock.purpose} empty="No opening purpose recorded." />
            <EvidenceCard label="Block 1 summary" value={openingBlock.summary} empty="No opening summary recorded." />
            <EvidenceCard label="Block 1 conflict" value={openingBlock.conflict} empty="No opening conflict recorded." />
            <EvidenceCard label="Opening image progression" value={openingBlock.storyboardDirection} empty="No opening visual sequence recorded." />
          </div>
        </section>

        <div className={styles.workspace}>
          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Pass 3 · Scene turn</p>
              <h2>Make Block {selectedBlock.number} end differently than it began.</h2>
              <p>Information matters most when it changes intention, power, understanding, risk, or action.</p>
            </div>
            <Field label="Goal or immediate condition" help="What is the character trying to accomplish or preserve?" value={selectedBlock.goal} onChange={(value) => updateBlock("goal", value)} />
            <Field label="Conflict and resistance" help="What specifically stands in the way?" value={selectedBlock.conflict} onChange={(value) => updateBlock("conflict", value)} />
            <div className={styles.twoColumns}>
              <Field label="Choice" help="What decision reveals strategy or character?" value={selectedBlock.choice} onChange={(value) => updateBlock("choice", value)} />
              <Field label="Action" help="What does the character actually do?" value={selectedBlock.action} onChange={(value) => updateBlock("action", value)} />
              <Field label="Consequence" help="What becomes newly true because of that action or choice?" value={selectedBlock.consequence} onChange={(value) => updateBlock("consequence", value)} />
              <Field label="Emotional turn" help="How does the felt meaning or relationship change?" value={selectedBlock.emotionalTurn} onChange={(value) => updateBlock("emotionalTurn", value)} />
            </div>
          </section>

          <aside className={styles.characterPanel}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>Pass 4 · Character pressure</p>
              <h2>{selectedCharacter?.name ?? "No character selected"}</h2>
              <p>Increase difficulty by attacking this character&apos;s strategy, belief, status, relationship, or emotional limit.</p>
            </div>
            {selectedCharacter ? (
              <div className={styles.characterGrid}>
                <EvidenceCard label="Want" value={selectedCharacter.want} empty="Not defined" />
                <EvidenceCard label="Need" value={selectedCharacter.need} empty="Not defined" />
                <EvidenceCard label="Ghost" value={selectedCharacter.ghost} empty="Not defined" />
                <EvidenceCard label="Fatal flaw" value={selectedCharacter.fatalFlaw} empty="Not defined" />
                <EvidenceCard label="Arc" value={selectedCharacter.arc} empty="Not defined" />
                <EvidenceCard label="Current block pressure" value={selectedBlock.conflict} empty="No block conflict recorded." />
              </div>
            ) : <p className={styles.empty}>Add a character in Story Planner to run the pressure pass.</p>}
          </aside>
        </div>

        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Pass 5 · Human voice</p>
            <h2>Observe motive, rhythm, silence, and status.</h2>
            <p>Look beyond the obvious reason for a line. People often speak from several motives at the same time.</p>
          </div>
          <div className={styles.twoColumns}>
            <Field label="Selected character voice" help="The concise scene-ready voice rule shared with Voiceprint." value={selectedCharacter?.voice ?? ""} onChange={updateCharacterVoice} rows={8} />
            <Field label="Fieldwork observations" help="Record cadence, fillers, corrections, silence, topic changes, and status shifts observed in real speech." value={project.development.dialogue.fieldworkNotes ?? ""} onChange={(value) => updateDialogue("fieldworkNotes", value)} rows={8} />
            <Field label="Subtext strategy" help="What is concealed, redirected, negotiated, or communicated indirectly?" value={project.development.dialogue.subtext} onChange={(value) => updateDialogue("subtext", value)} rows={8} />
            <EvidenceCard label="Voice contrast" value={project.development.dialogue.voiceContrast} empty="No project-wide voice contrast recorded." />
          </div>
        </section>

        <section className={styles.pagePanel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Pass 6 · Page compression</p>
            <h2>Make every word create visible movement.</h2>
            <p>Use active verbs, concrete evidence, useful white space, and precise image progression.</p>
          </div>
          <div className={styles.pageWorkspace}>
            <Field label="Page draft" help="Shared PageFlow screenplay text for this block." value={selectedBlock.scriptExcerpt} onChange={(value) => updateBlock("scriptExcerpt", value)} rows={18} />
            <aside className={styles.pageSignal}>
              <div className={styles.pageScore}>{pageScan.signal}<span>/100</span></div>
              <p>PageFlow editorial signal</p>
              <div className={styles.stats}>
                <span>{pageScan.words} words</span>
                <span>{pageScan.paragraphs} action paragraphs</span>
                <span>{pageScan.averageSentence} words per sentence</span>
              </div>
              {pageSignals.length ? (
                <div className={styles.chips}>{pageSignals.map((item) => <span key={item}>{item}</span>)}</div>
              ) : <p className={styles.empty}>No current PageFlow signals. Continue refining for voice and dramatic effect.</p>}
            </aside>
          </div>
          <Field label="Visible sequence" help="The image progression shared with PageFlow and Visual Board." value={selectedBlock.storyboardDirection} onChange={(value) => updateBlock("storyboardDirection", value)} rows={8} />
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Pass 7 · Pitch and reflect</p>
            <h2>Explain the story with confidence and remain open to discovery.</h2>
            <p>A pitch tests whether the story engine is clear. Craft study should produce an original experiment, not imitation.</p>
          </div>
          <div className={styles.twoColumns}>
            <Field label="One-sentence pitch" help="The clearest statement of protagonist, pressure, action, stakes, and distinction." value={project.development.pitch.oneSentence} onChange={(value) => updatePitch("oneSentence", value)} rows={5} />
            <Field label="Short spoken pitch" help="A concise, energetic explanation that communicates the experience without pretending every solution is fixed." value={project.development.pitch.shortPitch} onChange={(value) => updatePitch("shortPitch", value)} rows={9} />
            <Field label="Comparative craft study" help="Record a technique observed in produced work, the principle underneath it, and how you will test that principle originally. This shares the project Research field." value={project.development.notes.research} onChange={(value) => updateNote("research", value)} rows={10} />
            <EvidenceCard label="Signature execution" value={project.development.pickle.signatureMove} empty="Define the distinctive move that makes this project recognizably itself." />
          </div>
        </section>

        <section className={styles.loopPanel}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>Repeatable studio loop</p>
            <h2>Practise with evidence, not just advice.</h2>
          </div>
          <ol>
            <li><strong>Audience.</strong><span>What are viewers tracking and what changes their belief?</span></li>
            <li><strong>Opening.</strong><span>What promise, image, world, character, and pressure are established?</span></li>
            <li><strong>Turn.</strong><span>What becomes different because this block happened?</span></li>
            <li><strong>Pressure.</strong><span>Why is this obstacle uniquely difficult for this character?</span></li>
            <li><strong>Voice.</strong><span>What motive, rhythm, silence, and status are audible?</span></li>
            <li><strong>Page.</strong><span>Can the action become more visible, active, precise, and economical?</span></li>
            <li><strong>Pitch.</strong><span>Can the writer communicate the story clearly and still remain flexible?</span></li>
          </ol>
        </section>

        <p className={styles.status} aria-live="polite">{hydrated ? status : "Loading the active PlotPickle project…"}</p>
      </div>
    </main>
  );
}
