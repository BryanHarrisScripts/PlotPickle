# #3048 — CodeQL record and verifier-fixture safety

Parents #3023 / #3027. Human authorized repairs, testing, PRs and merge when green.

## Assessment and required behavior

CodeQL #68/#69 flags untrusted key assignments in Afterglow record application.
The narrow public record-write seam reproduces the problem: writing a record at
`/__proto__` changes the target prototype rather than retaining an own record.
Preserve arbitrary imported keys as own data and leave object prototypes and
source values unchanged. Do not discard user fields or mutate real projects.

CodeQL #70/#71 flags runtime fixture values interpolated into JavaScript in the
verifier HTTP test. Pass loader initialization values using Node's supported
register data channel. Stub code stays static and retrieves the isolated fixture
through a fixed test-only Symbol. Existing real HTTP/receipt assertions stay intact.

## Ownership and implementation

Owners: existing modules/library/afterglow-consolidation.mjs and existing focused
tests. Use an internal own-property writer, not a second consolidation engine.
Both terminal and intermediate keys must use the safe write. Preserve current
entity-array identity, source copies, explicit removal and review decisions.

Tests stay in their current catalogued files. Bind the revised consolidation
file to already-approved WHITE-PAPER-V3 v3.0 W8/W9 and refresh complete LF digests
before execution; do not amend approved truth or expected existing outcomes.
W8 requires independent, scoped security evidence; W9 requires preservation of
existing behavior and diagnosis of the responsible mismatch. These fixtures
observe own-data preservation, unchanged source and real receipt HTTP behavior.

## Acceptance and impact map

- Prototype-like terminal/intermediate keys retain their data, support explicit
  deletion and do not change target prototypes or source records.
- Dynamic fixture values no longer become executable loader/stub source.
- Original receipt authority/contradiction/readback assertions remain unchanged.
- Governed negative regression demonstrates red before the fix and green after.
- Existing consolidation, story-intent and verifier tests, focused UAT, build,
  convergence, independent review and exact-head CodeQL/architecture CI pass.

Downstream consumers are Afterglow consolidation review and explicit record
application; no persistence, profile access, provider calls, imported source,
automatic acceptance, canon authority or Human workflow changes are introduced.
Product observations remain separate: synthetic fixtures cannot certify a real
Human consolidation, saved master, media or authentication session.

Rollback is a revert of this repair; it would restore the identified unsafe
assignment behavior and must not be treated as a safe permanent downgrade.
