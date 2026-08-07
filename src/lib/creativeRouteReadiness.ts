export type CreativeRouteKind = 'local' | 'paid-cloud' | 'manual-export'

export type CreativeRoute = {
  kind: CreativeRouteKind
  providerLabel?: string
  ready: boolean
  cost?: { currency: string; amount?: number; unknown?: boolean }
  recoveryAction: string
  settingsTarget: string
}

export type CreativeRouteDecision = {
  route: CreativeRoute
  requiresConfirmation: boolean
  canSubmit: boolean
  costLabel: string
}

export function previewCreativeRoute(route: CreativeRoute, confirmed = false): CreativeRouteDecision {
  const paid = route.kind === 'paid-cloud'
  const costLabel = paid
    ? route.cost?.unknown || route.cost?.amount == null
      ? 'Cost unknown — confirm before submitting.'
      : `Estimated cost: ${route.cost.currency} ${route.cost.amount.toFixed(2)}`
    : route.kind === 'local'
      ? 'Runs locally. No cloud charge.'
      : 'Manual export. No provider submission.'

  return {
    route,
    requiresConfirmation: paid,
    canSubmit: route.ready && (!paid || confirmed),
    costLabel,
  }
}

export function resolveCreativeRouteFailure(route: CreativeRoute): CreativeRouteDecision {
  // A local failure must never become implicit permission to spend money in cloud.
  return previewCreativeRoute({ ...route, ready: false }, false)
}

export function providerDisclosure(route: CreativeRoute): string {
  if (route.kind === 'local') return route.providerLabel ? `Local · ${route.providerLabel}` : 'Local'
  if (route.kind === 'paid-cloud') return route.providerLabel ? `Paid cloud · ${route.providerLabel}` : 'Paid cloud'
  return 'Manual export'
}
