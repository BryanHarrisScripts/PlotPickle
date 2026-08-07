import React from 'react'
import { CreativeRoute, previewCreativeRoute, providerDisclosure } from '../../lib/creativeRouteReadiness'

type Props = {
  route: CreativeRoute
  confirmed?: boolean
  onConfirmPaid?: () => void
  onRecovery?: () => void
  onOpenSettings?: (target: string) => void
}

export function CreativeRouteReadiness({ route, confirmed = false, onConfirmPaid, onRecovery, onOpenSettings }: Props) {
  const decision = previewCreativeRoute(route, confirmed)
  const routeLabel = route.kind === 'local' ? 'Local' : route.kind === 'paid-cloud' ? 'Paid cloud' : 'Manual export'

  return (
    <section aria-label="Creative route readiness" className="creative-route-readiness">
      <header>
        <div>
          <p className="eyebrow">How this action will run</p>
          <h3>{routeLabel}</h3>
        </div>
        <span title={providerDisclosure(route)}>{route.ready ? 'Ready' : 'Needs attention'}</span>
      </header>

      <p>{decision.costLabel}</p>

      {!route.ready && (
        <div className="creative-route-recovery">
          <button type="button" onClick={onRecovery}>{route.recoveryAction}</button>
          <button type="button" onClick={() => onOpenSettings?.(route.settingsTarget)}>Open Settings</button>
        </div>
      )}

      {decision.requiresConfirmation && !confirmed && (
        <div role="note" className="creative-route-consent">
          <p>This action can create a provider charge. PlotPickle will not submit it until you confirm this action.</p>
          <button type="button" disabled={!route.ready} onClick={onConfirmPaid}>Confirm paid submission</button>
        </div>
      )}

      <details>
        <summary>Route details</summary>
        <p>{providerDisclosure(route)}</p>
      </details>
    </section>
  )
}
