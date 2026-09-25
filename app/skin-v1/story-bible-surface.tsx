"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { plotPickleCurriculum } from "../../adapters/curriculum/current-catalog";
import {
  WORLD_MAP_CHARACTER_VIEWS,
  approveWorldMapCharacterVisualPackage,
  upsertWorldMapCharacterVisualPackage,
  worldMapCharacterVisualPackage,
  type WorldMapCharacterVisualReference,
} from "../../core/contracts/world-map";
import { projectStoryBible, type StoryBibleCharacter, type StoryBibleFact, type StoryBibleFactGroup } from "../../core/project/story-bible-projection";
import { saveActiveLibraryProject } from "../../core/storage/project-library-browser";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import styles from "./story-bible-surface.module.css";

type AgentResponse = { readonly text?: string; readonly message?: string };
type ImageResponse = {
  readonly ok?: boolean;
  readonly assetUrl?: string;
  readonly revisedPrompt?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly message?: string;
};

function Fact({ fact }: { readonly fact: StoryBibleFact }) {
  return (
    <article className={styles.fact} data-story-bible-fact-state={fact.state}>
      <strong>{fact.label}</strong>
      <p>{fact.value}</p>
      <small>{fact.source}</small>
    </article>
  );
}

function FactGroup({ group }: { readonly group: StoryBibleFactGroup }) {
  return (
    <section className={styles.group}>
      <h3>{group.title}</h3>
      <div className={styles.factGrid}>
        {group.facts.map((fact) => <Fact key={fact.id} fact={fact} />)}
      </div>
    </section>
  );
}

function compactWorldContext(project: LibraryPPFProject) {
  return {
    title: project.title,
    revision: project.revision,
    foundationsBrief: project.foundations.brief.content.slice(0, 3000),
    worldBrief: project.world.brief.content.slice(0, 3000),
    blocks: project.structure.blocks.map((block) => ({
      number: block.number,
      act: block.actNumber,
      title: block.title,
      note: block.note.slice(0, 320),
    })),
    writing: project.writing.entries.slice(-32).map((entry) => ({
      block: entry.blockNumber,
      mini: entry.miniBlockNumber,
      text: entry.text.slice(0, 420),
    })),
    screenplay: (project.sourceEvidence.screenplay?.passages ?? []).slice(0, 36).map((passage) => ({
      id: passage.id,
      block: passage.blockNumber,
      mini: passage.miniBlockNumber,
      text: passage.text.slice(0, 280),
    })),
    characterTruth: (project.sourceEvidence.characterTruth?.claims ?? [])
      .filter((claim) => claim.reviewState !== "rejected" && claim.handling === "writer-reference" && claim.kind !== "sensitive-source")
      .slice(0, 40)
      .map((claim) => ({ characters: claim.characterIds, kind: claim.kind, summary: claim.summary.slice(0, 320) })),
  };
}

function worldFactAddress(fact: StoryBibleFact) {
  const [scope, lessonId, fieldId] = fact.id.split(":");
  return scope === "world" && lessonId && fieldId ? { lessonId, fieldId } : null;
}

