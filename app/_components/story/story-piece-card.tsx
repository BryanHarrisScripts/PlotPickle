import type { HTMLAttributes, ReactNode } from "react";
import styles from "./story-piece-card.module.css";

export type StoryPieceCardState = "available" | "selected" | "illegal" | "loading" | "partial" | "error";

export type StoryPieceCardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  type: string;
  title: ReactNode;
  description: ReactNode;
  state?: StoryPieceCardState;
  meta?: ReactNode;
  action?: ReactNode;
};

const STATE_LABELS: Record<StoryPieceCardState, string> = {
  available: "Available",
  selected: "Selected",
  illegal: "Unavailable here",
  loading: "Loading details",
  partial: "Some details unavailable",
  error: "Could not load",
};

export function StoryPieceCard({
  type,
  title,
  description,
  state = "available",
  meta,
  action,
  className,
  ...props
}: StoryPieceCardProps) {
  const classes = [styles.card, className].filter(Boolean).join(" ");
  const unavailable = state === "illegal" || state === "loading" || state === "error";

  return (
    <article
      {...props}
      className={classes}
      data-story-piece-state={state}
      data-story-piece-unavailable={unavailable ? "true" : undefined}
    >
      <header className={styles.header}>
        <p className={styles.type}>{type}</p>
        <p className={styles.state}>{STATE_LABELS[state]}</p>
      </header>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {meta ? <div className={styles.meta}>{meta}</div> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </article>
  );
}
