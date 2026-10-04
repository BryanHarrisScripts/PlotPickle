// The native launcher owns its readiness policy. A product fixture must not
// stop it before that existing policy has expired, or silently invent a longer
// policy when the launcher changes.
export function outlineLauncherReadinessTimeout({ cold = false, platform, launcherSource }) {
  if (cold) return 480_000; // Required first-time runtime/model installation.
  if (platform !== "win32") return 180_000;
  const match = launcherSource.match(/^set "READY_TIMEOUT_SECONDS=(\d+)"\s*$/mu);
  const seconds = Number(match?.[1]);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error("Normal Windows launcher readiness contract is missing or invalid.");
  }
  return seconds * 1000;
}