function WorldFactEditor({ fact, project }: { readonly fact: StoryBibleFact; readonly project: LibraryPPFProject }) {
  const address = worldFactAddress(fact);
  const [proposal, setProposal] = useState("");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [notice, setNotice] = useState("");

  async function askWorldAgent() {
    if (!address || state === "working") return;
    setState("working");
    setNotice("World agent is reviewing current project evidence…");
    try {
      const response = await fetch("/api/writing-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "world",
          modelRole: "quality",
          tone: "direct",
          conversationMode: true,
          message: [
            "WORLD_MAP_FIELD_PROPOSAL_REQUEST",
            `Propose one concise, useful answer for this exact World Map field: "${fact.label}".`,
            "Base the proposal only on supplied project evidence. If evidence is incomplete, state a careful working proposal rather than claiming it is established canon. Return only the proposed field value; no headings, JSON or process notes.",
            JSON.stringify({
              currentValue: fact.state === "not-established" ? "" : fact.value,
              target: address,
              context: compactWorldContext(project),
            }),
          ].join("\n\n"),
        }),
      });
      const result = await response.json() as AgentResponse;
      const text = result.text?.trim() ?? "";
      if (!response.ok || !text) throw new Error(result.message || "World agent returned no proposal.");
      setProposal(text.slice(0, 12_000));
      setNotice("Proposal ready. Edit it if needed, then Save / Accept to make it a World decision.");
      setState("idle");
    } catch (error) {
      setState("error");
      setNotice(error instanceof Error ? error.message : "World agent proposal failed.");
    }
  }

  function saveProposal() {
    if (!address || !proposal.trim()) return;
    const now = new Date().toISOString();
    const lesson = project.world.lessons[address.lessonId] ?? { answers: {}, updatedAt: null };
    saveActiveLibraryProject({
      ...project,
      revision: project.revision + 1,
      updatedAt: now,
      world: {
        ...project.world,
        lessons: {
          ...project.world.lessons,
          [address.lessonId]: {
            ...lesson,
            answers: { ...lesson.answers, [address.fieldId]: proposal.trim().slice(0, 12_000) },
            updatedAt: now,
          },
        },
      },
    });
    setProposal("");
    setNotice("Saved as an accepted World decision.");
    setState("idle");
  }

  return (
    <article className={styles.fact} data-story-bible-fact-state={fact.state} data-world-map-agent-field={address ? "true" : "false"}>
      <strong>{fact.label}</strong>
      <p>{fact.value}</p>
      <small>{fact.source}</small>
      {address ? (
        <div className={styles.agentEditor}>
          <button type="button" disabled={state === "working"} onClick={() => void askWorldAgent()}>
            {state === "working" ? "World Agent working…" : "Ask World Agent"}
          </button>
          {proposal ? (
            <>
              <label>
                <span>Agent proposal · edit before saving</span>
                <textarea rows={5} value={proposal} onChange={(event) => setProposal(event.target.value)} />
              </label>
              <div className={styles.actions}>
                <button type="button" onClick={saveProposal}>Save / Accept</button>
                <button type="button" onClick={() => { setProposal(""); setNotice("Proposal discarded. Canon was not changed."); }}>Discard proposal</button>
              </div>
            </>
          ) : null}
          {notice ? <small role="status">{notice}</small> : null}
        </div>
      ) : null}
    </article>
  );
}

function WorldFactGroup({ group, project }: { readonly group: StoryBibleFactGroup; readonly project: LibraryPPFProject }) {
  return (
    <section className={styles.group}>
      <h3>{group.title}</h3>
      <div className={styles.factGrid}>
        {group.facts.map((fact) => <WorldFactEditor key={fact.id} fact={fact} project={project} />)}
      </div>
    </section>
  );
}

function characterVisualEvidence(character: StoryBibleCharacter, project: LibraryPPFProject) {
  const claims = (project.sourceEvidence.characterTruth?.claims ?? [])
    .filter((claim) => claim.characterIds.includes(character.id)
      && claim.reviewState !== "rejected"
      && claim.handling === "writer-reference"
      && claim.kind !== "sensitive-source")
    .map((claim) => `${claim.kind}: ${claim.summary}`)
    .slice(0, 18);
  return [
    `Character: ${character.name}.`,
    ...claims,
    project.world.brief.content.trim() ? `World context: ${project.world.brief.content.slice(0, 1800)}` : "",
  ].filter(Boolean).join(" ");
}

