# UI/UX audit gate change

This change replaces the extensionless `.github/workflows/UI/Code Audit` file with a valid required workflow, moves the audit logic into a tested script, and adds the exact job name to the public repository required-check contract.

Validation includes the full PlotPickle quality, security, release-candidate, and UI/UX audit workflow set on the final pull-request head. The final synchronization verifies the updated Windows navigation smoke wrappers.
