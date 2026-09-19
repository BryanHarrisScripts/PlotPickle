"use client";

import Image from "next/image";
import { useMemo } from "react";
import { plotPickleCurriculum } from "../../adapters/curriculum/current-catalog";
import { projectStoryBible, type StoryBibleFact, type StoryBibleFactGroup } from "../../core/project/story-bible-projection";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import styles from "./story-bible-surface.module.css";

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

export default function StoryBibleSurface({ project }: { readonly project: LibraryPPFProject }) {
  const bible = useMemo(() => projectStoryBible(project, plotPickleCurriculum), [project]);

  return (
    <main
      className={styles.surface}
      aria-labelledby="story-bible-title"
      data-story-bible-surface="canonical"
      data-story-bible-project-id={bible.projectId}
      data-story-bible-read-only="true"
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
          <p className={styles.kicker}>STORY BIBLE · READ-ONLY REFERENCE</p>
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
          <h2 id="story-bible-characters">Character truth and backstory</h2>
        </header>
        {bible.characters.length ? (
          <div className={styles.characterGrid}>
            {bible.characters.map((character) => (
              <article key={character.id} className={styles.character}>
                <div className={styles.characterImage}>
                  {character.imageUrl ? (
                    <Image src={character.imageUrl} alt={character.name} width={420} height={420} unoptimized />
                  ) : (
                    <div role="img" aria-label={`No approved image for ${character.name}`}>NO CHARACTER IMAGE YET</div>
                  )}
                </div>
                <h3>{character.name}</h3>
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
          <h2 id="story-bible-world">Places, rules, chronology and known constraints</h2>
        </header>
        <div className={styles.groupStack}>
          {bible.worldGroups.map((group) => <FactGroup key={group.id} group={group} />)}
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
