# 2764 — MiniMax H3 authority-save runtime and diagnostics

## Root cause

The Cloud Story Mode authority route imported `normalizedUrl` from `build/media-provider-common.ts`. That module statically imports Sharp for image conversion. Saving credentials therefore pulled Sharp into the Next/Vite RSC/Miniflare route graph even though authority save does not manipulate images. On Windows this could make the worker resolve a non-Windows Sharp native package and fail before the route's normal response handling.

Provider authority is configuration. It must not load the native media execution stack.

## Repair

- Move provider URL validation into `build/provider-url.ts`, which has no Sharp or media-native dependency.
- Keep a compatibility re-export from `build/media-provider-common.ts` for existing desktop media execution callers.
- Make `app/api/cloud-story-mode/provider/route.ts` import the Sharp-free helper directly.
- Preserve the existing Windows Sharp startup readiness/repair behavior; do not add libvips/WASM installation or another image runtime.

## H3 diagnostics

Cloud provider setup now keeps a bounded, timestamped test history in the current browser session. Refreshing status does not clear it.

The history records:
- authority-save success/failure without storing the secret;
- writing/image test start and result;
- MiniMax H3 request start;
- accepted MiniMax task ID;
- each changed polling status;
- terminal failure text after local redaction;
- completed local output link when PlotPickle has retained the video.

Local endpoint responses are read as text first. JSON is parsed when possible; HTML or other non-JSON error bodies now produce an HTTP-status diagnostic instead of a JSON parse exception.

No API key, Authorization header or private provider response is intentionally persisted in the history.

## Cost boundary

The existing direct standard MiniMax H3 path keeps the provider minimum four-second request and changes the request resolution from 2K to 768P. PlotPickle still trims/uses only the three-second Timeline authority downstream. This issue does not switch to H3 Max or claim that a 480P Max route is equivalent.

## Billing and verification boundary

Saving authority does not call MiniMax and does not prove Subscription Key, M Plan, purchased-credit or pay-as-you-go compatibility with the exact H3 endpoint. Configuration readiness is not paid-generation success.

No paid MiniMax request is authorized by this implementation or its automated tests. A real H3 request remains a separate explicit Human action through the existing billing and data-sharing confirmations.

## Acceptance evidence

- Focused #2764 regression locks the Sharp-free authority import graph, non-JSON diagnostics, durable test history and 768P/4-second standard H3 request.
- Existing #2495 Windows Sharp runtime test continues to prove the reusable Windows native Sharp startup/repair contract.
- Exact-head Architecture Verification and the impact-selected product gates remain required before merge.
