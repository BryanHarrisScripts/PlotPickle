import type { HTMLAttributes, ReactNode } from "react";
import styles from "./story-validator-finding.module.css";

export type StoryValidatorSeverity = "error" | "warning" | "note" | "pass";

const SEVERITY_LABELS: Record<StoryValidatorSeverity, string> = {
  error: "ERROR",
  warning: "WARNING",
  note: "NOTE",
  pass: "PASS",
};

export type StoryValidatorFindingProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  severity: StoryValidatorSeverity;
  title: ReactNode;
  message: ReactNode;
  repair?: ReactNode;
};

export function StoryValidatorFinding({
  severity,
  title,
  message,
  repair,
  className,
  ...props
}: StoryValidatorFindingProps) {
  const classes = [styles.finding, className].filter(Boolean).join(" ");

  return (
    <article
      {...props}
      className={classes}
      data-story-validator-severity={severity}
    >
      <span className={styles.severity}>{SEVERITY_LABELS[severity]}</span>
      <div className={styles.copy}>
        <h3>{title}</h3>
        <p>{message}</p>
        {repair ? <p className={styles.repair}><strong>Next:</strong> {repair}</p> : null}
      </div>
    </article>
  );
}
