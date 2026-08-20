# Security policy

## Supported versions

Security fixes are applied to the current main branch and the latest published PlotPickle release. Older release candidates may no longer receive fixes.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability, exposed credential, privacy problem or unsafe update path.

Use the repository's Security tab and choose "Report a vulnerability" to open a private security advisory. Include:

- the affected version, operating system and component;
- clear reproduction steps;
- the impact you observed or believe is possible;
- logs or screenshots with credentials and personal story material removed; and
- a safe way to confirm the fix, when known.

If private vulnerability reporting is unavailable, contact the repository owner privately and disclose only enough information to establish a secure reporting channel.

## Secrets and personal story material

Never submit API keys, OAuth secrets, access tokens, signing certificates, private keys, local credential stores, user projects, backups or unpublished story material.

If a credential may have been committed, revoke and replace it immediately. Removing it from the latest file is not enough; the repository history and pull-request references must also be reviewed before publication.

## Security boundaries

PlotPickle is local-first. PlotPickle owns Human-profile authentication; an operating-system account and BUZZ identity are not profile-unlock authorities. Profile credentials and private keys must remain inside the versioned encrypted profile boundary and must not be written to PPF projects, ordinary exports, logs, diagnostics, browser persistence or repository files. Story repositories are private by default and require an explicit owner decision before their visibility changes.

The canonical boundaries are the [PlotPickle Auth threat model](docs/architecture/PLOTPICKLE-AUTH-THREAT-MODEL.md) and [PlotPickle Auth cryptographic dependency selection](docs/architecture/PLOTPICKLE-AUTH-CRYPTO-SELECTION.md). They state both the protections PlotPickle implements and the privileged-host/process-memory attacks it does not claim to prevent.
