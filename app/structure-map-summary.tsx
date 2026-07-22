import Link from "next/link";
import { type PlotPickleProject } from "@/lib/project";
import { buildStoryClock, secondsToTimecode } from "@/lib/structure";
import styles from "./structure-map-summary.module.css";

const actNames = ["Setup", "Confrontation", "Complication", "Resolution"];

function sequenceProgress(sequence: PlotPickleProject["structure"]["sequences"][number]) {
  const values = [
    sequence.question,
    sequence.promise,
    sequence.escalation,
    sequence.climax,
    sequence.turningPoint,
    sequence.result,
  ];
  return Math.round((values.filter((value) => value.trim()).length / values.length) * 100);
}

export default function StructureMapSummary({
  project,
  onOpenBlock,
}: {
  project: PlotPickleProject;
  onOpenBlock: (number: number) => void;
}) {
  const clock = buildStoryClock(project);
  const allScenes = project.blocks.flatMap((block) => block.scenes);
  const allMinis = allScenes.flatMap((scene) => scene.miniBlocks);
  const shortSceneCount = allMinis.reduce((sum, mini) => sum + mini.shortScenes.length, 0);
  const totalBeats = allMinis.reduce((sum, mini) => sum + mini.beatTarget, 0);
  const totalShots = allMinis.reduce((sum, mini) => sum + mini.shotTarget, 0);
  const sequenceRows = clock.filter((row) => row.level === "sequence");

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>ST · Structure Map</p>
          <h1>See the complete dramatic hierarchy before entering the full engine.</h1>
          <p>
            This map summarizes four acts, twelve sequences, twenty-four blocks, the project&apos;s live scene count, and ninety-six structural mini-blocks. The 48-scene starting template is guidance, not a restriction.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link href="/structure">Open full Structure Engine <span aria-hidden="true">→</span></Link>
          <small>The full engine adds, deletes, duplicates, reorders and moves scenes while preserving mini-block structure and timing.</small>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Structure totals">
        <article><strong>4</strong><span>Acts</span></article>
        <article><strong>12</strong><span>Sequences</span></article>
        <article><strong>24</strong><span>Blocks</span></article>
        <article><strong>{allScenes.length}</strong><span>Scenes</span></article>
        <article><strong>{allMinis.length}</strong><span>Mini-blocks</span></article>
        <article><strong>{shortSceneCount}</strong><span>Short scenes</span></article>
      </section>

      <section className={styles.clockStrip}>
        <div><span>Target runtime</span><strong>{project.metadata.targetMinutes} minutes</strong></div>
        <div><span>Pacing profile</span><strong>{project.structure.pacingProfile.replaceAll("-", " ")}</strong></div>
        <div><span>Planned beats</span><strong>{totalBeats}</strong></div>
        <div><span>Shot targets</span><strong>{totalShots}</strong></div>
      </section>

      <div className={styles.acts}>
        {[1, 2, 3, 4].map((act) => (
          <section className={styles.act} key={act}>
            <header>
              <div><span>Act {act}</span><h2>{actNames[act - 1]}</h2></div>
              <small>{secondsToTimecode((act - 1) * project.metadata.targetMinutes * 15)}–{secondsToTimecode(act * project.metadata.targetMinutes * 15)}</small>
            </header>
            <div className={styles.sequenceGrid}>
              {project.structure.sequences.filter((sequence) => sequence.act === act).map((sequence) => {
                const row = sequenceRows.find((item) => item.id === sequence.id);
                const completion = sequenceProgress(sequence);
                return (
                  <article className={styles.sequenceCard} key={sequence.id}>
                    <div className={styles.sequenceHead}>
                      <span>{String(sequence.number).padStart(2, "0")}</span>
                      <div><small>Sequence {sequence.number}</small><h3>{sequence.title}</h3></div>
                      <strong>{completion}%</strong>
                    </div>
                    <p>{sequence.question || sequence.purpose}</p>
                    <div className={styles.progress}><i style={{ width: `${completion}%` }} /></div>
                    <div className={styles.timeRow}>
                      <span>{row ? `${secondsToTimecode(row.startSeconds)}–${secondsToTimecode(row.endSeconds)}` : `${sequence.targetMinutes.toFixed(1)} min`}</span>
                      <span>{sequence.blockNumbers.map((number) => `B${number}`).join(" + ")}</span>
                    </div>
                    <div className={styles.blockButtons}>
                      {sequence.blockNumbers.map((number) => {
                        const block = project.blocks[number - 1];
                        return (
                          <button type="button" key={number} onClick={() => onOpenBlock(number)}>
                            <span>Block {number}</span>
                            <strong>{block.title}</strong>
                            <small>{block.scenes.length} scenes · {block.scenes.flatMap((scene) => scene.miniBlocks).length} mini-blocks</small>
                          </button>
                        );
                      })}
                    </div>
                    <footer>
                      <span>Turning point</span>
                      <p>{sequence.turningPoint || "Not yet defined in the Structure Engine."}</p>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
