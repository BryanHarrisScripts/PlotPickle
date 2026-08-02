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

PlotPickle is local-first. Credentials must remain in operating-system-user protected storage and must not be written to PPF projects, exports, logs, diagnostics, browser code or repository files. Story repositories are private by default and require an explicit owner decision before their visibility changes.
