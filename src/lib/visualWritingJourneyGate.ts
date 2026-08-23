export type JourneyStep =
  | 'concept'
  | 'reference'
  | 'exploration'
  | 'direction'
  | 'comparison'
  | 'approval'
  | 'continuity'
  | 'image-to-story'

export type JourneyRouteState = 'local' | 'manual' | 'provider-unavailable' | 'paid-unconfirmed' | 'paid-confirmed'

export type JourneySnapshot = {
  completedSteps: JourneyStep[]
  routeState: JourneyRouteState
  persisted: boolean
  exportImportRoundTrip: boolean
  mobilePrimaryActionsReachable: boolean
  accessibilityPassed: boolean
  visualEvidenceIds: string[]
}

const REQUIRED_STEPS: JourneyStep[] = [
  'concept', 'reference', 'exploration', 'direction', 'comparison', 'approval', 'continuity', 'image-to-story',
]

export function evaluateVisualWritingJourney(snapshot: JourneySnapshot) {
  const missingSteps = REQUIRED_STEPS.filter((step) => !snapshot.completedSteps.includes(step))
  const paidSafe = snapshot.routeState !== 'paid-unconfirmed'
  const visualEvidenceComplete = snapshot.visualEvidenceIds.length >= 4

  return {
    pass: missingSteps.length === 0
      && snapshot.persisted
      && snapshot.exportImportRoundTrip
      && snapshot.mobilePrimaryActionsReachable
      && snapshot.accessibilityPassed
      && paidSafe
      && visualEvidenceComplete,
    missingSteps,
    paidSafe,
    visualEvidenceComplete,
  }
}

export function requiredJourneyRoutes(): JourneyRouteState[] {
  return ['local', 'manual', 'provider-unavailable', 'paid-unconfirmed', 'paid-confirmed']
}
