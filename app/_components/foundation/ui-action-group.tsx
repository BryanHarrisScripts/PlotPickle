import type { HTMLAttributes } from "react";
import styles from "./ui-action-group.module.css";

export type UiActionGroupProps = HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end";
};

export function UiActionGroup({ align = "start", className, ...props }: UiActionGroupProps) {
  const classes = [styles.group, styles[align], className].filter(Boolean).join(" ");

  return (
    <div
      {...props}
      className={classes}
      data-pp-action-group="true"
    />
  );
}
