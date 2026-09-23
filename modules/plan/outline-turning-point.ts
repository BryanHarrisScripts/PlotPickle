/** The turning point follows the sixth Block of each Act; it has no separate script address. */
export function outlineTurningPoint(act: number) {
  const labels = ["Act 1 turning point", "Act 2 turning point", "Act 3 turning point", "Act 4 turning point · Finale and resolution"] as const;
  return {
    act,
    blockNumber: act * 6,
    label: labels[act - 1] ?? `Act ${act} turning point`,
  };
}
