"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { plotPickleCurriculum } from "../../adapters/curriculum/current-catalog";
import {
  WORLD_MAP_CHARACTER_MAX_VERSIONS,
  WORLD_MAP_CHARACTER_VIEWS,
  approvedWorldMapCharacterReferences,
  lockWorldMapCharacterVisualVersion,
  saveWorldMapCharacterVisualVersion,
  worldMapCharacterVisualVersions,
  type WorldMapCharacterVisualReference,
} from "../../core/contracts/world-map";
import {
  MARKETING_REFERENCE_MAX_VERSIONS,
  lockedMarketingReference,
  marketingReferenceVersions,
  type MarketingReferenceArtifact,
} from "../../core/contracts/build-progress";
import { projectStoryBible, type StoryBibleCharacter, type StoryBibleFact, type StoryBibleFactGroup } from "../../core/project/story-bible-projection";
import { applyStoryCommand } from "../../core/project/apply-command";
import { saveActiveLibraryProject } from "../../core/storage/project-library-browser";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import {
  createFirstMarketingReferenceArtifact,
  deriveMarketingContextV1,
} from "../../modules/learn/model/marquee-director";
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
      setNotice("Proposal ready. Read or edit it, then choose Save, Redo, or Discard.");
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
              <div className={styles.actions} data-world-agent-review-actions="three-decision">
                <button type="button" onClick={saveProposal}>Save</button>
                <button type="button" disabled={state === "working"} onClick={() => { setProposal(""); void askWorldAgent(); }}>Redo</button>
                <button type="button" onClick={() => { setProposal(""); setNotice("Proposal discarded. Canon was not changed."); }}>Discard</button>
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

