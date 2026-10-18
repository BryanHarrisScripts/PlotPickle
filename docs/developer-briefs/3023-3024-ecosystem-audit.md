# Complete the OSS and agent baseline inventories

Issues: #3023 and #3024 under #3022. The Human authorized build, test, repair and exact-green-head merge, followed by #3026 and #3025.

## Assessment and impact

The existing canonical OSS audit covers root npm metadata but does not enumerate hidden nested npm locks, the Rust bridge lock or optional Python requirements. The earlier ecosystem checkpoint explicitly left the original Human matrix and agent permissions/health unresolved. The original matrix is now available locally; publish derived labels and dispositions with its LF digest, without redistributing the private attachment.

Owning domain is verification. The existing public command `scripts/third-party-oss-audit.mjs` stays the sole entry point; focused parsing belongs in `lib/verification/oss-dependency-inventory.mjs`. Consumers are the OSS CLI and deterministic verification catalogue. There is no application startup, UI, PPF, provider, signer or persisted project migration. Git is already a developer checkout prerequisite; this audit now requires tracked-file discovery and fails explicitly outside that context. It does not become an installed application dependency.

## Acceptance

1. Inventory all tracked npm package locks, Cargo locks and Python requirements, including hidden paths. Preserve source LF digests, exact locked versions, source/link/integrity metadata, missing licence fields and unresolved Python constraints. Reject malformed supported input, unsupported requirement directives and paths escaping the repository, including junctions.
2. Retain existing registry/licence/influence checks. New inventory is source metadata, not installation, licence clearance or vulnerability certification.
3. Deliver all 28 original matrix dispositions; all canonical registry, asset and non-OSS rows; all six dependency graphs; separately dated npm/GitHub/PyPI/crates.io/OSV evidence; actual local observations and explicit unknowns; sorted risks with existing owners. Different BUZZ release trains must not be collapsed into a false upgrade comparison.
4. Enumerate assembled agent profiles, executable owners, requested/forbidden capabilities, MCP exposure, protocol, roles, Skills, sidecars and supervisor workers. Distinguish registration, installed manifest, protocol response, deterministic proof and actual provider output. Explain public-profile versus Guildhall assembly without fabricating identity health. Carry remaining live adapters under #3008 and runtime/media work under the existing child audits.
5. W8/W9 truth admission precedes focused execution; regression includes malformed graphs, missing metadata, hidden paths, link/junction escape and CRLF/LF equivalence. Focused UAT, production build, convergence, BEN and independent exact-head GitHub gates remain required. Closure means the requested audit and owned dispositions are delivered, not that every external runtime/model is installed or certified.

## Boundaries and rollback

No new package dependency, model download, paid provider call, public/DM message, signer use or real story operation. Current profiles and startup policy remain untouched. Security advisories and unknown licences must stay visible, not be converted into success to close an issue. Revert this verification/report wave to roll back; no user state is migrated.