function CharacterVisualSheet({ character, project }: { readonly character: StoryBibleCharacter; readonly project: LibraryPPFProject }) {
  const visualPackage = worldMapCharacterVisualPackage(project.worldMap, character.id);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const draftCount = visualPackage?.references.filter((reference) => reference.reviewState === "draft").length ?? 0;
  const approvedCount = visualPackage?.references.filter((reference) => reference.reviewState === "approved").length ?? 0;
  const completeViewCoverage = WORLD_MAP_CHARACTER_VIEWS.every((view) => (
    visualPackage?.references.some((reference) => reference.view === view.id) ?? false
  ));

  async function generateSheet() {
    if (working) return;
    const billingAcknowledged = window.confirm("Generate eight character-reference views? A connected cloud image provider may charge the API account saved by this user. PlotPickle does not supply credits or pay for generation.");
    if (!billingAcknowledged) {
      setNotice("Character visual generation cancelled. No provider request was made.");
      return;
    }
    setWorking(true);
    const generated: WorldMapCharacterVisualReference[] = [];
    const failures: string[] = [];
    const existingApproved = visualPackage?.references.filter((reference) => reference.reviewState === "approved").map((reference) => reference.assetUrl) ?? [];
    const identityEvidence = characterVisualEvidence(character, project);
    try {
      for (let index = 0; index < WORLD_MAP_CHARACTER_VIEWS.length; index += 1) {
        const view = WORLD_MAP_CHARACTER_VIEWS[index];
        setNotice(`Generating ${index + 1} of ${WORLD_MAP_CHARACTER_VIEWS.length} · ${view.label}…`);
        const prompt = [
          `Create a production character reference for ${character.name}.`,
          identityEvidence,
          `Reference view: ${view.label}. ${view.directive}`,
          "Preserve the exact same identity, apparent age, face, hair, proportions, wardrobe baseline and distinguishing features across every view.",
          "Single character, neutral studio background, production-reference lighting, no text, no border, no collage.",
          "If a physical trait is not established by the supplied evidence, keep it neutral and proposal-level rather than presenting an invented trait as canon.",
        ].join(" ");
        try {
          const identityReference = generated[0]?.assetUrl ?? existingApproved[0] ?? "";
          const response = await fetch("/api/local-ai/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              characterId: character.id,
              assetId: `world-map-character-${character.id}-${view.id}`,
              aspect: "portrait",
              quality: "low",
              referenceImages: identityReference ? [identityReference] : [],
              requestCount: 1,
              billingAcknowledged: true,
            }),
          });
          const result = await response.json() as ImageResponse;
          if (!response.ok || !result.ok || !result.assetUrl) throw new Error(result.message || "Image provider returned no image.");
          generated.push({
            id: globalThis.crypto.randomUUID(),
            characterId: character.id,
            characterName: character.name,
            view: view.id,
            assetUrl: result.assetUrl,
            prompt: result.revisedPrompt || prompt,
            provider: result.provider || "configured image route",
            model: result.model || "",
            createdAt: new Date().toISOString(),
            reviewState: "draft",
          });
        } catch (error) {
          failures.push(`${view.label}: ${error instanceof Error ? error.message : "generation failed"}`);
        }
      }

      if (generated.length) {
        const now = new Date().toISOString();
        const nextPackage = {
          characterId: character.id,
          characterName: character.name,
          references: [...(visualPackage?.references ?? []), ...generated],
          approvedAt: visualPackage?.approvedAt ?? null,
          updatedAt: now,
        };
        saveActiveLibraryProject({
          ...project,
          revision: project.revision + 1,
          updatedAt: now,
          worldMap: upsertWorldMapCharacterVisualPackage(project.worldMap, nextPackage),
        });
      }
      setNotice(
        `${generated.length} of ${WORLD_MAP_CHARACTER_VIEWS.length} draft character views generated.`
        + (failures.length ? ` ${failures.join(" ")}` : " Review the sheet, then approve it before Storyboard can use it."),
      );
    } finally {
      setWorking(false);
    }
  }

  function approveSheet() {
    if (!visualPackage?.references.some((reference) => reference.reviewState === "draft")) return;
    const now = new Date().toISOString();
    saveActiveLibraryProject({
      ...project,
      revision: project.revision + 1,
      updatedAt: now,
      worldMap: approveWorldMapCharacterVisualPackage(project.worldMap, character.id, now),
    });
    setNotice("Character visual package approved and locked for downstream Storyboard reference use.");
  }

  return (
    <div className={styles.visualSheet} data-world-map-character-visual={character.id}>
      <div className={styles.actions}>
        <button type="button" disabled={working} onClick={() => void generateSheet()}>
          {working ? "Generating character views…" : "Generate Character Visual"}
        </button>
        <button type="button" disabled={!draftCount || !completeViewCoverage || working} onClick={approveSheet}>Approve / Lock Character Visuals</button>
      </div>
      <small>{approvedCount} approved · {draftCount} draft · target {WORLD_MAP_CHARACTER_VIEWS.length} governed views{completeViewCoverage ? "" : " · complete all eight views before approval"}</small>
      {visualPackage?.references.length ? (
        <div className={styles.referenceGrid}>
          {WORLD_MAP_CHARACTER_VIEWS.map((view) => {
            const reference = [...visualPackage.references].reverse().find((item) => item.view === view.id);
            return reference ? (
              <figure key={view.id} data-review-state={reference.reviewState}>
                <Image src={reference.assetUrl} alt={`${character.name} · ${view.label}`} width={240} height={320} unoptimized />
                <figcaption>{view.label} · {reference.reviewState.toUpperCase()}</figcaption>
              </figure>
            ) : (
              <div className={styles.referenceEmpty} key={view.id}>{view.label}<br />NOT GENERATED</div>
            );
          })}
        </div>
      ) : null}
      {notice ? <small role="status">{notice}</small> : null}
    </div>
  );
}

