import type { HTMLAttributes, ReactNode } from "react";
import styles from "./ui-state-surface.module.css";

export type UiSurfaceState = "ideal" | "empty" | "loading" | "partial" | "error";

export type UiStateSurfaceProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  state: UiSurfaceState;
  title: ReactNode;
  message: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  detail?: ReactNode;
};

export function UiStateSurface({
  state,
  title,
  message,
  eyebrow,
  action,
  detail,
  className,
  ...props
}: UiStateSurfaceProps) {
  const classes = [styles.surface, className].filter(Boolean).join(" ");

  return (
    <section
      {...props}
      className={classes}
      data-pp-state={state}
      aria-busy={state === "loading" ? "true" : undefined}
    >
      <span className={styles.stateMark} aria-hidden="true" />
      <div className={styles.copy}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {detail ? <div className={styles.detail}>{detail}</div> : null}
      </div>
      {state === "loading" ? (
        <div className={styles.loadingTrack} aria-hidden="true">
          <span />
        </div>
      ) : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </section>
  );
}
