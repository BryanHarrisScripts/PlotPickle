export function classifyPhase3(score) {
  const value = Number(score || 0);
  if (value >= 78) return 4;
  if (value >= 70) return 3;
  if (value >= 65) return 2;
  return 1;
}
