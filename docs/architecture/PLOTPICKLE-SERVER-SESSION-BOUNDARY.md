# PlotPickle server-session boundary

Issue: #1142

## Authority

The browser receives one opaque session cookie. The cookie contains 256 random bits and no profile, Node, role, identity or timestamp data. PlotPickle hashes the cookie value before using it as the key for its in-memory server-session record. Browser storage, URL parameters, bearer headers, display names, OS accounts and BUZZ identities are never session authority.

Every private request enters through `createServerSessionBoundary`. It validates the deployment boundary, reads only the expected cookie, resolves the canonical server-side `AuthContext`, applies CSRF protection to mutations, and then runs explicit ownership or role guards. A `profileId` supplied in a URL or body is a resource locator only; it cannot replace the authenticated profile in `AuthContext`.

The reusable guards are:

- `requireSession`;
- `requireProfileOwner`;
- `requireProjectAccess`;
- `requireProfileSecretAccess`;
- `requireNodeAdministrator`;
- `requireRecentReauthentication`.

Project access fails closed unless a server-owned access resolver is supplied. A normal Human session has only the `human` role. Node administration does not grant a PMK or a universal Human-vault decryptor.

## Session lifecycle

Defaults are a 30-minute idle timeout, a 12-hour absolute lifetime and a 10-minute recent-reauthentication window. Deployments may configure shorter values within the absolute lifetime. Activity advances only idle expiry; it cannot extend the absolute lifetime.

Successful login, recovery reset and password change create a fresh random session. Password change and recovery reset revoke older sessions for that profile. Lock/logout revokes the current session, disable revokes every session for that profile, and service shutdown zeroes held PMK and CSRF bytes. Session summaries expose a separate management reference plus times and coarse browser/origin labels, never the cookie or raw session ID.

Sensitive routes use recent password or stronger authentication. Recovery-authenticated sessions must complete password authentication before destructive profile/server actions.

## Cookie and CSRF contract

`server-network` uses `__Host-ppsid` with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain`, and a bounded `Max-Age`. `desktop-loopback` uses `ppsid` with the same controls except `Secure`, because its supported HTTP origin is restricted to loopback. That exception cannot be selected in network mode.

Every state-changing request requires both an allowlisted exact `Origin` and the random CSRF token bound to its server session. SameSite is defense in depth, not the sole CSRF defense. Private stream setup requires an authenticated cookie and allowed Origin before a WebSocket, SSE or other private stream is established. Safe methods cannot be declared mutating.

Session IDs in query parameters, authorization headers or alternate session headers are rejected. Application code must not copy the cookie value into `localStorage` or `sessionStorage`.

## Concurrent Humans

Session state is not stored in a Node-global active-user variable. Each request resolves its own profile and each profile-storage active project remains keyed by server session. Revoking Bryan Session A removes only state tied to that invalid session; Bryan Session B and Jane's sessions retain their separate active projects and vault authority. Background work must carry its originating session/profile/project identifiers and re-authorize before reading private state.

## Login throttling

Password, recovery and bootstrap attempts have separate buckets. Keys are hashes of the source address and normalized locator plus a Node-wide burst bucket; attempted passwords are never stored or logged. Repeated failures create bounded exponential delay, capped at 30 seconds. Success removes the locator bucket and decays broader buckets. There is no permanent account lockout, and public failures remain generic.

## Exposure modes

`desktop-loopback` is the default and accepts only loopback bind, Host, Origin and remote addresses.

`server-network` reports not ready and refuses Human authentication until all of these are explicit:

- network mode enabled by the operator;
- concrete bind address;
- HTTPS external origin;
- exact HTTPS Origin and Host allowlists;
- direct TLS or a trusted terminating-proxy mode;
- explicit trusted proxy IPs when forwarded headers are used;
- protected first-run bootstrap completed.

Forwarded protocol and client-address headers are ignored unless the immediate peer is an allowlisted proxy. Plain remote HTTP, wildcard Host/Origin policy and incomplete bootstrap fail closed. HSTS is emitted only when the operator enables it for an HTTPS deployment.

The browser header baseline uses `nosniff`, `no-referrer`, `frame-ancestors 'none'`, a self-first CSP and `no-store`. Loopback `connect-src` exceptions remain narrow for existing local runtime/media flows; they do not change server authorization.

## API integration

Authentication handlers return safe profile metadata, CSRF proof, expiry metadata and `Set-Cookie`; they do not return `AuthContext` or a session ID field. Private route handlers call `authorizeRequest` before resolving profile storage, Library, assets, memory, agent, BUZZ, integration, settings, collaboration, report or backup data. Private stream handlers call `authorizePrivateStream` before upgrading or streaming.

The current bundled Afterglow reference endpoint is static product content and does not expose a Human project. New Human-private APIs are deny-by-default and must use this boundary rather than client-side hiding.

## Verification references

The design follows the OWASP Session Management, Authentication and CSRF Prevention cheat sheets: CSPRNG identifiers, server-side meaning, cookie-only exchange, rotation after authentication changes, idle plus absolute expiry, TLS-bound Secure cookies, explicit CSRF tokens and generic throttled authentication failures.
