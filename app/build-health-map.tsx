"use client";

import type {
  BuildBlockCard,
  BuildBlockStatus,
  BuildEvidenceStatus,
} from "@/lib/build-workspace-model";
import styles from "./build-health-map.module.css";

type HealthTone = "green" | "yellow" | "red";
type HealthStatus = BuildBlockStatus | "missing";

const ACT_LABELS = ["Setup", "Confrontation", "Complication", "Resolution"] as const;

const STATUS_META: Record<HealthStatus, { tone: HealthTone; label: string; symbol: string }> = {
  locked: { tone: "green", label: "Locked", symbol: "✓" },
  ready: { tone: "green", label: "Ready", symbol: "✓" },
  developing: { tone: "yellow", label: "Developing", symbol: "!" },
  empty: { tone: "red", label: "Empty", symbol: "×" },
  missing: { tone: "red", label: "Missing", symbol: "×" },
};

const EVIDENCE_META: Record<BuildEvidenceStatus, { label: string; symbol: string }> = {
  defined: { label: "Defined", symbol: "●" },
  observed: { label: "Observed", symbol: "◉" },
  emerging: { label: "Emerging", symbol: "◇" },
  missing: { label: "Missing", symbol: "○" },
  locked: { label: "Locked", symbol: "◌" },
};

function shortTitle(card: BuildBlockCard | undefined) {
  if (!card) return "Missing Block";
  return card.title.trim() || "Untitled Block";
}

