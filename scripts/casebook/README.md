# Casebook contribution boundary

This directory contains the reusable Business Case contribution and discovery seam for PlotPickle Casebook.

Product- or plugin-specific knowledge belongs in contribution modules and UAT adapters, not in the central runner. A contribution binds one semantic Business Case definition to its owner/capability, lifecycle references, Human Gate requirements, production fulfillment reference, and independent UAT adapter reference.

Unmigrated Casebook definitions may remain temporarily discoverable through legacy compatibility contributions. Promote them only when a concrete product journey is migrated to the 1:1 contract.