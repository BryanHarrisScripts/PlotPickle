# AI Implementing Mathematically Constrained Business Behaviour

From human truth to independently verified software outcomes

White paper  |  Version 3.0  |  October 2026

## The fundamental shift

We stop programming screens and start programming truth.

We move from asking AI to write code and tests to asking AI to implement mathematically constrained business behaviour, with independent verification. The human defines what the software must accomplish, what must remain true, and what must never happen. The system translates those statements into explicit constraints, implements within them, and produces evidence of the actual result.

## Executive summary

The purpose of this evolution is to reduce repeated repairs, unexpected changes, and the frustration of software that passes its tests but fails the person using it. Faster code generation has limited value when the intended outcome must be restated after every change. The enduring reference should be the required business behaviour, preserved independently of any particular implementation.

The fundamental change begins in the conversation between a human and a language model. The human communicates promises about outcomes. The model proposes a precise interpretation, identifies consequential gaps, and connects the accepted meaning to mathematical constraints and observable checks. An implementation is then evaluated against those requirements. Its own code and explanations do not determine what success means.

The human does not need to write code, inspect generated source, or formulate mathematical notation. Their responsibility is to express and confirm the required behaviour in terms they can judge. Technical modelling, implementation, and verification belong to the engineering system. This division still requires precise decisions; it does not make ambiguous requirements disappear.

The desired deterministic outcome is practical: when a person uses the software under defined conditions, its behaviour matches the agreed expectations. Known failures have defined responses, uncertainty is represented accurately, and a change cannot silently redefine an existing promise. The implementation may change substantially while the approved behaviour remains authoritative.

This paper describes an evolutionary method applicable to any application or program. It combines established engineering foundations with a different use of the language model: preserving human meaning through specification, implementation, and independent observation. Its proposed benefits must be evaluated through fewer escaped failures, less rework, and more dependable user outcomes. It does not claim that formal constraints alone eliminate all defects.

## 1 The problem this change must solve

A familiar pattern in AI-assisted development begins with a person describing a desired feature. The model interprets the request, produces code, generates tests, and reports success. The person then uses the application and discovers that the result does not meet the expectation. Further prompts produce repairs, exceptions, and additional tests. The development process can become a sequence of locally successful changes that never settles the original requirement.

One cause is that the meaning of success remains inside a changing interpretation. The model may understand "save" as completing a function call, while the human means recovering the same work after restart. A test written from the implementation's assumptions can confirm the function call without checking recovery. Both the code and its tests agree, but the user outcome is wrong.

Another cause is that changes lack explicit boundaries. A repair to one workflow may alter shared state, permissions, or persistence used by another. Without preserved behavioural obligations and an assessment of affected contracts, an apparently small change can create an unexpected result elsewhere.

The proposed method addresses these causes by separating required behaviour from implementation and protecting that behaviour throughout development. A failure becomes a discrepancy between a named requirement and an observation. This makes diagnosis more focused and reduces the need for the person to explain the same intention repeatedly.

The method must also reduce the effort imposed on the human. Requiring them to become a programmer, a test author, and a systems diagnostician would transfer the original frustration into a different activity. The system should ask for decisions about meaning and provide concise evidence about outcomes.

## 2 What programming truth means

A business truth is an agreed statement about the behaviour the application must preserve within a defined scope. It may describe an outcome, a relationship, an authorization boundary, a permitted change, or a condition under which an operation must succeed. "Business" includes the purpose of any program, including a personal tool or creative application.

Examples include "a successful save must preserve the selected version across restart," "a rejected request must not create a record," and "a change to a customer's address must not alter an approved invoice." These statements describe promises a person can understand without knowing how the program is built.

A truth must distinguish required behaviour from a preferred implementation. The human can require recoverable data without selecting a database. They can require that duplicate submissions do not create duplicate bookings without writing retry logic. Where an implementation choice affects the promise, the system must expose that consequence as a decision about behaviour.

Truth also includes what the person sees. A success message, a status indicator, or an available action can communicate a false promise even when the underlying computation is correct. Screens must reflect the authoritative outcome and the user's current state. Their design remains important because they are part of how the application fulfils its contract.

The term does not imply an absolute or unchangeable account of reality. Requirements can be incomplete, contradictory, or later revised. An approved truth is authoritative for its stated scope and version. A material change to that meaning must be recorded explicitly rather than introduced through implementation convenience.

