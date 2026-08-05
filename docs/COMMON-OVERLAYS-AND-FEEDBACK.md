# Common overlays and feedback contract

Issue: #349  
Parent programme: #336

PlotPickle mounts one `CommonOverlayLayer` from the root layout. New screen work uses this layer instead of inventing another confirmation, toast or modal-focus implementation.

## Confirmation requests

Use `requestPlotPickleConfirmation(options)` from `app/common-overlay-layer.tsx`.

The request is asynchronous and resolves to `true` only after the user chooses the explicit confirm action. Every request supplies:

- a short action-specific title;
- a plain-language consequence or recovery description;
- explicit confirm and cancel labels when the defaults are not sufficient;
- `tone: "danger"` for destructive or irreversible actions.

Cancelling with Escape, the backdrop or the cancel button resolves to `false`. The dialog returns focus to the control that opened it. Confirmation must occur before state mutation, file deletion, replacement, paid-provider requests or GitHub writes.

## Notifications

Use `notifyPlotPickle(options)` for transient feedback that does not require a decision.

- `info` and `success` use polite status announcements.
- `warning` and `error` use assertive alerts.
- Messages are dismissible.
- Timers pause while the notification is hovered or focused.
- Default timeouts are bounded; callers may request a longer or persistent notice with `timeoutMs`.
- A notification never replaces inline error recovery beside the control that needs attention.

The layer also enriches existing `.toast` status nodes with `aria-live`, `aria-atomic` and a legacy-feedback marker until their owning screen audit migrates them.

## Modal surfaces

The shared controller watches native `dialog[open]` elements and custom `[role="dialog"][aria-modal="true"]` surfaces.

It:

- moves focus into the topmost modal;
- contains Tab and Shift+Tab within that modal;
- prevents background page scrolling;
- restores focus to the opener when the modal closes;
- invokes a `[data-overlay-close]` control on Escape when one is supplied;
- otherwise dispatches `plotpickle:overlay-dismiss` without overriding a screen’s existing Escape handling.

Every modal still owns its visible title, description, close control, state preservation and recovery copy.

## Legacy native confirmations

`config/overlay-confirmation-inventory.json` lists every current app file that still calls `window.confirm`. New raw synchronous confirmations are prohibited. The focused regression scans the application and fails if a new unregistered location appears.

The inventory is not approval to keep native confirmation indefinitely. Each entry belongs to its named screen audit, where it can be migrated without combining unrelated data mutations into this shared-shell PR.

## Visual and responsive rules

- Interactive controls meet the 44px minimum target.
- Dialogs and notifications respect safe-area insets.
- Mobile confirmations stack actions with the safer cancel action last in keyboard order but first visually reachable from the bottom.
- Reduced-motion mode removes notification animation and backdrop blur.
- Forced-colour mode keeps visible borders and status markers.
- Colour is never the only notification-tone indicator; live-region role and message text carry the meaning.
