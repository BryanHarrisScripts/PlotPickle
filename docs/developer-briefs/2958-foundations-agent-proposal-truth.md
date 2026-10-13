# #2958 — Foundations Agent proposal fidelity: preserve named constraints and expected language

## Human observation and reproducible synthetic source
During October 12–13 Mind Map > Foundations > Ask Agent, a suggestion was in English but contained unexpected Chinese words, collapsed separately named mother/father households to "respective parents", and added unsupported parental guidance. Human saved premise remained intact; the suggestion was not accepted. The private source/prompt is not added to this repository. Synthetic test premise: "The sisters alternate between their mother's household and their father's household." Negative response: "They move between their respective parents; their mother's advice guides them. 中文。" This is not a general judgment about all LLMs.

## Truth contract — TRUTH-FOUNDATIONS-PROPOSAL-001
A Mind Map agent response has proposal status only, never Human-saved field authority. Deterministic *negative* controls must guard exactly the known type of failure:
- If the bounded current Human field value explicitly names `mother's household` and/or `father's household`, a proposed Foundations field cannot silently replace that named household relationship with a generic `parents` claim.
- If the output has unsupported parental advice/guidance attributed to mother/father that the current field never contained, do not admit it as a proposal.
- If the English curriculum task returns unexpected Han writing with no Chinese/Mandarin request or Han source field, do not admit it; a Human request in Chinese or source already in Han script is a required negative control against English-only coercion.
- The model gets one corrective retry with the exact diagnostic. After two failures, show a visible failure and do not store, accept, rewrite or claim success. A passing bounded checker is **not** a mathematical proof of arbitrary semantic equivalence.
- Independently protect the project/revision/selected target while async inference runs. Existing historical proposals are screened again before Human chooses "Use Suggestion." Human can edit the value directly; there is no silent auto-adoption.

## Small implementation
A pure model in `modules/learn/model/mind-map-proposal-fidelity.mjs` (typed declaration) returns diagnostic predicate results and a bounded two-attempt selection. The established `app/skin-v1/discovery-surface.tsx` Ask Agent path now sends explicit constraint/language instructions, validates model output before `setProposalDrafts` or `writeStoryDevelopmentFieldProposal`, and preserves proposal-only authoring. The unchanged project storage and canonical acceptance functions retain ownership. No provider routes, Human authentication, imported screenplay, stored field values or saved notes are migrated.

## Independent verification and limits
`tests/issue-2958-foundations-proposal-fidelity.test.mjs` executes the pure checker with positive and negative family/language fixtures, two-attempt successful correction and fail-closed exhaustion, the *actual extracted* Ask Agent handler under deferred synthetic provider responses, stale target non-admission, and the *actual extracted* existing Use Suggestion handler protecting a previously saved invalid suggestion. Admit tests under approved WHITE-PAPER-V3 W8/W9 with deterministic artifact digests. All seven architecture layers, installed build and impact-selected lanes as required by CI on the final head.

These controlled negative cases **do not** demonstrate every semantic obligation or every language, actual installed Windows Ollama/MiniMax output quality, a physical Human authenticated session, or an original private premise/provider replay. Run a separate real Windows synthetic (non-private) Mind Map Ask Agent/Use Suggestion observation and confirm saved project continuity in open #2943. No provider success should be inferred merely from synthetic tests.