function worldMapPosterPrompt(input: {
  readonly title: string;
  readonly logline: string;
  readonly characterNames: readonly string[];
  readonly foundationsBrief: string;
  readonly worldBrief: string;
}) {
  const featuredCharacters = input.characterNames.filter(Boolean).slice(0, 6);
  const billing = [
    "A PLOTPICKLE PRODUCTION",
    `FEATURED CHARACTERS: ${featuredCharacters.length ? featuredCharacters.join(", ") : "TBD"}`,
    "ACTOR CAST: TBD",
    "DIRECTED BY TBD",
    "PRODUCED BY TBD",
    "MUSICAL SCORE BY TBD",
  ].join(" · ");
  return [
    `Create one professional theatrical movie poster for "${input.title}".`,
    `Primary story logline: ${input.logline}`,
    input.foundationsBrief.trim() ? `Established Foundations context: ${input.foundationsBrief.trim().slice(0, 1_500)}` : "",
    input.worldBrief.trim() ? `Established WorldMap context: ${input.worldBrief.trim().slice(0, 1_500)}` : "",
    "Create cinematic key art with one clear focal idea, strong title hierarchy and a conventional lower billing/footer zone.",
    `Render the project title exactly as: ${input.title}`,
    `Billing/footer intent: ${billing}`,
    "Character names are story-character placeholders only. Do not invent actor identities, director names, producer names, composer names, critic quotes, awards, release dates, studio logos or platform logos.",
    "Keep every unknown personnel identity as TBD. This is a marketing reference, not story canon.",
  ].filter(Boolean).join("\n");
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
  const versions = worldMapCharacterVisualVersions(project.worldMap, character.id);
  const lockedReferences = approvedWorldMapCharacterReferences(project.worldMap, character.id);
  const lockedIndex = Math.max(0, versions.findIndex((version) => version.locked));
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(lockedIndex);
  const [candidate, setCandidate] = useState<Readonly<{
    versionId: string;
    references: readonly WorldMapCharacterVisualReference[];
  }> | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const safeVersionIndex = Math.min(selectedVersionIndex, Math.max(versions.length - 1, 0));
  const selectedVersion = versions[safeVersionIndex] ?? null;
  const displayedReferences = candidate?.references ?? selectedVersion?.references ?? [];
  const completeCandidateCoverage = WORLD_MAP_CHARACTER_VIEWS.every((view) => (
    displayedReferences.some((reference) => reference.view === view.id)
  ));
  const atVersionLimit = versions.length >= WORLD_MAP_CHARACTER_MAX_VERSIONS;

  async function generateSheet() {
    if (working || candidate || atVersionLimit) return;
    const billingAcknowledged = window.confirm("Generate eight character-reference views? A connected cloud image provider may charge the API account saved by this user. PlotPickle does not supply credits or pay for generation.");
    if (!billingAcknowledged) {
      setNotice("Character visual generation cancelled. No provider request was made.");
      return;
    }
    setWorking(true);
    const versionId = globalThis.crypto?.randomUUID?.() ?? `worldmap-character-version-${Date.now()}`;
    const generated: WorldMapCharacterVisualReference[] = [];
    const failures: string[] = [];
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
          const identityReference = generated[0]?.assetUrl ?? lockedReferences[0] ?? "";
          const response = await fetch("/api/local-ai/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              characterId: character.id,
              assetId: `world-map-character-${character.id}-${versionId}-${view.id}`,
              aspect: "portrait",
              quality: "low",
              referenceImages: identityReference ? [identityReference] : [],
              requestCount: 1,
              billingAcknowledged: true,
            }),
          });
          const result = await response.json() as ImageResponse;
          if (!response.ok || !result.ok || !result.assetUrl) throw new Error(result.message || "Image provider returned no image.");
          if (!result.assetUrl.startsWith("/api/local-ai/assets/")) throw new Error("Generated character media was not saved to PlotPickle local assets.");
          generated.push({
            id: globalThis.crypto?.randomUUID?.() ?? `worldmap-character-${character.id}-${Date.now()}-${index}`,
            versionId,
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
        setCandidate({ versionId, references: generated });
        setNotice(
          `${generated.length} of ${WORLD_MAP_CHARACTER_VIEWS.length} character views generated but NOT SAVED. Choose Save to keep this generation with the story.`
          + (failures.length ? ` ${failures.join(" ")}` : ""),
        );
      } else {
        setNotice(failures.join(" ") || "No character views were generated.");
      }
    } finally {
      setWorking(false);
    }
  }

  function saveCandidate() {
    if (!candidate || atVersionLimit) return;
    const now = new Date().toISOString();
    const worldMap = saveWorldMapCharacterVisualVersion(project.worldMap, {
      characterId: character.id,
      characterName: character.name,
      versionId: candidate.versionId,
      references: candidate.references,
      savedAt: now,
    });
    saveActiveLibraryProject({
      ...project,
      revision: project.revision + 1,
      updatedAt: now,
      worldMap,
    });
    setCandidate(null);
    setSelectedVersionIndex(0);
    setNotice("SAVED locally with this story. You can keep up to five versions and lock one for downstream use.");
  }

  function lockSelectedVersion() {
    if (!selectedVersion?.complete || selectedVersion.locked) return;
    const now = new Date().toISOString();
    saveActiveLibraryProject({
      ...project,
      revision: project.revision + 1,
      updatedAt: now,
      worldMap: lockWorldMapCharacterVisualVersion(project.worldMap, character.id, selectedVersion.id, now),
    });
    setNotice("LOCKED. This saved character generation is now the only WorldMap identity package used downstream.");
  }

  return (
    <div className={styles.visualSheet} data-world-map-character-visual={character.id}>
      <div className={styles.actions}>
        <button
          className={styles.primaryAction}
          type="button"
          disabled={working || Boolean(candidate) || atVersionLimit}
          onClick={() => void generateSheet()}
        >
          {working ? "Generating character views…" : atVersionLimit ? "5 Saved Versions" : "Generate Character Visual"}
        </button>
        {candidate ? (
          <button type="button" disabled={!candidate.references.length || atVersionLimit || working} onClick={saveCandidate}>
            Save
          </button>
        ) : selectedVersion ? (
          <button type="button" disabled={!selectedVersion.complete || selectedVersion.locked || working} onClick={lockSelectedVersion}>
            Lock
          </button>
        ) : null}
      </div>

      <div className={styles.versionBar} aria-label={`${character.name} saved character versions`}>
        <button
          aria-label="Previous saved version"
          disabled={Boolean(candidate) || safeVersionIndex <= 0}
          onClick={() => setSelectedVersionIndex((index) => Math.max(0, index - 1))}
          type="button"
        >‹</button>
        <strong>
          {candidate
            ? `UNSAVED · ${candidate.references.length}/${WORLD_MAP_CHARACTER_VIEWS.length} views`
            : selectedVersion
              ? `${safeVersionIndex + 1}/${versions.length}`
              : "0/0"}
        </strong>
        <button
          aria-label="Next saved version"
          disabled={Boolean(candidate) || safeVersionIndex >= versions.length - 1}
          onClick={() => setSelectedVersionIndex((index) => Math.min(versions.length - 1, index + 1))}
          type="button"
        >›</button>
      </div>

      <small>{versions.length}/{WORLD_MAP_CHARACTER_MAX_VERSIONS} saved generation{versions.length === 1 ? "" : "s"} · exactly one may be locked</small>
      {displayedReferences.length ? (
        <div className={styles.referenceGrid}>
          {WORLD_MAP_CHARACTER_VIEWS.map((view) => {
            const reference = displayedReferences.find((item) => item.view === view.id);
            return reference ? (
              <figure
                key={view.id}
                data-review-state={candidate ? "candidate" : selectedVersion?.locked ? "approved" : "draft"}
              >
                <div className={styles.referenceFrame}>
                  <Image src={reference.assetUrl} alt={`${character.name} · ${view.label}`} width={240} height={320} unoptimized />
                  {!candidate ? <span className={`${styles.versionBadge} ${styles.savedBadge}`}>Saved locally</span> : null}
                  {!candidate && selectedVersion?.locked ? <span className={`${styles.versionBadge} ${styles.lockedBadge}`}>Locked</span> : null}
                </div>
                <figcaption>{view.label}</figcaption>
              </figure>
            ) : (
              <div className={styles.referenceEmpty} key={view.id}>{view.label}<br />NOT GENERATED</div>
            );
          })}
        </div>
      ) : null}
      {candidate && !completeCandidateCoverage ? <small>Partial generation may be saved, but only a complete eight-view saved version can be locked.</small> : null}
      {notice ? <small role="status">{notice}</small> : null}
    </div>
  );
}

