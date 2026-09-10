import type { HTMLAttributes, ReactNode } from "react";
import styles from "./ui-work-status.module.css";

export type UiWorkStatusKind =
  | "saving"
  | "saved"
  | "retrying"
  | "offline"
  | "stale"
  | "resumed"
  | "validating"
  | "resolving"
  | "session-accepted"
  | "rejected";

const DEFAULT_LABELS: Record<UiWorkStatusKind, string> = {
  saving: "Saving…",
  saved: "Saved",
  retrying: "Retrying safely…",
  offline: "Offline — your local work is safe",
  stale: "This view may be out of date",
  resumed: "Session restored",
  validating: "Checking what can happen next…",
  resolving: "Resolving consequences…",
  "session-accepted": "Accepted in this STORY session",
  rejected: "That action was not accepted",
};

export type UiWorkStatusProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  status: UiWorkStatusKind;
  label?: ReactNode;
  detail?: ReactNode;
};

export function UiWorkStatus({ status, label, detail, className, ...props }: UiWorkStatusProps) {
  const classes = [styles.status, className].filter(Boolean).join(" ");

  return (
    <div
      {...props}
      className={classes}
      data-pp-work-status={status}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={styles.marker} aria-hidden="true" />
      <span className={styles.copy}>
        <strong>{label ?? DEFAULT_LABELS[status]}</strong>
        {detail ? <span className={styles.detail}>{detail}</span> : null}
      </span>
    </div>
  );
}
