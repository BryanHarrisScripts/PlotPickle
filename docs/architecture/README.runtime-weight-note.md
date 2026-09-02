# Runtime-weight architecture note

#1412 Slice A (#1626) uses the six-domain ownership model in `docs/architecture/six-domain-ownership.md` while keeping shipping-weight classification separate.

Repository ownership domains:
- Core
- Story
- Intelligence
- Community & Integrations
- Experience
- Platform

Shipping-weight classes remain:
- core runtime
- core maintenance/runtime tooling
- optional integration/runtime
- reference/example payload
- developer/test-only

This note exists only to make the #1412/#1460 relationship discoverable during the migration. The six-domain document is the architecture authority; `config/runtime-weight-inventory.json` is the Slice A machine-readable shipping inventory contract.
