# Web Anywhere: LEARN, Community and Remote Node Dispatch

Status: Phase E implementation contract for #1071 / #1077.

This phase builds on the PlotPickle-owned Person/Avatar/Node authority from #1072, portable LEARN state from #1073, and explicit trusted/public Compute Node contract from #1075.

The web client is a deliberately limited client surface. It is not the full local Studio and does not become PPF/project authority.

## Web role

The web boundary may expose:

- the authenticated PlotPickle Person and canonical Avatar;
- portable LEARN state;
- signature-verified BUZZ Community projections;
- allowlisted project summaries/accepted artifact descriptors;
- authorized Compute Node discovery;
- exact-target #1075 remote BUILD dispatch;
- provenance-bearing candidate review and reconciliation status.

It does not contain:

- unrestricted PPF/project files;
- Node private keys;
- provider credentials;
- local filesystem paths;
- hidden prompts/reasoning;
- arbitrary shell/tool authority.

## Public/shared-computer sessions

A web session is an opaque PlotPickle session reference bound to the same Person and canonical Avatar. Authentication providers remain replaceable evidence; they do not become identity authority.

The contract enforces:

- public-computer sessions expire within two hours;
- private-browser sessions expire within eight hours;
- web state is marked `memory-only` and `no-store`;
- explicit revocation blocks later access;
- sensitive/paid actions require re-authentication within ten minutes;
- permanent Node/provider credentials are outside the session schema.

A production HTTP layer consuming this contract must emit matching no-store/private-cache headers and clear transient client state on sign-out.

## LEARN

Web LEARN directly sanitizes through `createPortableLearnState()` from #1073. It does not invent a web sync schema.

Desktop, web and future mobile therefore reconcile the same completion, resume, bookmark, note and curriculum-answer state according to the existing portable LEARN rules.

## Community

Web Community is a projection of BUZZ history only.

The contract requires:

- `authority: buzz`;
- one explicit room;
- signature-verified BUZZ events;
- no independent web message store.

The existing local BUZZ gateway remains loopback-only because it can access local BUZZ credentials. The future web host must consume a sanitized authenticated BUZZ projection; it must not expose the desktop gateway or its private key to the Internet.

## Project review/export boundary

A web-safe project export contains only:

- project ID and revision;
- title;
- short current frontier/summary;
- descriptors for explicitly accepted artifacts;
- explicitly approved remote context items.

Artifact descriptors use ID, SHA-256, media type, byte length and acceptance time. Remote context uses the same narrow story/character/world/visual/instruction kinds accepted by #1075.

Unknown fields are rejected, including unrestricted `ppf`, provider credentials and local paths.

## Find a Node

Web discovery calls #1075 and strips the underlying advertisement down to a client view grouped as:

- Your Nodes;
- Trusted/Studio Nodes;
- Public Nodes.

The view contains truthful availability, capability/model/workflow class, coarse memory/load, protocol version, cost and advertisement expiry. It does not expose remote owner identity, endpoints, filesystem paths or credentials.

## Remote BUILD dispatch

One web dispatch requires:

1. an active web session;
2. an explicitly exported project context;
3. one active authoritative project Node owned by the account;
4. one explicitly selected discoverable/available Compute Node;
5. context/reference IDs that already exist in the web-safe export;
6. the normal #1075 capability/model/workflow/resource/task-grant contract;
7. explicit billing consent plus fresh reauthentication when the target is paid.

There is no silent fallback to another Node or paid service.

The resulting #1075 work package remains least-privilege and exact-target.

## Candidate return and reconciliation

Remote output returns as the #1075 candidate:

- provenance-bearing;
- `candidate`;
- `not-canon`;
- `accepted: false`.

The browser may preserve and present that candidate even when the authoritative project is temporarily unavailable.

A user's review may request reconciliation, but the browser still reports `savedToProject: false`. Only a receipt from the same active authoritative project Node can transition the web envelope to `savedToProject: true`.

This prevents false "saved" status when a travelling user's home workstation is offline or reconciliation fails.

## Relationship to #1090 and #1079

#1077 and #1090 are sibling client surfaces over the same account/Avatar, LEARN and BUZZ authorities. Their transport/session implementations may differ without creating separate product identities.

#1079 is the local managed host/supervisor. A future remote job arriving from web can be fulfilled by a #1075 Node service hosted under #1079, but the web client never manages the underlying process directly.

The intended separation is:

`web client -> authenticated/sanitized PlotPickle contract -> #1075 Node dispatch -> #1079 managed host`

not:

`browser -> local BUZZ credentials / Node key / ComfyUI port / shell`.
