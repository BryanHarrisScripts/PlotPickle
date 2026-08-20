# PlotPickle profile experience

Issue #1143 connects the existing Auth, session and profile-scoped storage boundaries to the Human-facing application.

The global profile gate owns fresh local setup, recovery acknowledgement, the safe desktop chooser, password unlock, lock, logout, profile switching and isolated Guest notes. A profile is local to the PlotPickle Node; email, cloud, Internet, BUZZ, GitHub and Google are not login requirements. BUZZ remains a separately presented optional identity.

Only a safe display name, optional local avatar and generic locked state appear before desktop authentication. Story titles, progress, recent activity, project counts, agents, provider accounts, paths and Community state remain behind the session. Server-network mode continues to return no unauthenticated profile directory; a Human supplies a profile locator and receives the same generic authentication failure for an unknown locator or incorrect secret.

The browser receives only an HttpOnly session cookie plus a CSRF token. The API resolves the Human from that cookie through the #1142 boundary. Lock, logout and switch revoke the current server session, clear session-scoped UI state, remove the active browser profile selector, replace private history state and remount the application only after another successful server authorization.

LEARN, PLAN, BUILD, Dashboard and Library use the existing profile-scoped project library. This change moves LEARN off its legacy global project key and scopes Wyrmwood state to the active opaque profile identifier so Bryan and Jane do not share those browser records.

Guest renders a separate, ephemeral notes surface without mounting the private application. Exiting deletes it. “Save as new profile” creates a new PMK-backed Human profile and migrates only the Guest notes into that new profile’s fresh project library.

Profiles & Security identifies the current Human separately from the Node, Sage/agents and BUZZ. It provides lock, switch, logout, add-profile, passphrase change, recovery readiness and redacted session controls. Raw recovery material is shown only on the dedicated one-time recovery screen.
