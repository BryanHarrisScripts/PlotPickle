"use client";

import type { ButtonHTMLAttributes } from "react";
import styles from "./refresh-action.module.css";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  working?: boolean;
  workingLabel?: string;
};

export default function RefreshAction({
  label,
  working = false,
  workingLabel = "Refreshing…",
  className = "",
  disabled,
  ...props
}: Props) {
  const text = working ? workingLabel : label;
  return (
    <button
      {...props}
      type="button"
      className={[styles.button, className].filter(Boolean).join(" ")}
      disabled={disabled || working}
      aria-label={text}
      aria-busy={working || undefined}
    >
      <span className={working ? styles.spinning : ""} aria-hidden="true">↻</span>
      <span>{text}</span>
    </button>
  );
}