export default function BuildHealthMap({
  cards,
  selectedId,
  onSelect,
}: {
  cards: BuildBlockCard[];
  selectedId: string;
  onSelect: (card: BuildBlockCard) => void;
}) {
  const cardByNumber = new Map(cards.map((card) => [card.number, card]));
  const positions = Array.from({ length: 24 }, (_, index) => {
    const number = index + 1;
    const card = cardByNumber.get(number);
    const status: HealthStatus = card?.status ?? "missing";
    return {
      number,
      act: Math.floor(index / 6) + 1,
      card,
      status,
      ...STATUS_META[status],
    };
  });
  const totals = positions.reduce<Record<HealthTone, number>>(
    (counts, position) => ({ ...counts, [position.tone]: counts[position.tone] + 1 }),
    { green: 0, yellow: 0, red: 0 },
  );
  const supportedRequirements = cards.reduce((total, card) => total + card.evidence.supportedRequirements, 0);
  const expectedRequirements = cards.reduce((total, card) => total + card.evidence.expectedRequirements, 0);
  const coveragePercent = expectedRequirements ? Math.round((supportedRequirements / expectedRequirements) * 100) : 0;
  const selectedCard = cards.find((card) => card.id === selectedId);
  const selectedEvidence = selectedCard ? EVIDENCE_META[selectedCard.evidence.status] : null;

  return (
    <section className={styles.section} aria-labelledby="build-health-map-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>24-Block health map</p>
          <h2 id="build-health-map-title">See the whole film at a glance</h2>
          <span>Readiness colours show production development only. Evidence badges separately show what the PPF defines, what an imported screenplay directly proves, what is still an interpretation, and what remains missing.</span>
        </div>
        <div className={styles.metrics}>
          <div className={styles.coverageMetric} aria-label="Story Coverage">
            <strong>{coveragePercent}%</strong>
            <span>Story Coverage</span>
            <small>{supportedRequirements} of {expectedRequirements} BUILD requirements currently have usable support.</small>
          </div>
          <dl className={styles.summary} aria-label="24-Block readiness totals">
            <div data-tone="green"><dt>Green</dt><dd>{totals.green}</dd></div>
            <div data-tone="yellow"><dt>Yellow</dt><dd>{totals.yellow}</dd></div>
            <div data-tone="red"><dt>Red</dt><dd>{totals.red}</dd></div>
          </dl>
        </div>
      </header>

      <div className={styles.legend} aria-label="Block health meanings">
        <span data-tone="green"><i aria-hidden="true">✓</i>Ready or locked</span>
        <span data-tone="yellow"><i aria-hidden="true">!</i>Developing</span>
        <span data-tone="red"><i aria-hidden="true">×</i>Empty or missing</span>
      </div>

      <div className={styles.evidenceLegend} aria-label="Story evidence meanings">
        {(Object.keys(EVIDENCE_META) as BuildEvidenceStatus[]).map((status) => (
          <span data-evidence={status} key={status}><i aria-hidden="true">{EVIDENCE_META[status].symbol}</i>{EVIDENCE_META[status].label}</span>
        ))}
      </div>

      {selectedCard && selectedEvidence ? (
        <section className={styles.evidencePanel} aria-label={`Why Block ${selectedCard.number} is ${selectedEvidence.label}`}>
          <header>
            <div><p className={styles.eyebrow}>Story evidence</p><strong>Why Block {selectedCard.number} is {selectedEvidence.label}</strong></div>
            <span className={styles.evidenceBadge} data-evidence={selectedCard.evidence.status}><i aria-hidden="true">{selectedEvidence.symbol}</i>{selectedEvidence.label}</span>
          </header>
          <p>{selectedCard.evidence.reason}</p>
          <dl>
            <div><dt>Direct screenplay passages</dt><dd>{selectedCard.evidence.directEvidenceCount}</dd></div>
            <div><dt>Supported requirements</dt><dd>{selectedCard.evidence.supportedRequirements} / {selectedCard.evidence.expectedRequirements}</dd></div>
            <div><dt>Import review</dt><dd>{selectedCard.evidence.reviewStatus}</dd></div>
          </dl>
          {selectedCard.evidence.sources.length ? (
            <details>
              <summary>Show source evidence ({selectedCard.evidence.sources.length}{selectedCard.evidence.directEvidenceCount > selectedCard.evidence.sources.length ? "+" : ""})</summary>
              <ul>{selectedCard.evidence.sources.map((source) => <li key={source.id}><strong>{source.label}</strong><span>{source.excerpt}</span><small>{source.id}</small></li>)}</ul>
            </details>
          ) : null}
          {selectedCard.evidence.missingRequirementLabels.length ? <p className={styles.missingRequirements}><strong>Still underdeveloped:</strong> {selectedCard.evidence.missingRequirementLabels.join(" · ")}</p> : null}
        </section>
      ) : null}

      <div className={styles.acts}>
        {[1, 2, 3, 4].map((actNumber) => {
          const actPositions = positions.filter((position) => position.act === actNumber);
          const actReady = actPositions.filter((position) => position.tone === "green").length;
          return (
            <section className={styles.act} aria-labelledby={`build-health-act-${actNumber}`} key={actNumber}>
              <header>
                <span>Act {actNumber}</span>
                <h3 id={`build-health-act-${actNumber}`}>{ACT_LABELS[actNumber - 1]}</h3>
                <small>{actReady} of 6 ready</small>
              </header>
              <div className={styles.tiles}>
                {actPositions.map((position) => {
                  const selected = Boolean(position.card && position.card.id === selectedId);
                  const title = shortTitle(position.card);
                  const evidence = position.card ? EVIDENCE_META[position.card.evidence.status] : null;
                  return (
                    <button
                      type="button"
                      className={styles.tile}
                      data-tone={position.tone}
                      data-selected={selected ? "true" : "false"}
                      key={position.number}
                      disabled={!position.card}
                      aria-pressed={position.card ? selected : undefined}
                      aria-label={`Block ${position.number}: ${title}. ${position.label}. ${evidence ? `${evidence.label} evidence. ` : ""}Act ${actNumber}, ${ACT_LABELS[actNumber - 1]}.`}
                      onClick={() => position.card && onSelect(position.card)}
                    >
                      <span className={styles.number}>Block {position.number}</span>
                      <strong>{title}</strong>
                      <span className={styles.status}><i aria-hidden="true">{position.symbol}</i>{position.label}</span>
                      {position.card && evidence ? <span className={styles.evidenceBadge} data-evidence={position.card.evidence.status}><i aria-hidden="true">{evidence.symbol}</i>{evidence.label}</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
