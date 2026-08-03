# PlotPickle credential-boundary audit

Issue: #299  
Release gate: public PlotPickle 1.0 release candidate  
Machine-readable inventory: `config/credential-boundary.registry.json`

## Audit verdict

PlotPickle keeps provider and collaboration credentials in the local server layer, not in the browser application or story files. The credential gateway is fail-closed and requires operating-system-backed protection before saving sensitive connection data.

The automated audit scans current source and each staged Windows, macOS and Linux package. The full-history audit remains a separate mandatory check because a clean current tree does not prove clean reachable Git history.

## Storage and encryption verdict

| Platform | Protection | Location | Plaintext fallback |
|---|---|---|---|
| Windows | Current-user DPAPI | `PLOTPICKLE_HOME/secrets/*.json` | Not allowed |
| macOS | AES-256-GCM with a Keychain-held key | `PLOTPICKLE_HOME/secrets/*.json` | Not allowed |
| Linux | User-scoped systemd credentials, with Secret Service fallback | `PLOTPICKLE_HOME/secrets/*.json` | Not allowed |
| Legacy files | Read once, migrated through the encrypted writer and verified | Same credential filename | Migration fails if encryption fails |

Credential files are written atomically with restrictive permissions where supported. Erasing all credentials removes the local secrets directory and attempts to remove the associated operating-system key.

The managed Buzz runtime may create `buzz/runtime/.env.runtime` only for one Docker Compose operation. It is written with user-only permissions where supported and deleted in a `finally` block. A surviving copy is an audit failure.

## Installed-machine audit

Run this command on the installed computer before public release or before sharing support material:

```text
npm run audit:credentials:local
```

The command inspects the active PlotPickle home (`PLOTPICKLE_HOME`, `%LOCALAPPDATA%\PlotPickle`, or `~/.plotpickle`) without decrypting credentials. It reports credential filenames, envelope protection, byte counts and POSIX permission modes only. It also checks for an abandoned Buzz runtime environment file and scans PPF, JSON, log, text and environment-like files outside the credential vault for recognizable credential formats.

The command never prints ciphertext or discovered credential values. A green CI run cannot prove that a particular Windows installation is clean; the owner must run this command on that machine.

## Credential inventory

The authoritative field-level inventory is `config/credential-boundary.registry.json`. It covers GitHub App and repository authorization, GitHub project synchronization state, Google Desktop OAuth, AI provider connections, Writing Assistant profiles, Media Routing, Buzz identity and managed runtime state, and collaboration invitation state.

Each record names the encrypted file, owning source module, sensitive fields, browser exposure, export boundary, removal or revocation action, and owner-only follow-up.

| System | Sensitive material | Local removal | Remote revocation |
|---|---|---|---|
| GitHub | App access/refresh tokens, device authorization, fine-grained token and private sync metadata | Disconnect GitHub or erase local credentials | Revoke the GitHub App authorization, installation or fine-grained token in GitHub |
| Google | OAuth access/refresh tokens and legacy pending verifier | Use Disconnect and revoke, or erase local credentials | Remove PlotPickle access in the Google Account when confirmation is required |
| AI providers | OpenAI, MiniMax or compatible-provider API keys | Remove the provider profile or erase local credentials | Revoke or regenerate the key at the provider |
| Buzz | Private identity key and managed-runtime secrets | Disconnect Buzz or remove the managed runtime | Rotate external identity/community access when required |
| ComfyUI/local routes | Local endpoint and workflow metadata; normally no cloud secret | Remove the route/profile | Revoke only a separately configured cloud-provider key |

## Public identifiers are not secrets

The official GitHub App client ID, app slug and installation URL are public application identifiers. They may be packaged; client secrets, private keys and user tokens may not.

A Google Desktop OAuth client ID is also public configuration. The packaged configuration must declare `clientSecretPackaged: false`; access tokens, refresh tokens, authorization codes and client secrets are forbidden.

## Exposure boundaries

### Browser state

Public connection payloads may expose identity, provider, model, endpoint, scope, expiry and health information. Sensitive authorization values remain server-side. The browser audit rejects registered sensitive fields stored through browser persistence APIs.

The short-lived GitHub device-flow user code is an intentional exception because the user must see it to complete authorization. The underlying device authorization remains server-side.

### PPF and project exports

PPF and story project schemas may contain story structure, settings and asset references. They must never contain credential fields, authenticated endpoints or collaboration authorization. The audit scans PPF, project exchange and schema surfaces for registered sensitive property names.

### GitHub Suggest / Report

Suggest / Report creates a draft in the user's browser. It redacts recognizable credential material, local paths and private repository paths; collects only safe browser, platform and version context when selected; attaches no active story or project data; and requires privacy confirmation before opening GitHub.

### Logs, diagnostics and crash material

Provider and Buzz errors are normalized and redacted before reaching browser-visible diagnostics. Diagnostic bundles must contain statuses and safe environment metadata only. Audit output never prints discovered values.

### Release archives

Windows, macOS and Linux staging invokes `scripts/credential-boundary-audit.mjs --mode package`. Release archives may include public application configuration, but not local authorization files, a runtime secrets directory, generated Buzz environment state, private keys or provider authorization values.

## Development material requiring owner action

Before public release, the repository owner must:

1. Revoke any development API keys or tokens that are no longer actively required.
2. Confirm the official PlotPickle GitHub App registration, client ID, installation permissions and repository ownership.
3. Confirm the packaged Google Desktop OAuth client is the intended public desktop client and requires no embedded client secret.
4. Treat the historical Buzz invitation as an owner-accepted historical risk. It has not been represented as revoked; rotate it only if the owner decision changes.
5. Delete local screenshots, logs, support bundles and test exports that might predate redaction hardening.
6. Confirm no private story repository, unpublished story content or owner filesystem path appears in release screenshots or documentation.
7. Run the installed-machine audit on the Windows computer and retain only the value-free result.

Do not add real values to this document as proof of completion.

## Owner release checklist

- [ ] Full reachable Git history audit is green with only exact documented exceptions.
- [ ] Current source credential-boundary audit is green.
- [ ] Installed-machine audit is green on the release computer.
- [ ] Windows package audit is green.
- [ ] macOS package audit is green.
- [ ] Linux package audit is green.
- [ ] GitHub App registration and minimum permissions are verified.
- [ ] Development GitHub authorizations are revoked or intentionally retained.
- [ ] Google Desktop OAuth public client configuration is verified.
- [ ] Development OpenAI, MiniMax and compatible-provider credentials are revoked or intentionally retained.
- [ ] Historical Buzz invitation remains recorded as an accepted risk; obsolete identity credentials are rotated where required.
- [ ] ComfyUI and H3 workflows contain no embedded cloud credentials or unverified third-party nodes.
- [ ] A fresh PPF export contains no registered credential field names.
- [ ] Suggest / Report redaction is tested with synthetic examples.
- [ ] Diagnostics and crash evidence contain no credential values, private repository paths or active story content.
- [ ] Final release archives contain no runtime secrets directory or generated environment state.

## CI evidence required for merge

The pull request may merge only after Credential boundary audit, Public readiness, Public security, Public history readiness, PlotPickle Quality, Phase 1 validation, Repomix and the complete Windows, macOS and Linux Release Candidate matrix are green.
