"use client";

import type { FormEvent } from "react";
import {
  graphicNovelStoryBriefCompletion,
  type GraphicNovelStoryBrief,
} from "@/lib/graphic-novel-story-brief";
import styles from "./graphic-novel-story-brief.module.css";

type Props = {
  brief: GraphicNovelStoryBrief;
  working: boolean;
  onSave: (brief: GraphicNovelStoryBrief) => void;
  onReset: () => void;
};

type BriefField = Exclude<keyof GraphicNovelStoryBrief, "updatedAt">;

const fields: Array<{ name: BriefField; label: string; help: string }> = [
  { name: "storyPromise", label: "Story promise", help: "What the complete visual story promises the audience." },
  { name: "audienceExperience", label: "Audience experience", help: "The feeling, tension and emotional flavour each page should sustain." },
  { name: "emotionalArc", label: "Emotional arc", help: "Where the protagonist begins, how pressure changes them and what the ending proves." },
  { name: "visualThesis", label: "Visual thesis", help: "The unifying artistic idea behind composition, texture and imagery." },
  { name: "worldAtmosphere", label: "World atmosphere", help: "Period, culture, physical rules, technology and sensory texture." },
  { name: "cameraLanguage", label: "Camera language", help: "Preferred shot grammar, perspective, movement and visual emphasis." },
  { name: "lightingContrast", label: "Lighting and contrast", help: "How black, white, shadow, practical light and negative space carry meaning." },
  { name: "pacingRhythm", label: "Panel rhythm", help: "How pages alternate geography, performance, pressure, reveals and page turns." },
  { name: "recurringMotifs", label: "Recurring motifs", help: "Images, shapes, objects, gestures or environments that should return deliberately." },
  { name: "continuityRules", label: "Continuity rules", help: "What must remain visually stable across all 96 panels." },
  { name: "avoid", label: "Avoid", help: "Project-specific visual mistakes, clichés, anachronisms or unwanted imagery." },
];

export default function GraphicNovelStoryBriefEditor({ brief, working, onSave, onReset }: Props) {
  const completion = graphicNovelStoryBriefCompletion(brief);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: BriefField) => String(data.get(name) || "").trim();
    onSave({
      storyPromise: value("storyPromise"),
      audienceExperience: value("audienceExperience"),
      emotionalArc: value("emotionalArc"),
      visualThesis: value("visualThesis"),
      worldAtmosphere: value("worldAtmosphere"),
      cameraLanguage: value("cameraLanguage"),
      lightingContrast: value("lightingContrast"),
      pacingRhythm: value("pacingRhythm"),
      recurringMotifs: value("recurringMotifs"),
      continuityRules: value("continuityRules"),
      avoid: value("avoid"),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <section className={styles.panel} aria-labelledby="graphic-novel-story-brief-title">
      <div className={styles.heading}>
        <div>
          <span>Phase 6 · Whole-story direction</span>
          <h2 id="graphic-novel-story-brief-title">Graphic Novel Story Brief</h2>
          <p>Set the visual and emotional rules once. PlotPickle combines this brief with each panel’s canonical action, character objective, resistance, turn, shot and continuity context.</p>
        </div>
        <strong>{completion.completed}/{completion.total} directions · {completion.percent}%</strong>
      </div>

      <form key={brief.updatedAt} onSubmit={submit}>
        <div className={styles.grid}>
          {fields.map((field) => {
            const helpId = `graphic-novel-brief-${field.name}-help`;
            return (
              <label key={field.name}>
                <span>{field.label}</span>
                <small id={helpId}>{field.help}</small>
                <textarea
                  name={field.name}
                  defaultValue={brief[field.name]}
                  rows={4}
                  disabled={working}
                  aria-describedby={helpId}
                />
              </label>
            );
          })}
        </div>

        <div className={styles.actions}>
          <button type="button" disabled={working} onClick={onReset}>Refill from canonical story</button>
          <button type="submit" className={styles.primary} disabled={working}>Save brief and refresh 96 prompts</button>
        </div>
        <p className={styles.note}>Completed art and queue decisions are preserved. The Story Brief affects image prompts only; dialogue and captions remain separate editable text.</p>
      </form>
    </section>
  );
}
