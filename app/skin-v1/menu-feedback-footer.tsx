import styles from "./menu-feedback-footer.module.css";

type MenuFeedbackFooterProps = Readonly<{
  id: string;
  label: string;
  available: boolean;
  unavailableReason?: string;
}>;

export default function MenuFeedbackFooter({ id, label, available, unavailableReason }: MenuFeedbackFooterProps) {
  const action = available
    ? `ENTER → OPEN ${label.toUpperCase()}`
    : `ENTER → ${label.toUpperCase()} UNAVAILABLE${unavailableReason ? ` — ${unavailableReason.toUpperCase()}` : ""}`;

  return (
    <div className={`pp-skin-v1-bbs-help ${styles.footer}`} data-menu-feedback="contextual">
      <span>UP/DOWN OR SHORTCUT KEY: SELECT</span>
      <span id={id} role="status" aria-live="polite" aria-atomic="true">{action}</span>
      <span className={styles.legend} aria-label="Menu status legend">
        <span className={styles.legendKey}>
          <span className={`${styles.legendSquare} ${styles.legendSquareAvailable}`} aria-hidden="true" />
          GREEN = AVAILABLE
        </span>
        <span className={styles.legendKey}>
          <span className={styles.legendSquare} aria-hidden="true" />
          GRAY = UNAVAILABLE
        </span>
      </span>
    </div>
  );
}
