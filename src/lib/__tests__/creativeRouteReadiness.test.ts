import { describe, expect, it } from 'vitest'
import { previewCreativeRoute, resolveCreativeRouteFailure } from '../creativeRouteReadiness'

describe('creative route readiness', () => {
  it('allows a ready local route without cloud consent', () => {
    const result = previewCreativeRoute({
      kind: 'local', ready: true, providerLabel: 'ComfyUI', recoveryAction: 'Retry locally', settingsTarget: 'comfyui',
    })
    expect(result.canSubmit).toBe(true)
    expect(result.requiresConfirmation).toBe(false)
    expect(result.costLabel).toContain('locally')
  })

  it('blocks paid submission until action-specific confirmation', () => {
    const route = {
      kind: 'paid-cloud' as const, ready: true, providerLabel: 'Cloud image provider',
      cost: { currency: 'USD', amount: 0.12 }, recoveryAction: 'Use manual export', settingsTarget: 'ai-providers',
    }
    expect(previewCreativeRoute(route).canSubmit).toBe(false)
    expect(previewCreativeRoute(route, true).canSubmit).toBe(true)
    expect(previewCreativeRoute(route).costLabel).toBe('Estimated cost: USD 0.12')
  })

  it('states unknown paid cost honestly', () => {
    const result = previewCreativeRoute({
      kind: 'paid-cloud', ready: true, cost: { currency: 'USD', unknown: true }, recoveryAction: 'Export prompt', settingsTarget: 'ai-providers',
    })
    expect(result.costLabel).toContain('Cost unknown')
    expect(result.canSubmit).toBe(false)
  })

  it('never converts local failure into cloud fallback', () => {
    const failed = resolveCreativeRouteFailure({
      kind: 'local', ready: true, providerLabel: 'ComfyUI', recoveryAction: 'Retry locally', settingsTarget: 'comfyui',
    })
    expect(failed.route.kind).toBe('local')
    expect(failed.canSubmit).toBe(false)
  })

  it('keeps manual export usable without provider consent', () => {
    const result = previewCreativeRoute({
      kind: 'manual-export', ready: true, recoveryAction: 'Copy package', settingsTarget: 'storage',
    })
    expect(result.canSubmit).toBe(true)
    expect(result.requiresConfirmation).toBe(false)
  })
})