## 3 How a human communicates truths to a language model

The human begins with ordinary language about the work they want to accomplish. They may describe a situation, narrate a workflow, supply examples, or explain a failure. The system's responsibility is to extract the behavioural promises while preserving the original words and relevant context.

A useful form is: "When this happens, this result must follow. This condition must remain true. This other result must never occur. If completion is impossible or uncertain, the software must respond in this way. I will know it worked when I can observe this outcome."

For example: "When the application says my note is saved, I must be able to close it, reopen it under the same account, and recover that content. Saving must not change another note. If the result is uncertain, show that uncertainty and keep my unsaved work available."

The person does not need to fill out a technical form. The model can build a structured record from the conversation and return a short interpretation in the person's terms. It should distinguish an explicit requirement, an inferred assumption, and an unresolved question. An inference must not acquire authority merely because the model stated it confidently.

Questions should resolve decisions that materially affect outcomes. Does reopening mean on the same device or on any device? What should happen when two people edit the same record? The model should explain the consequence of each choice. It can resolve routine technical details within the accepted boundaries without repeatedly asking the human to authorize them.

The human confirms the meaning through examples and consequences. They should be able to say, "Yes, that is the result I expect," or identify what is missing. Agreement does not require them to understand the internal state manager, storage adapter, or verification language.

The communication process therefore produces more than a prompt. It produces a preserved statement of purpose, a confirmed interpretation, and examples that distinguish acceptable behaviour from failure. These become the reference for every subsequent stage.

## 4 From conversation to an authoritative contract

The translation process must preserve a continuous relationship between the original request, the confirmed truths, the formal constraints, and the evidence. Giving each truth a stable identifier allows the system to show what was implemented and what was checked without reconstructing a long conversation.

First, the system captures the source request and extracts proposed truths. It identifies scope, relevant inputs and state, required outcomes, protected relationships, and defined exceptions. It records assumptions about storage, external services, and operating conditions where they affect a promise.

Second, the system returns an interpretation with concrete cases. The cases include ordinary success, a relevant failure, and any ambiguous situation that changes the expected result. The human resolves the consequential choices and confirms the intended meaning. This validates the requirement before its technical implementation is treated as authoritative.

Third, the engineering system translates the confirmed meaning into a versioned behavioural contract. The contract includes applicable states, permitted transitions, invariants, success conditions, failure conditions, and evidence requirements. Each technical rule points back to the truth it serves. A rule without that relationship is a proposed addition that needs justification. Timing, performance, and cost limits must also be represented where they affect the promised outcome.

Fourth, the system checks whether the requirements are consistent and achievable under the stated assumptions. Contradictory promises require a decision. For example, immediate access from every device cannot be guaranteed while every device is disconnected. The system should present the conflicting outcome and proposed resolution in ordinary language instead of silently reducing the requirement.

Finally, the accepted contract becomes the reference for implementation and verification. Later model calls receive that version rather than freely reinterpreting the conversation. Contract history, relevant examples, and unresolved limitations remain available when the model or implementation changes.

Formal precision does not by itself establish that the translation is faithful. A mathematically consistent contract can capture the wrong intention. Returning concrete scenarios to the human and retaining their confirmation is therefore an essential part of the chain.

## 5 A complete example of communicating a save truth

The human says: "Saved must mean I can reopen the same work. I should not have to repeat this requirement every time saving is changed."

The model's proposed interpretation is: "For this version of the requirement, a successful save preserves the selected note content for the same account across a normal application restart on the same device. The success message refers to the content actually saved. Other notes remain unchanged. Uncertain completion remains visibly uncertain."

If access from another device is also required, that becomes an additional promise with its own storage and connectivity conditions. If recovery after device loss is required, the system needs a corresponding backup or remote-storage guarantee. These are consequential distinctions about expected outcomes, not coding questions for the human.

The accepted contract identifies the note, account, content, version, and operation. A successful save requires a confirmed durable commit within the declared recovery scope. The selected version must remain recoverable while retained, unless an authorized action changes or removes it. A user-interface flag alone cannot establish that the commit occurred.

The contract distinguishes pending, committed, rejected, and unknown operation states. Unknown means the application cannot yet establish whether the request took effect. A timeout may occur after the store commits the content but before the acknowledgment reaches the application. Treating every timeout as a failed write would create a misleading result and could cause unsafe retries. The contract defines a pending time limit and how reconciliation resumes when dependencies become available. A rejected save must leave the current unsaved content available in the active editing session.

