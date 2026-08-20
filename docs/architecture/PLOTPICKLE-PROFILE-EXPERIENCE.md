# PlotPickle profile experience

Issue #1143 connects the existing Auth, session and profile-scoped storage boundaries to the Human-facing application.

The global profile gate owns fresh local setup, recovery acknowledgement, the safe desktop chooser, password unlock, lock, logout, profile switching and isolated Guest notes. A profile is local to the PlotPickle Node; email, cloud, Internet, BUZZ, GitHub and Google are not login requirements. BUZZ remains a separately presented optional identity.

Only a safe display name, optional local avatar and generic locked state appear before desktop authentication. Story titles, progress, recent activity, project counts, agents, provider accounts, paths and Community state remain behind the session. Server-network mode continues to return no unauthenticated profile directory; a Human supplies a profile locator and receives the same generic authentication failure for an unknown locator or incorrect secret.

The browser receives only an HttpOnly session cookie plus a CSRF token. The API resolves the Human from that cookie through the #1142 boundary. Human projects and Wyrmwood state cross an authenticated private API and are stored by #1141 as PMK-encrypted profile objects. Decrypted working state exists only in the current browser tab's `sessionStorage`; `localStorage` is not an authorization or Human-private persistence boundary. Lock, logout and switch flush authorized writes, revoke the current server session, clear session-scoped UI state, replace private history state and remount the application only after another successful server authorization.

LEARN, PLAN, BUILD, Dashboard and Library use a session-only browser working copy backed by the encrypted profile Library. Wyrmwood uses the same authenticated private boundary. Separate server sessions keep independent active-project state, and invalidated sessions cannot read or write either store.

Server-network behavior is selected explicitly with `PLOTPICKLE_ACCESS_MODE=server-network` and consumes the fail-closed exposure controls from #1142. The unauthenticated response never contains profile summaries. HTTPS, bind address, Host/Origin allowlists, bootstrap readiness and trusted-proxy configuration must be ready before login accepts credentials; otherwise the UI shows only the readiness boundary.

Guest renders a separate, ephemeral notes surface without mounting the private application. Exiting deletes it. “Save as new profile” creates a new PMK-backed Human profile and migrates only the Guest notes into that new profile’s fresh project library.

Profiles & Security identifies the current Human separately from the Node, Sage/agents and BUZZ. It provides lock, switch, logout, add-profile, passphrase change, recovery readiness and redacted session controls. Raw recovery material is shown only on the dedicated one-time recovery screen.
