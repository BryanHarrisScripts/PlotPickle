# CodeQL second security pass

Track and fix the remaining CodeQL findings shown after the first security pass.

Scope:
- remove no-op substring replacements in `tests/issue-483-feedback-studio.test.mjs` and `tests/issue-88-visual-board-navigation.test.mjs`;
- harden Windows command launching in `scripts/spawn-command.mjs`, `scripts/run-npx-stdio.mjs`, and `scripts/pi-worker-runtime.mjs` without suppressing CodeQL;
- harden dynamic browser-evaluation literals in `scripts/casebook-evidence.mjs`;
- add explicit least-privilege permissions to `.github/workflows/runtime-weight-inventory.yml`;
- update focused tests to preserve behavior and verify the security boundaries.

Acceptance:
- no CodeQL suppression comments or workflow disabling;
- Windows command wrappers keep `shell: false` and reject unsupported command-shell characters;
- environment-derived shell executable selection is removed;
- dynamic browser labels are encoded with a dedicated JavaScript-literal sanitizer before expression construction;
- normal PR Gate and Product Gate pass before merge.