export default function StoryBibleSurface({ project }: { readonly project: LibraryPPFProject }) {
  const bible = useMemo(() => projectStoryBible(project, plotPickleCurriculum), [project]);
  const posterVersions = useMemo(
    () => marketingReferenceVersions(project.build.foundations.visualArtifacts),
    [project.build.foundations.visualArtifacts],
  );
  const lockedPoster = useMemo(
    () => lockedMarketingReference(project.build.foundations.visualArtifacts, project.build.foundations.acceptedVisualArtifactIds),
    [project.build.foundations.visualArtifacts, project.build.foundations.acceptedVisualArtifactIds],
  );
  const initialPosterIndex = Math.max(0, posterVersions.findIndex((artifact) => artifact.id === lockedPoster?.id));
  const [posterVersionIndex, setPosterVersionIndex] = useState(initialPosterIndex);
  const [posterCandidate, setPosterCandidate] = useState<MarketingReferenceArtifact | null>(null);
  const [posterWorking, setPosterWorking] = useState(false);
  const [posterNotice, setPosterNotice] = useState("");
  const safePosterIndex = Math.min(posterVersionIndex, Math.max(posterVersions.length - 1, 0));
  const selectedPoster = posterVersions[safePosterIndex] ?? null;
  const displayedPoster = posterCandidate ?? selectedPoster;
  const posterAtVersionLimit = posterVersions.length >= MARKETING_REFERENCE_MAX_VERSIONS;

  async function generatePosterVisual() {
    if (posterWorking || posterCandidate || posterAtVersionLimit) return;
    if (bible.logline.state === "not-established" || !bible.logline.value.trim()) {
      setPosterNotice("Establish the story logline before generating the WorldMap poster.");
      return;
    }
    const billingAcknowledged = window.confirm("Generate one WorldMap poster using the configured image route? A connected cloud image provider may charge the API account saved by this user. PlotPickle does not supply credits or pay for generation.");
    if (!billingAcknowledged) {
      setPosterNotice("Poster generation cancelled. No provider request was made.");
      return;
    }

    setPosterWorking(true);
    setPosterNotice("Generating the WorldMap poster to local PlotPickle assets. It will remain UNSAVED until you choose Save.");
    const prompt = worldMapPosterPrompt({
      title: bible.title,
      logline: bible.logline.value,
      characterNames: bible.characters.map((character) => character.name),
      foundationsBrief: project.foundations.brief.content,
      worldBrief: project.world.brief.content,
    });

    try {
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          assetId: `worldmap-poster-${project.id}-${Date.now()}`,
          aspect: "portrait",
          quality: "low",
          requestCount: 1,
          billingAcknowledged: true,
        }),
      });
      const result = await response.json() as ImageResponse;
      if (!response.ok || !result.ok || !result.assetUrl) throw new Error(result.message || "Image provider returned no poster.");
      if (!result.assetUrl.startsWith("/api/local-ai/assets/")) {
        throw new Error("The generated poster was not saved in PlotPickle local asset storage.");
      }

      const now = new Date().toISOString();
      const context = deriveMarketingContextV1(project);
      const baseArtifact = createFirstMarketingReferenceArtifact({
        id: globalThis.crypto?.randomUUID?.() ?? `worldmap-poster-${Date.now()}`,
        assetUrl: result.assetUrl,
        prompt: result.revisedPrompt || prompt,
        createdAt: now,
        provider: result.provider || "configured image route",
        model: result.model || "",
        context,
      });
      setPosterCandidate({
        ...baseArtifact,
        narrativeIntention: "PPF Marketing Reference · WorldMap poster",
        sourceDecisionKeys: [
          ...(baseArtifact.sourceDecisionKeys ?? []),
          "surface:worldmap",
          "billing:actor-cast:tbd",
          "billing:director:tbd",
          "billing:producer:tbd",
          "billing:musical-score:tbd",
        ],
      });
      setPosterNotice("Poster generated but NOT SAVED. Choose Save to keep it with this story.");
    } catch (error) {
      setPosterNotice(error instanceof Error ? error.message : "The WorldMap poster could not be generated.");
    } finally {
      setPosterWorking(false);
    }
  }

  function savePosterVersion() {
    if (!posterCandidate || posterAtVersionLimit) return;
    const now = new Date().toISOString();
    const next = applyStoryCommand(project, {
      type: "foundations.visual.store",
      artifact: posterCandidate,
      occurredAt: now,
    }) as LibraryPPFProject;
    saveActiveLibraryProject(next);
    setPosterCandidate(null);
    setPosterVersionIndex(0);
    setPosterNotice("SAVED locally with this story. You can keep up to five poster versions and lock one.");
  }

  function lockPosterVersion() {
    if (!selectedPoster || selectedPoster.id === lockedPoster?.id) return;
    const now = new Date().toISOString();
    let next: LibraryPPFProject = project;
    for (const artifact of posterVersions) {
      if (artifact.id !== selectedPoster.id && project.build.foundations.acceptedVisualArtifactIds.includes(artifact.id)) {
        next = applyStoryCommand(next, {
          type: "foundations.visual.unaccept",
          artifactId: artifact.id,
          occurredAt: now,
        }) as LibraryPPFProject;
      }
    }
    next = applyStoryCommand(next, {
      type: "foundations.visual.accept",
      artifactId: selectedPoster.id,
      occurredAt: now,
    }) as LibraryPPFProject;
    saveActiveLibraryProject(next);
    setPosterNotice("LOCKED. This saved poster is now the selected WorldMap Marketing Reference; other saved versions remain available.");
  }

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
          <div className={styles.posterFrame}>
            {displayedPoster ? (
              <Image
                src={displayedPoster.assetUrl}
                alt={`${bible.title} poster / marketing reference`}
                width={640}
                height={960}
                unoptimized
              />
            ) : (
              <div className={styles.posterEmpty} role="img" aria-label="No poster yet">NO POSTER YET</div>
            )}
            {!posterCandidate && selectedPoster ? <span className={`${styles.versionBadge} ${styles.savedBadge}`}>Saved locally</span> : null}
            {!posterCandidate && selectedPoster?.id === lockedPoster?.id ? <span className={`${styles.versionBadge} ${styles.lockedBadge}`}>Locked</span> : null}
          </div>

          <div className={styles.versionBar} aria-label="Saved poster versions">
            <button
              aria-label="Previous saved version"
              disabled={Boolean(posterCandidate) || safePosterIndex <= 0}
              onClick={() => setPosterVersionIndex((index) => Math.max(0, index - 1))}
              type="button"
            >‹</button>
            <strong>
              {posterCandidate
                ? "UNSAVED · generated candidate"
                : selectedPoster
                  ? `${safePosterIndex + 1}/${posterVersions.length}`
                  : "0/0"}
            </strong>
            <button
              aria-label="Next saved version"
              disabled={Boolean(posterCandidate) || safePosterIndex >= posterVersions.length - 1}
              onClick={() => setPosterVersionIndex((index) => Math.min(posterVersions.length - 1, index + 1))}
              type="button"
            >›</button>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primaryAction}
              disabled={posterWorking || Boolean(posterCandidate) || posterAtVersionLimit}
              onClick={() => void generatePosterVisual()}
              type="button"
            >
              {posterWorking ? "Generating Poster…" : posterAtVersionLimit ? "5 Saved Versions" : "Generate Poster Visual"}
            </button>
            {posterCandidate ? (
              <button disabled={posterWorking || posterAtVersionLimit} onClick={savePosterVersion} type="button">Save</button>
            ) : selectedPoster ? (
              <button disabled={selectedPoster.id === lockedPoster?.id} onClick={lockPosterVersion} type="button">Lock</button>
            ) : null}
          </div>
          <small>{posterVersions.length}/{MARKETING_REFERENCE_MAX_VERSIONS} saved poster version{posterVersions.length === 1 ? "" : "s"} · exactly one may be locked</small>
          {posterNotice ? <small role="status">{posterNotice}</small> : null}
        </div>

        <div className={styles.identity}>
          <p className={styles.kicker}>WORLDMAP · STORY BIBLE · HUMAN-REVIEWED DEVELOPMENT</p>
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
          <p>Ask the World agent for a proposal, read or edit it, then choose Save, Redo, or Discard. Only Save makes it a canonical World decision.</p>
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
