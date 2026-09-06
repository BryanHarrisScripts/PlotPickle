"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import { UiAction } from "../foundation/ui-action";
import { UiStateSurface } from "../foundation/ui-state-surface";
import { StoryPieceCard } from "./story-piece-card";
import styles from "./story-zero-workspace.module.css";

export type StoryZeroProject = {
  id: string;
  revision: string;
  title: string;
};

export type StoryZeroModel =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "project"; project: StoryZeroProject };

function currentProject(): StoryZeroProject | null {
  try {
    const project = loadFoundationProject();
    return {
      id: project.id,
      revision: String(project.revision),
      title: project.title || "Untitled Story",
    };
  } catch {
    return null;
  }
}

export function StoryZeroWorkspaceView({ model }: { model: StoryZeroModel }) {
  const router = useRouter();
  const hasProject = model.kind === "project";

  return (
    <main className={styles.workspace} data-story-zero-state={model.kind}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>PlotPickle / STORY — THE UNWRITTEN</p>
          <h1>Turn what you have built into something you can play.</h1>
          <p className={styles.lede}>
            STORY turns characters, locations, objects, conflicts, secrets and rules into choices with visible consequences. Your project stays the source; play never silently rewrites canon.
          </p>
        </div>
        <div className={styles.context} aria-label="Current STORY context">
          <span>Project</span>
          <strong>{hasProject ? model.project.title : model.kind === "loading" ? "Checking…" : "None selected"}</strong>
          <span>Session</span>
          <strong>No active STORY session</strong>
        </div>
      </header>

      {model.kind === "loading" ? (
        <UiStateSurface
          state="loading"
          eyebrow="Finding your place"
          title="Checking the current PlotPickle project…"
          message="Your work is not being changed. STORY is only looking for the project you already chose."
        />
      ) : null}

      {model.kind === "empty" ? (
        <UiStateSurface
          state="empty"
          eyebrow="Start here"
          title="Choose the story you want to make playable."
          message="STORY does not create a shadow project. Pick an existing PlotPickle story first, then build only the pieces needed for the scene you want to test."
          detail="Nothing becomes canon simply because you play it."
          action={(
            <UiAction variant="primary" data-pp-primary-probe="true" onClick={() => router.push("/library")}>
              Choose a story
            </UiAction>
          )}
        />
      ) : null}

      {model.kind === "project" ? (
        <UiStateSurface
          state="ideal"
          eyebrow="Current project found"
          title={`${model.project.title} is ready to become a playable setup.`}
          message="The next step is to prepare the small working set STORY needs: who is here, where they are, what matters now, and what rules constrain the choice."
          detail={`Project revision ${model.project.revision}. STORY will reference this project rather than duplicate it.`}
          action={(
            <UiAction variant="primary" data-pp-primary-probe="true" onClick={() => router.push("/?workspace=build")}>
              Prepare playable setup
            </UiAction>
          )}
        />
      ) : null}

      <section className={styles.loop} aria-labelledby="story-loop-title">
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>The loop</p>
          <h2 id="story-loop-title">Build a little. Play it. See what changed. Keep going.</h2>
        </div>
        <ol className={styles.steps}>
          <li data-current={model.kind === "empty" ? "true" : undefined}><span>1</span><div><strong>Choose</strong><p>Use the PlotPickle project you are already shaping.</p></div></li>
          <li data-current={model.kind === "project" ? "true" : undefined}><span>2</span><div><strong>Prepare</strong><p>Bring only the relevant Story Pieces and bounded rules into the scene.</p></div></li>
          <li><span>3</span><div><strong>Validate</strong><p>STORY checks what is legal and explains what needs attention before play.</p></div></li>
          <li><span>4</span><div><strong>Play</strong><p>Make a choice, resolve it deterministically, then see the consequence.</p></div></li>
        </ol>
      </section>

      <section className={styles.pieces} aria-labelledby="story-pieces-title">
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Story Pieces</p>
          <h2 id="story-pieces-title">Familiar story material becomes playable context.</h2>
          <p>These are the kinds of pieces STORY can draw from. They are examples of the grammar, not claims about your current project.</p>
        </div>
        <div className={styles.pieceGrid}>
          <StoryPieceCard type="Character" title="Who wants something?" description="A person with goals, knowledge, relationships and limits." />
          <StoryPieceCard type="Location" title="Where is this happening?" description="The active place and the constraints that come with it." />
          <StoryPieceCard type="Conflict" title="What makes the choice matter?" description="Pressure that turns story information into a meaningful decision." />
          <StoryPieceCard type="Rule" title="What must stay true?" description="A bounded, visible mechanic that the deterministic validator can enforce." />
        </div>
      </section>

      <aside className={styles.reassurance} aria-label="STORY authority boundary">
        <strong>Play safely.</strong>
        <p>AI may suggest. STORY validates and resolves. PPF remains the durable canon authority. You can explore without accidentally rewriting your story.</p>
      </aside>
    </main>
  );
}

export default function StoryZeroWorkspace() {
  const [model, setModel] = useState<StoryZeroModel>({ kind: "loading" });

  useEffect(() => {
    const project = currentProject();
    setModel(project ? { kind: "project", project } : { kind: "empty" });
  }, []);

  return <StoryZeroWorkspaceView model={model} />;
}
