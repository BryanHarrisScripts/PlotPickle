# Issue #144 — Connection readiness and credential controls

## Goal

Make first-time GitHub setup understandable, show a trustworthy green Ready state only after the complete collaboration path is verified, and give the user one dependable way to locate or erase every locally stored credential.

## GitHub readiness

The GitHub setup card uses four visible states:

- Not connected: no saved GitHub credential.
- Checking: PlotPickle is validating the saved configuration.
- Ready: every required check passed.
- Needs attention: at least one check failed.

Ready requires all five non-mutating checks:

1. The repository exists and the token can access it.
2. The configured canonical branch exists.
3. The canonical `.ppf` path is valid and its existing project, when present, passes integrity validation.
4. The token has Contents read/write permission.
5. The token has Pull requests read/write permission.

Permission checks deliberately send invalid empty requests and accept GitHub’s validation response as proof that authorization was reached. They do not create or change a repository file and do not create a pull request.

## Credential boundary

Every provider keeps a separate credential file inside one exact private folder:

`<PlotPickle persistent home>/secrets/`

On Windows, new or updated credential files are protected with Windows DPAPI using the current-user scope. Existing plaintext JSON is upgraded automatically the first time PlotPickle reads it after this release. On other supported platforms, files are stored with owner-only permissions.

The centralized credential module is the only place that reads, writes or removes provider credential files. It writes atomically, never logs secrets and exposes only sanitized filenames, sizes and protection states to the interface.

## User controls

Settings → Privacy and permissions provides:

- Open credentials folder.
- Remove an individual provider connection.
- Erase all credentials.

Erase all credentials removes only the exact `secrets` folder. Projects, project backups and generated assets remain untouched. Google revocation is attempted before local erasure; locally deleting GitHub or AI credentials does not invalidate those tokens at their providers, and the interface states that boundary explicitly.

## Acceptance checks

- A green Ready light cannot appear from a saved-file check alone.
- Each readiness prerequisite is visible and reports Ready, Pending or Needs attention.
- Collaboration actions remain disabled until Ready.
- Credentials are absent from `.ppf` files, exports, reports, logs and GitHub.
- New Windows credentials are not stored as readable plaintext JSON.
- One confirmed action removes all local provider credential files without touching creative work.
- Focused tests cover the interface contract, readiness checks, centralized storage and exact-folder erasure boundary.