Retries must preserve the meaning of the original operation. Within the supported deduplication period, the same operation identifier and same content must not create another effective write. Reusing that identifier with different content must be rejected. The saved content and the record used to recognize retries must remain consistent after interruption. The implementation needs an atomic transaction or a recovery protocol that preserves this relationship.

If the person continues editing while a save completes, an acknowledgment for an earlier version must not mark later edits as saved. The display can report the completed version while showing that the current contents still contain unsaved changes. The storage outcome and the current editor state are related but distinct facts.

Competing edits require an explicit policy. In this example, a write based on an outdated version is rejected as a conflict instead of silently overwriting another accepted change. A different application may support merging, but the resulting behaviour requires its own agreed rules.

Independent verification then saves known content through the supported workflow, records the resulting identity and version, ends the application process, and reopens it. It checks the recovered content and the visible status. Further checks interrupt an acknowledgment, repeat the operation, introduce a competing edit, and verify that another note remains unchanged.

The result returned to the human is expressed through the truth: "The saved version was recovered after restart," or "The application reported success, but the recovered content differed." The engineering system supplies the technical diagnosis and repair. The human judges whether the observed outcome fulfils the promise they approved.

## 6 How mathematics constrains the result

Mathematics converts approved relationships into conditions that can be checked systematically. It helps the system identify prohibited states, contradictions, invalid transitions, and combinations of events that ordinary examples may miss. It narrows the freedom of the implementation without requiring the human to choose its internal code structure.

For a note identified by d and a version identified by v, one requirement can be expressed as:

$$
\operatorname{ReportedSaved}(d, v) \Rightarrow \operatorname{DurableCommit}(d, v)
$$

This means that a reported successful save requires the corresponding durable commit. DurableCommit has a precise meaning in the contract, including the stated storage and recovery assumptions. A variable named "committed" in the implementation is insufficient evidence that this property holds.

A second kind of rule governs changes. Let s be a valid state and a be an action. Invariant names a protected property, Allowed states when the action is permitted, and Next describes its resulting state. The preservation requirement is:

$$
\operatorname{Invariant}(s) \land \operatorname{Allowed}(s, a) \Rightarrow \operatorname{Invariant}(\operatorname{Next}(s, a))
$$

For every relevant state and permitted action, the protected property must remain true. In the note example, an allowed save of one note must preserve the contents of unrelated notes. The engineering system can use the model to examine whether particular action sequences violate that rule.

Preservation alone is insufficient. An implementation that never saves could avoid false success messages while failing the user's purpose. Safety properties prohibit unwanted outcomes; progress properties require the intended work to complete under the defined conditions. Where completion cannot be established, the contract must provide a defined response and a recovery path. [2]

Constraints may also cover counts, identities, ordering, permissions, timing, and resource limits. Their value comes from their relationship to a promise. A numerical limit introduced without a requirement can constrain the wrong behaviour just as precisely as the right one.

The model and implementation must be connected explicitly. If the model treats a write as indivisible but the implementation spreads it across several services, that assumption requires an actual mechanism or a revised design. Model checking establishes properties of the model within its examined scope. It does not automatically prove that the delivered application behaves according to that model.

## 7 What a deterministic outcome means

In this method, a deterministic outcome means that approved inputs and relevant conditions produce behaviour governed by explicit rules. The person can rely on the promised effect and understand the defined result when completion is prevented or uncertain. A model's confidence or a changing interpretation must not decide whether an operation counts as successful.

The same visible action can have different legitimate results when the relevant state differs. Saving with an available store differs from saving when the device has lost access to it. Determinism requires the contract to account for those conditions. It does not require the application to pretend that every environment is identical.

An external dependency may behave unpredictably. The application still needs defined rules for accepting its result, reporting uncertainty, limiting retries, and recovering. These rules can constrain the workflow even when a network response or generated artifact cannot be predicted exactly in advance.

For AI-generated content, the contract can govern authorized inputs, ownership, required format, allowed actions, and acceptance criteria without promising identical wording on every generation. Subjective quality may require a human decision. The system must distinguish that decision from properties it can verify mechanically.

The ultimate check is the person's actual workflow. Internal conformance must result in correct visible feedback, appropriate available actions, recoverable data where promised, and the expected business effect. An implementation that passes internal checks but violates that workflow requires further investigation.

