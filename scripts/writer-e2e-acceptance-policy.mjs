export function writerExplorationAcceptance(report, sageAcceptance) {
  const journeyComplete = report?.journeyCoverage?.complete === true;
  const runnerFatal = report?.finishedReason === "runner-error";
  const requested = Number(sageAcceptance?.requested || 0);
  const completed = Number(sageAcceptance?.completed || 0);
  const sageComplete = requested > 0 && completed === requested && sageAcceptance?.passed !== false;
  return {
    passed: !runnerFatal && journeyComplete && sageComplete,
    journeyComplete,
    runnerFatal,
    sageComplete,
    sageRequested: requested,
    sageCompleted: completed,
    exploratoryExitCode: Number(report?.exploratoryExitCode ?? 0),
    settingsDepthComplete: Boolean(
      report?.settingsDepth?.advancedSetup
      && report?.settingsDepth?.advancedRuntime
      && report?.settingsDepth?.advancedRouting
      && report?.settingsDepth?.returnedToSettings
    ),
  };
}
