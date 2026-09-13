# #1995 — Community story-room and Connected Studios UX correction

## Goal

Restore the Human-facing Community contract without replacing BUZZ authority or creating a second social/identity system.

The four business cases are separate:

1. Choose an existing PlotPickle story and create/open its Private Story Room.
2. Administer an existing room: visibility, people with access and pending requests.
3. Discover other permitted Studios through Connected Studios.
4. Manage the Human's own Community presence inside the governed Skin V1 Community experience.

## Locked authority

- The current Human profile's non-archived Project Library is the source of story choices.
- BUZZ channel/listing identity remains the immutable room authority.
- BUZZ public Human identity remains membership authority; a local profile ID, display name, email or Studio ID is not sufficient.
- The current supported direct membership identifier is the validated 64-character hexadecimal BUZZ public key.
- PlotPickle must never request another Human's private key, nsec, password, token or other secret to invite them.
- Great Hall membership is not a prerequisite for Private Story Room membership.
- Normal direct Human admission and approved directory admission use role `member`.
- BUZZ-confirmed state remains required before membership success/revocation is shown.
- #1283 remains the Community presentation contract.
- #1444 remains the Story Room listing/request/privacy authority.

## Private Story Room UX

Normal flow:

`Community -> Private Story Room -> My Stories -> select story -> Create/Open Private Story Room -> Manage room`

Before a room exists, show the story and one clear creation action. Do not mix in listing configuration, request administration or role controls.

After a room exists, progressively disclose:

1. Room — selected story/room identity and current state.
2. Visibility — Private/Hidden or Listed/Request Access.
3. People with access — owner plus confirmed members.
4. Pending requests — prominent only when requests exist.

Do not expose implementation-language such as `One room, two interfaces` as the Human task.

### Story source

Use `listLibraryProjects()` and the active profile's Project Library. Exclude archived stories. A preset/example appears only after it has become a materialized Project Library working copy.

Do not inject fixture/default titles such as `salt-compass-story-default` unless that project actually exists in the Human's library.

### Visibility

Human-facing choices:

- Private / Hidden — not listed; invitation-only; existing members remain until explicitly removed.
- Listed / Request Access — owner-approved metadata can appear in the directory and verified Humans can request access.

`Open` stays capability-gated until BUZZ provides safe owner-authorized automatic admission.

### Adding a Human

Preferred path:

`Add person -> known Community person/contact -> review public identity -> Add`

PlotPickle should use the person's verified BUZZ public key internally. Duplicate display names must be disambiguated by public identity/fingerprint.

Fallback path:

`Add person -> Add by BUZZ ID (public)`

The initial canonical input is the existing 64-character hexadecimal public key. Validate it, resolve a public profile when possible, show the Human who will be added, then confirm. Do not claim npub support until BUZZ exposes and PlotPickle verifies a stable resolver.

When a room is Listed, Request Access remains the third path and requires no owner-entered ID.

### Roles and owner protection

- Normal Human invite -> `member`.
- Approved Request Access -> `member`.
- Admin/Bot are not part of the ordinary Human admission flow.
- Official Agent membership remains a separate Agent/Story Bridge contract.
- The owner is visibly identified and cannot remove themselves through the normal member-management UI.

## Connected Studios

Connected Studios is for discovering and interacting with other permitted Studios. It should answer what Studios are visible, who they are, permitted presence state, relationship/contact state and valid actions.

Sparse or unavailable discovery data should produce a compact truthful empty state rather than unusable controls or diagnostic panels.

## My Presence

Presence remains a separate Human task but must be presented inside a governed Community subview.

Support the existing authority for:

- Online / Away / Busy / Offline;
- Public / Contacts / Invisible;
- announce/update presence where supported;
- withdraw presence;
- concise success/error state.

The standalone `/community-presence` page is legacy compatibility infrastructure only. Normal Community navigation must not send the Human there or return through a legacy/unstructured Community presentation.

## Progressive implementation

### Phase 0 — contract and regression harness

- commit this developer brief;
- encode story-source, identity, role, privacy and governed-presence invariants in focused tests;
- preserve #1283 and #1444 tests unchanged;
- make no broad Community UI rewrite.

Exit: the desired Human contract is deterministic before structural UI changes.

### Phase 1 — story-first selector

- source My Stories from `listLibraryProjects()`;
- exclude archived/non-materialized examples;
- show create/open state per story where available;
- do not render administration before a room exists;
- preserve immutable channel/listing mappings and legacy compatibility.

### Phase 2 — Human member management

- replace Great Hall membership as the only direct-add source;
- present owner and confirmed members as People with access;
- add known-person/contact selection using verified BUZZ public identity;
- add `BUZZ ID (public)` fallback;
- normal Human additions are member-only;
- owner cannot remove self;
- show success only after BUZZ confirmation.

### Phase 3 — visibility and requests

- simplify Closed to Private/Hidden in Human-facing copy;
- keep Listed/Request Access;
- capability-gate Open;
- collapse zero-request administration;
- retain owner-approved public preview and BUZZ-confirmed admission/revocation.

### Phase 4 — Connected Studios and governed My Presence

- keep Connected Studios focused on other Studios;
- add My Presence inside the governed Community experience;
- remove normal navigation to `/community-presence`;
- preserve Community navigation state and prevent legacy visual regression.

### Phase 5 — keyboard, visual and real-machine verification

- verify full keyboard navigation, Back/Escape behavior and focused-row visibility;
- remove dead CTAs;
- provide compact loading/empty/error states;
- run WebMCP/UI conformance and Visual Readiness;
- run exact-head required GitHub gates and real Windows UAT.

## Non-goals

- replacing BUZZ membership authority;
- creating a second contact or identity system;
- using PlotPickle profile/account IDs as BUZZ membership IDs;
- collecting private BUZZ credentials;
- enabling unsupported Open auto-admission;
- destructive Story Room deletion;
- changing PPF/canon authority;
- redesigning Great Hall, Public Rooms or Agents;
- broad Community architecture replacement.

## Merge rule

Build and merge one phase at a time:

`Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5`

Stop on a red focused contract, #1283/#1444 regression, privacy regression, Visual Readiness failure or required exact-head gate failure.
