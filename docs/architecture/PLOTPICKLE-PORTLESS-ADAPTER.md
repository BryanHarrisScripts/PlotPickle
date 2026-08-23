# PlotPickle optional Portless adapter

Status: #1155 and #1156 implementation complete; Windows acceptance passed. Parent #1154 closeout decision: **ADOPT WITH LIMITS**.

## Authority boundary

The PlotPickle Local Endpoint Registry remains the authority for endpoint identity, job/worktree authorization, lifecycle, exact commit provenance, application readiness, generation and direct fallback.

Portless is only a replaceable local transport adapter:

```text
PlotPickle Runtime Supervisor
  -> exact app/worktree child on an allocated loopback port
  -> Local Endpoint Registry endpoint ID/generation
  -> optional Portless static alias
  -> authorized developer/UAT browser gets an opaque .localhost URL
```

PlotPickle does not use `portless run` for managed app launch. Portless never becomes authentication authority, Human profile authority, Node identity, server ingress, BUZZ relay, public reverse proxy, application readiness authority or remote compute.

## Reviewed upstream pin

- Package: `portless`
- Version: `0.15.5`
- npm spec: `portless@0.15.5`
- Source: `https://github.com/vercel-labs/portless`
- Source tag: `v0.15.5`
- Release commit shown by upstream release: `d42c741`
- License: Apache-2.0
- Published Node engine: Node 24+
- Measured npm integrity: `sha512-zmJu4Q8/fY54oVUT/5NnmF4Ih8wTdCvCf6JCN783dRYl9mXkJBzXSckX2lztGCLIbM70varDjCudAbGKT73XPg==`

The package metadata was captured by the successful Windows acceptance workflow from the exact published `portless@0.15.5` package. Portless is pre-1.0. A version change requires a deliberate compatibility/security review and a repeat of the #1156 Windows acceptance gate. No `latest` dependency is permitted.

## Node runtime decision

PlotPickle remains Node `>=22.13.0`.

Portless is not added to PlotPickle dependencies or devDependencies. The supported managed proof provisions the exact Portless package into a separate developer-tool directory and invokes it with an explicit absolute Node 24 executable and absolute Portless CLI entrypoint.

Normalized source states are:

- `managed-pinned`
- `installed-compatible`
- `explicit-developer-override`
- `unavailable`
- `incompatible`

Normal writer/product operation never gains a Node 24 requirement because of this adapter.

## Supported transport profiles

### `direct/http`

The #1155 baseline. No Portless dependency or proxy.

### `portless/http`

The supported optional developer/UAT profile. PlotPickle owns the app child process. A foreground Portless proxy is started on an unprivileged dynamically allocated port with a dedicated Node-scoped state directory. PlotPickle registers an opaque static alias to the already-running app port.

The managed environment forces:

- `.localhost` only;
- `PORTLESS_SYNC_HOSTS=0`;
- `PORTLESS_LAN=0`;
- `PORTLESS_TAILSCALE=0`;
- `PORTLESS_FUNNEL=0`;
- `PORTLESS_NGROK=0`;
- `PORTLESS_WILDCARD=0`;
- TLS disabled for routine routing.

The adapter rejects attempted LAN/tunnel/wildcard/custom-TLD configuration rather than silently overriding an explicit unsafe request.

### `portless/https`

Explicit developer security-testing profile only. It is not enabled by ordinary PlotPickle startup and is not part of routine adoption. CA trust must be an explicit operator action. Missing OpenSSL is diagnostic, not a reason to install unrelated software or break direct routing.

No #1156 code calls `portless trust`, `portless service install`, Tailscale, Funnel, ngrok, mDNS/LAN mode or a public/custom domain.

## Route identity and privacy

The registry derives the static route only from the opaque endpoint ID:

```text
pp-<24 hex chars>.localhost
```

It never derives routes from Human display names, story/project titles, provider/account identifiers, branch text or secrets. Route names are one DNS-safe label and collision handling remains explicit.

Portless state is Node developer infrastructure, not a Human profile vault. The default state location is below the PlotPickle Node runtime area and the adapter rejects a state directory inside `profiles/`.

No PMK, BUZZ signer, provider token, Human credential or story content is intentionally written to Portless state.

## Lifecycle and fallback

The app process starts first under PlotPickle authority. Only after the direct endpoint has exact-instance/commit proof may the adapter add a static alias.

A Portless route is not application readiness. The named route must independently return the expected endpoint ID, endpoint generation, instance ID and exact Git commit before the registry exposes the named URL as ready.

On app restart/remap:

- endpoint ID remains stable;
- endpoint generation increments;
- the app may move to a new actual loopback port;
- only that alias is updated with `alias --force`;
- exact-instance proof must pass again.

On cancellation the endpoint alias is removed before its route authority is considered gone. Removing one route must not change other endpoints.

If Portless is missing, incompatible or route registration fails, the healthy app process is not killed. When job policy permits, the registry explicitly records and returns the #1155 direct loopback fallback.

## Measured Windows acceptance

Workflow run `32437045317`, real Windows Node 24 job, passed against #1156 head `8cc93adb18240596023fee7e601af2e9e42dd24f`. Sanitized artifact ID: `9431151950`.

Measured evidence:

1. pinned Portless `0.15.5` ran under isolated Node `24.19.0`;
2. exact npm metadata/integrity was captured from the published package;
3. a foreground HTTP proxy started without service installation;
4. effective Windows listener evidence was loopback-only;
5. three concurrent synthetic main/repair-worktree endpoints remained alive;
6. three distinct opaque static aliases were created;
7. each route resolved to its intended endpoint/worktree/commit;
8. endpoint B remapped to a new actual app port without changing A;
9. endpoint C cancellation removed only C;
10. alias operations passed with a synthetic PATH beyond the Windows `cmd.exe` 8191-character risk boundary because PlotPickle used absolute Node/CLI invocation and did not ask Portless to spawn the app;
11. missing Portless preserved a healthy direct endpoint;
12. isolated Portless state contained no configured Human/project/provider secret canaries;
13. cleanup left no stale route authority.

The same Portless proof run also passed Windows and Linux Node 22 direct-fallback production builds. The Windows Node 22 job staged and audited the PlotPickle Windows package with Portless absent, proving the optional adapter did not alter the product Node baseline or package requirement.

## Packaging and licensing

Portless is Apache-2.0 and is external/isolated developer tooling rather than a bundled PlotPickle product dependency. No Portless runtime state, CA key, route file or machine log belongs in PlotPickle release archives or support bundles.

If PlotPickle later bundles Portless, the release process must add the required Apache license/NOTICE material and re-run the package audit. PlotPickle does not use Vercel Labs branding as product branding.

## Rollout decision

Final decision: **ADOPT WITH LIMITS**.

Limits:

- optional developer/UAT adapter only;
- static aliases only; PlotPickle owns app processes;
- routine supported mode is `portless/http`;
- isolated explicit Node 24 tool runtime;
- normal PlotPickle stays Node 22.13+ and direct mode remains fully supported;
- HTTPS/CA trust remains explicit developer security-test setup, not ordinary startup;
- no LAN, tunnel, public-domain, service-at-boot or automatic CA-trust behavior;
- Portless remains replaceable beneath the PlotPickle Local Endpoint Registry and never gains runtime, readiness, authentication or security authority.

A future Portless version change, product Node-baseline change, HTTPS-default proposal or remote-exposure proposal requires a new compatibility/security review rather than silently expanding this decision.
