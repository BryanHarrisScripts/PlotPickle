"use client";

import { blockWritingEntry } from "@/core/contracts/block-writing";
import { normalizeProjectSourceEvidence } from "@/core/contracts/imported-screenplay-evidence";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import { STORY_CARD_MINI_LABELS, storyCardActRows } from "@/modules/plan/story-card-board";

export default function ActWrittenStoryBoard({ project, act }: { readonly project: LibraryPPFProject; readonly act: number }) {
  const screenplay = normalizeProjectSourceEvidence(project.sourceEvidence).screenplay;
  const row = storyCardActRows(project.structure).find((candidate) => candidate.actNumber === act);
  if (!row) return null;

  return (
    <section className="pp-skin-v1-story-card-board pp-skin-v1-written-act-board" aria-labelledby="written-act-board-title" data-written-act-board={act}>
      <header className="pp-skin-v1-story-card-board-heading">
        <div>
          <p>WRITTEN STORY · ACT {act}</p>
          <h2 id="written-act-board-title">Plan Act {act} with the script.</h2>
          <span>Read the PPF screenplay at each Block and Mini-Block. Saved Write text replaces the imported passage at that address.</span>
        </div>
        <div className="pp-skin-v1-story-card-board-key">
          <strong>{project.title || "Untitled Story"}</strong>
          <small>Blocks {String(row.blocks[0]?.number ?? 1).padStart(2, "0")}–{String(row.blocks.at(-1)?.number ?? 1).padStart(2, "0")}</small>
        </div>
      </header>
      {screenplay?.passagesTruncated ? <p role="status">Only part of the imported screenplay is stored in this PPF. Passage coverage may be incomplete.</p> : null}
      <div className="pp-skin-v1-story-card-act-stack">
        <section className="pp-skin-v1-story-card-act" aria-label={`Act ${act} written story`}>
          <header><strong>ACT {act} · WRITTEN STORY</strong><span>Six Blocks · 24 Mini-Blocks</span></header>
          <div className="pp-skin-v1-story-card-row">
            {row.blocks.map((block) => {
              const placeholder = `Block ${String(block.number).padStart(2, "0")}`;
              const sectionTitle = screenplay?.sectionMarkers?.find((marker) => marker.blockNumber === block.number)?.title;
              const title = block.title !== placeholder ? block.title : sectionTitle || placeholder;
              const miniSections = block.miniBlocks.map((mini, index) => {
                const address = { blockNumber: block.number, miniBlockNumber: index + 1 };
                const saved = blockWritingEntry(project.writing, address);
                const passages = screenplay?.passages.filter((passage) => passage.blockNumber === block.number && passage.miniBlockNumber === address.miniBlockNumber) ?? [];
                return { index, saved, passages };
              });
              const hasText = miniSections.some(({ saved, passages }) => saved || passages.length);
              return (
                <article className="pp-skin-v1-story-card" data-written-block={block.number} key={block.id}>
                  <header className="pp-skin-v1-story-card-topline">
                    <div><strong>ACT {act} · BLOCK {((block.number - 1) % 6) + 1}</strong><small>PPF Block {String(block.number).padStart(2, "0")} · S{String(block.sequenceNumber).padStart(2, "0")}</small></div>
                  </header>
                  <h3>{title}</h3>
                  {hasText ? miniSections.map(({ index, saved, passages }) => {
                    if (!saved && !passages.length) return null;
                    return (
                      <section className="pp-skin-v1-written-act-mini" aria-label={`Block ${block.number} ${STORY_CARD_MINI_LABELS[index]}`} key={index}>
                        <h4>{index + 1} · {STORY_CARD_MINI_LABELS[index]}</h4>
                        {saved ? (
                          <div><small>Saved PPF writing</small><p>{saved.text}</p></div>
                        ) : (
                          <div><small>Imported screenplay · {screenplay?.analysisStatus === "reviewed" ? "reviewed mapping" : "suggested placement"}</small>
                            {passages.map((passage) => <p key={passage.id}>{passage.text}</p>)}
                          </div>
                        )}
                      </section>
                    );
                  }) : <p className="pp-skin-v1-written-act-empty">No script mapped to this Block yet.</p>}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
