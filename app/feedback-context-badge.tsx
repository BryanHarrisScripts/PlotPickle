"use client";

import styles from "./feedback-context-badge.module.css";

export default function FeedbackContextBadge({
  count,
  label,
  onOpen,
}: {
  count: number;
  label: string;
  onOpen: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button type="button" className={styles.badge} onClick={onOpen} aria-label={`Open ${count} feedback records for ${label}`}>
      <span>{count}</span>
      <strong>Feedback</strong>
      <small>{label}</small>
    </button>
  );
}
