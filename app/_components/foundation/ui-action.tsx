import type { ButtonHTMLAttributes } from "react";
import styles from "./ui-action.module.css";

export type UiActionVariant = "primary" | "secondary" | "tertiary" | "destructive";

export type UiActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiActionVariant;
};

export function UiAction({ variant = "secondary", className, type = "button", ...props }: UiActionProps) {
  const classes = [styles.action, styles[variant], className].filter(Boolean).join(" ");

  return (
    <button
      {...props}
      type={type}
      className={classes}
      data-pp-action={variant}
    />
  );
}