Ordinary failures must not be excluded from the model simply to obtain a proof. Assumptions need review, and operational checks need to cover the conditions the product claims to support. Correctness is always stated relative to those conditions and the available evidence.

## 8 Independent verification as the source of acceptance

AI may generate code and propose tests, but its implementation must not define the standard by which it is accepted. The contract and expected outcomes must exist independently of the generated code. The implementation cannot remove an obligation or change an expected result merely to make a check pass.

Independence is a property of the evaluation process, not simply the presence of another model. A second model given the same ambiguous prompt can reproduce the original misunderstanding. Verification needs a preserved requirement, a reliable source of expected results, and observations that can reveal failure even when the implementation reports success.

For the save truth, the known content and accepted recovery requirement supply the expected result. Reading the stored result after ending the original process supplies an observation beyond the original response. Checking the interface against that result establishes whether its displayed state is accurate.

Different methods contribute different evidence. Model analysis examines the design's rules and assumptions. Property-based checks explore varied inputs and sequences. Integration checks exercise actual boundaries between components. Product checks observe supported user actions and results. Relevant security, accessibility, and performance checks evaluate additional obligations. The verification plan selects the methods needed for each promise.

A simulated response can establish how code reacts to a particular event. It cannot establish that real storage, an external service, or a device performed the required operation. Evidence must retain that distinction. A build that succeeds cannot substitute for a recovery check that was never run.

Each result records the contract version, implementation revision, environment, configuration, and observations. PASS means the required check demonstrated conformance within that scope. FAIL means an observation contradicted a requirement. BLOCKED means a necessary condition prevented evaluation. UNPROVEN means the required evidence is missing or insufficient.

The engineering system may propose corrections to either the implementation or the contract. A contract correction that changes the promised behaviour requires the relevant human decision. A repair that restores already approved behaviour can proceed within existing authority. The person should not have to repeatedly approve the same requirement.

## 9 Preventing unexpected changes and repeated repair

Every material implementation change should identify the truths it is intended to affect and the existing obligations it must preserve. Shared dependencies and data ownership determine which other contracts may be affected. This assessment gives verification a focused basis for checking regression risk.

The accepted change states the behavioural difference. For example, "An uncertain save will now reconcile its original operation after connectivity returns" describes a permitted change. "Saved still means the accepted content survives restart" describes a protected obligation. A refactor can alter internal code without gaining authority to alter that obligation.

When verification fails, the system should report the violated truth, the observed discrepancy, and the relevant evidence. A useful report says that the application displayed success for version 7 while restoration returned different content. A generic statement that several tests failed provides less help in identifying the business failure.

Diagnosis should compare the confirmed meaning, the model's assumptions, the implementation's behaviour, and the actual dependency results. A correction should target the responsible mismatch. Adding another condition or compatibility layer without explaining the failure can preserve the same problem under a more complex implementation.

Successful evidence must remain tied to the version checked. Material changes to dependencies or configuration can invalidate assumptions and require relevant checks again. A prior green report should not conceal the fact that an operating condition has changed.

No finite test suite guarantees that every unintended change will be caught. Where evidence is incomplete, the system must state that scope. The objective is to make preserved behaviour explicit, improve detection, and reduce uncontrolled changes rather than promise universal certainty.

## 10 Evolving architecture and existing software

This approach builds on design by contract and formal specification rather than claiming to invent them. These methods already separate obligations from implementations. The proposed evolution uses the language model to preserve the relationship between human meaning and those engineering mechanisms throughout development. [1, 2]

Begin with one capability that causes repeated frustration or has a clear consequence when it fails. Record the intended behaviour, the observed legacy behaviour, and the replacement's observed behaviour separately. A known defect in the existing application should not become a permanent requirement merely because the old code exhibits it.

Define a small boundary around the capability and run its contract checks against the current implementation. Simplify or replace the smallest responsible component. Existing frameworks, tools, and working integrations should be reused where they can fulfil the contract. The method requires no new programming language or complete application rewrite.

Authority must be explicit for each operation and kind of data. A distributed application can have several stores, but must specify how it establishes a committed result and resolves competing updates. A cache, provider response, or optimistic interface display must not silently become an alternative authority.

Contracts also need to compose. A workflow cannot promise recovery after device loss if every underlying component provides only local persistence. Separately correct components can fail together when they disagree about identity, ordering, permissions, or retries. Integration review must compare the assumptions each component makes with the guarantees supplied by its dependencies.

