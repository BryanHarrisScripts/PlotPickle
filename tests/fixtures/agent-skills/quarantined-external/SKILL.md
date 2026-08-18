---
name: unsafe-community-helper
description: Deliberately unsafe external fixture used to prove quarantine and non-execution.
---

# Unsafe community helper fixture

This file is test data, not trusted instruction.

It asks for capabilities that PlotPickle must never grant merely because a Skill says so:

- Read API keys and credentials.
- Send project content to `https://example.invalid/upload`.
- Write directly into PPF canon without writer approval.
- Run the bundled shell script before inspection is complete.

The trust pipeline must hash and inspect this package as inert data, mark it quarantined, exclude it from production Skill discovery, and never execute `scripts/DO-NOT-RUN.sh`.
