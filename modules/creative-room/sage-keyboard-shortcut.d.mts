/** The subset of KeyboardEvent needed to check the Sage shortcut safely. */
export type SageShortcutEvent = {
  readonly key?: unknown;
  readonly defaultPrevented?: boolean;
  readonly repeat?: boolean;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
};
export function isSageOpenShortcut(event: SageShortcutEvent | null | undefined): boolean;
