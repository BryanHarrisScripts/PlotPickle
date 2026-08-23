import { describe, expect, it } from 'vitest'
import { evaluateVisualWritingJourney, requiredJourneyRoutes } from '../visualWritingJourneyGate'

const complete = {
  completedSteps: ['concept','reference','exploration','direction','comparison','approval','continuity','image-to-story'] as const,
  persisted: true,
  exportImportRoundTrip: true,
  mobilePrimaryActionsReachable: true,
  accessibilityPassed: true,
  visualEvidenceIds: ['concept-desktop','compare-desktop','approval-mobile','proposal-mobile'],
}

describe('visual writing human journey gate', () => {
  it('passes a complete local journey after reload and export/import', () => {
    const result = evaluateVisualWritingJourney({ ...complete, completedSteps: [...complete.completedSteps], routeState: 'local' })
    expect(result.pass).toBe(true)
  })

  it('covers every required route safety state', () => {
    expect(requiredJourneyRoutes()).toEqual(['local','manual','provider-unavailable','paid-unconfirmed','paid-confirmed'])
  })

  it('blocks an unconfirmed paid journey', () => {
    const result = evaluateVisualWritingJourney({ ...complete, completedSteps: [...complete.completedSteps], routeState: 'paid-unconfirmed' })
    expect(result.pass).toBe(false)
    expect(result.paidSafe).toBe(false)
  })

  it('fails when mobile primary actions are unreachable', () => {
    const result = evaluateVisualWritingJourney({ ...complete, completedSteps: [...complete.completedSteps], routeState: 'manual', mobilePrimaryActionsReachable: false })
    expect(result.pass).toBe(false)
  })

  it('fails when persistence or export/import continuity breaks', () => {
    expect(evaluateVisualWritingJourney({ ...complete, completedSteps: [...complete.completedSteps], routeState: 'local', persisted: false }).pass).toBe(false)
    expect(evaluateVisualWritingJourney({ ...complete, completedSteps: [...complete.completedSteps], routeState: 'local', exportImportRoundTrip: false }).pass).toBe(false)
  })

  it('requires deterministic visual evidence for key steps', () => {
    const result = evaluateVisualWritingJourney({ ...complete, completedSteps: [...complete.completedSteps], routeState: 'local', visualEvidenceIds: ['one'] })
    expect(result.pass).toBe(false)
    expect(result.visualEvidenceComplete).toBe(false)
  })
})
