"use client";

import type { BuildBlockCard, BuildBlockStatus } from "@/lib/build-workspace-model";
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

  return (
    <section className={styles.section} aria-labelledby="build-health-map-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>24-Block health map</p>
          <h2 id="build-health-map-title">See the whole film at a glance</h2>
          <span>Green Blocks are ready or locked, yellow Blocks are developing, and red positions are empty or missing. Choose a tile to inspect that Block below.</span>
        </div>
        <dl className={styles.summary} aria-label="24-Block readiness totals">
          <div data-tone="green"><dt>Green</dt><dd>{totals.green}</dd></div>
          <div data-tone="yellow"><dt>Yellow</dt><dd>{totals.yellow}</dd></div>
          <div data-tone="red"><dt>Red</dt><dd>{totals.red}</dd></div>
        </dl>
      </header>

      <div className={styles.legend} aria-label="Block health meanings">
        <span data-tone="green"><i aria-hidden="true">✓</i>Ready or locked</span>
        <span data-tone="yellow"><i aria-hidden="true">!</i>Developing</span>
        <span data-tone="red"><i aria-hidden="true">×</i>Empty or missing</span>
      </div>

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
                  return (
                    <button
                      type="button"
                      className={styles.tile}
                      data-tone={position.tone}
                      data-selected={selected ? "true" : "false"}
                      key={position.number}
                      disabled={!position.card}
                      aria-pressed={position.card ? selected : undefined}
                      aria-label={`Block ${position.number}: ${title}. ${position.label}. Act ${actNumber}, ${ACT_LABELS[actNumber - 1]}.`}
                      onClick={() => position.card && onSelect(position.card)}
                    >
                      <span className={styles.number}>Block {position.number}</span>
                      <strong>{title}</strong>
                      <span className={styles.status}><i aria-hidden="true">{position.symbol}</i>{position.label}</span>
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
