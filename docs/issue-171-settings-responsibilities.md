# Issue #171 — Settings responsibility boundaries

## GitHub

GitHub now presents two explicit responsibilities over the existing collaboration foundation:

1. **Connection & Configuration** owns GitHub App setup, account and repository identity, approved-branch selection, five readiness checks, advanced fine-grained-token setup, repository access, testing and disconnect/revoke.
2. **Collaboration & Approval Controls** owns contributor onboarding, bounded Story Proposals, Project Lead semantic-group approval, canonical-content protection, conflict and command recovery, project synchronization and approved history.

Credentials remain outside `.ppf` projects, exports, reports, logs and commits. This change does not introduce a second GitHub connection or proposal model.

## Storage & Backups

The combined Settings label remains **Storage & Backups**, with three visible responsibilities:

1. **Disk Files** is primary project storage. It shows the exact project-folder location, readable `.ppf` files, file size, integrity status, save, open-folder, preview and export controls. `PLOTPICKLE_HOME` remains the one existing mechanism for moving the complete local data home.
2. **Rolling Backups** shows the exact backup-folder location, save behavior, retention, last successful restore point, open-folder control and the complete local restore-point list.
3. **Restore & Recovery** previews tracked differences before applying anything, then allows recovery of the whole project or selected story areas while preserving the active GitHub connection.

The existing local-project gateway remains the canonical storage service. Its rolling-backup save operation now accepts the existing Settings retention limit, clamps it from 1 to 100, and honors whether that save should create a rolling backup.

## Safety boundary

Preview never changes the active project. Whole-project, selected-area and legacy-GitHub restores require confirmation. A local restore preserves the current GitHub connection. GitHub repository recovery remains within Collaboration & Approval Controls and is not presented as a disk backup.
