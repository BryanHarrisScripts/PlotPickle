# #3033 — ASSETS image routing without manually typing Command operations

User requested easy **Local / Cloud / Hybrid** selection in ASSETS during Brotherly Love Characters/Posters creation, with controlled, automated background use of existing connection endpoints.

- Uses `/api/ai-routing/status`, `/api/media-routing/test/image`, and `/api/ai-routing/select` through the existing authenticated request helper; never stores keys or a second provider choice in PPF.
- **Review Switch + Test** opens the precise action preview. No operation on browsing/tab selection. Local explicit confirmation runs a test only when a route lacks current proof. Cloud explicit consent for possible provider charges and sending the test prompt must be accepted before any request. Profile-owned authority validates the selection.
- Route change only proceeds after image verification returns `ready` and a `verifiedAt` receipt. Exact selected-route read-back required. A test failure leaves old choice intact; no paid fallback or auto-confirm and no opportunistic cloud upload.
- **Hybrid**: current registered image engine/provider pairs do **not** support a verified cross-locality image-generation route; label Hybrid clearly **unavailable**, show saved Join if present, do not invent executable pairing. Later approved adapter may enable via existing Connection joins, separately proven.
- Routing selection affects current profile image capability, immediately reflected by ASSETS Posters and Characters. No effect on canonical screenplay truth, saved characters, existing approved art, or other capability choices.
- Synthetic contract checks under WHITE-PAPER-V3 W8/W9 with explicit limitation. A green CI run does not prove paid cloud setup/test on the Human's computer; user defers end-to-end UAT until #3032/#3033/#3035 all merge.
- Work sequence: build → test → fix → PR → CI green → squash merge. #3019 continues for World/Collectibles/portability.