export default function StoryBibleSurface({ project }: { readonly project: LibraryPPFProject }) {
  const bible = useMemo(() => projectStoryBible(project, plotPickleCurriculum), [project]);

  return (
    <main
      className={styles.surface}
      aria-labelledby="story-bible-title"
      data-story-bible-surface="canonical"
      data-world-map-surface="review"
      data-story-bible-project-id={bible.projectId}
      data-story-bible-read-only="false"
    >
      <section className={styles.hero}>
        <div className={styles.poster}>
          {bible.posterUrl ? (
            <Image
              src={bible.posterUrl}
              alt={`${bible.title} poster / marketing reference`}
              width={640}
              height={960}
              unoptimized
            />
          ) : (
            <div className={styles.posterEmpty} role="img" aria-label="No poster yet">NO POSTER YET</div>
          )}
          <small>{bible.posterLabel}</small>
        </div>

        <div className={styles.identity}>
          <p className={styles.kicker}>WORLD MAP · STORY BIBLE · HUMAN-REVIEWED DEVELOPMENT</p>
          <h1 id="story-bible-title">{bible.title}</h1>
          <p className={styles.meta}>PPF REVISION {bible.revision} · UPDATED {bible.updatedAt || "UNKNOWN"}</p>
          <div className={styles.spotlight}>
            <Fact fact={bible.logline} />
            <Fact fact={bible.premise} />
            <Fact fact={bible.theme} />
            <Fact fact={bible.tone} />
            <Fact fact={bible.stakes} />
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="story-bible-plot">
        <header>
          <p className={styles.kicker}>PLOT / STRUCTURE</p>
          <h2 id="story-bible-plot">4 Acts · 12 Sequences · 24 Blocks · 96 Mini-Blocks</h2>
        </header>
        <div className={styles.blockGrid}>
          {bible.blocks.map((block) => (
            <article key={block.number} className={styles.block} data-story-bible-established={block.established ? "true" : "false"}>
              <small>ACT {block.actNumber} · SEQUENCE {block.sequenceNumber} · BLOCK {String(block.number).padStart(2, "0")}</small>
              <strong>{block.title}</strong>
              <p>{block.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="story-bible-characters">
        <header>
          <p className={styles.kicker}>CHARACTERS</p>
          <h2 id="story-bible-characters">Character truth, backstory and reusable visual identity</h2>
        </header>
        {bible.characters.length ? (
          <div className={styles.characterGrid}>
            {bible.characters.map((character) => (
              <article key={character.id} className={styles.character}>
                <div className={styles.characterImage}>
                  {character.imageUrl ? (
                    <Image src={character.imageUrl} alt={character.name} width={420} height={420} unoptimized />
                  ) : (
                    <div role="img" aria-label={`No approved image for ${character.name}`}>NO APPROVED CHARACTER IMAGE YET</div>
                  )}
                </div>
                <h3>{character.name}</h3>
                <CharacterVisualSheet character={character} project={project} />
                {character.facts.length ? (
                  <div className={styles.characterFacts}>
                    {character.facts.map((fact) => <Fact key={fact.id} fact={fact} />)}
                  </div>
                ) : <p className={styles.empty}>Not established yet.</p>}
              </article>
            ))}
          </div>
        ) : <p className={styles.empty}>Character truth has not been established for this story yet.</p>}
      </section>

      <section className={styles.section} aria-labelledby="story-bible-foundations">
        <header>
          <p className={styles.kicker}>FOUNDATIONS / WRITER DECISIONS</p>
          <h2 id="story-bible-foundations">What PlotPickle already knows</h2>
        </header>
        <div className={styles.groupStack}>
          {bible.foundationGroups.map((group) => <FactGroup key={group.id} group={group} />)}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="story-bible-world">
        <header>
          <p className={styles.kicker}>WORLD / CONTINUITY</p>
          <h2 id="story-bible-world">Places, rules, chronology, genre and known constraints</h2>
          <p>Ask the World agent for a proposal, edit it, then explicitly Save / Accept before it becomes a canonical World decision.</p>
        </header>
        <div className={styles.groupStack}>
          {bible.worldGroups.map((group) => <WorldFactGroup key={group.id} group={group} project={project} />)}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="story-bible-sources">
        <header>
          <p className={styles.kicker}>PROVENANCE</p>
          <h2 id="story-bible-sources">Canonical evidence currently available</h2>
        </header>
        <div className={styles.factGrid}>
          {bible.sourceSummary.map((fact) => <Fact key={fact.id} fact={fact} />)}
        </div>
      </section>

      {bible.curriculumScope.length ? (
        <section className={styles.section} aria-labelledby="story-bible-curriculum">
          <header>
            <p className={styles.kicker}>CURRICULUM CONTRACT</p>
            <h2 id="story-bible-curriculum">What belongs in a living Story Bible</h2>
          </header>
          <ul className={styles.scopeList}>
            {bible.curriculumScope.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