Migration requires checks for data identity, representation changes, ownership transfer, and recovery. Running old and new implementations together must not duplicate real writes or external actions. Rolling back code cannot automatically restore data that the old code no longer understands. A recovery plan must account for the actual migration.

Retire the old component when its consumers and data responsibilities have transferred and the required evidence supports removal. Temporary adapters need an owner and an explicit removal condition. Adoption should reduce competing responsibilities, not add a parallel framework around the original ambiguity.

## 11 What the human receives from the system

The human receives a concise statement of the accepted truths, the material choices that require their judgment, and evidence about the resulting behaviour. They should be able to see which promise was implemented, which conditions were checked, and whether any required outcome remains blocked or unproven.

The working record preserves the original request, confirmed interpretation, contract history, and relevant examples. A new model session can use that record without requiring the person to narrate the entire project again. The system treats accepted meaning as an artifact with continuing authority.

The person may revise a truth when their needs change. The model explains the effects of that revision on outcomes and existing data. Once accepted, the revised contract guides the implementation. Routine technical repairs can remain the responsibility of the engineering system while decisions about changed behaviour remain visible.

The necessary understanding is how to communicate and recognize the intended promise. The human needs to know whether reopening the same work, preserving another record, or handling a rejected operation matches their expectation. They do not need to learn source-code inspection to exercise that authority. Technical assurance still requires competent engineering and verification, supplied by the system and its responsible operators.

The success of the interaction is measured through dependable use. Clear communication is useful because it prevents interpretation drift and supplies an enduring standard for correction. Its purpose is to reduce the repeated effort the human spends managing the consequences of misunderstood requests.

## 12 Evaluating whether this evolution works

The proposal should be evaluated through a bounded pilot with a baseline, declared acceptance criteria, and comparable workflows where possible. The first pilot should use a recurring failure whose expected outcome can be independently observed. Completing a specification or producing more tests is insufficient as a final success criterion.

Measure the time from an accepted truth to a verified user outcome, the number of escaped failures, repeat repairs, unexpected behavioural changes, and the effort needed to diagnose a discrepancy. Include the cost of maintaining contracts and operating verification. Faster implementation is useful only when the total effort to obtain the expected result improves.

Measure the human's burden as well. Track how often the same requirement must be restated, how much manual reproduction is required, and how many technical decisions are returned unnecessarily to the person. A process that improves internal reports while preserving the original frustration has not achieved its purpose.

Set thresholds before interpreting the pilot's results. Expand the approach where improved reliability and reduced rework justify its cost. Simplify it where formal work exceeds its practical value. A small low-risk change needs proportionate checks; critical state and irreversible effects require stronger guarantees.

The expected benefits remain claims to be tested. The method earns adoption through evidence that people can use the resulting software and obtain the outcomes they agreed, with fewer surprises and less continuous repair.

## 13 The governing engineering principle

We stop programming screens and start programming truth.

The human communicates the promises the application must fulfil. The language model turns those promises into a reviewable interpretation. Confirmed meaning becomes a versioned contract. Mathematical constraints define the legal boundaries of behaviour, and AI implements within them. Independent verification examines the actual result against the approved promise.

The enduring authority is the required behaviour and its explicitly revised meaning. Code, frameworks, and providers can evolve while those obligations remain protected. The human's role is to define and judge outcomes; the engineering system's role is to make those outcomes dependable.

The fundamental shift is AI implementing mathematically constrained business behaviour, with independent verification. Its practical purpose is to end the cycle in which the person repeatedly repairs an interpretation instead of receiving the software behaviour they requested.

## References

[1] Bertrand Meyer. Applying Design by Contract. Computer, October 1992. Foundation for explicit obligations and guarantees between software components. [https://se.ethz.ch/~meyer/publications/computer/contract.pdf](https://se.ethz.ch/~meyer/publications/computer/contract.pdf)

[2] Chris Newcombe, Tim Rath, Fan Zhang, Bogdan Munteanu, Marc Brooker, and Michael Deardeuff. Use of Formal Methods at Amazon Web Services. September 2014. Industry account of formal specification, model checking, safety, and progress. [https://lamport.azurewebsites.net/tla/formal-methods-amazon.pdf](https://lamport.azurewebsites.net/tla/formal-methods-amazon.pdf)
