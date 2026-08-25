# Privacy Notice

Last reviewed: 25 August 2026

This notice describes the official downloadable PlotPickle edition. It does not replace the privacy terms of BUZZ, an AI provider, GitHub, Google, or an independently operated server edition.

## Local profile and private workspace

PlotPickle is local-first. Creating a base Human profile requires a display name and passphrase. It does not require an email address, phone number, PlotPickle cloud account, BUZZ identity, GitHub account, Google account, or Internet connection.

The official local edition keeps Human-profile state, private projects, LEARN answers, PLAN decisions, BUILD artifacts, local agent state, settings, and credentials within the selected PlotPickle Node by default. Profile-private records are stored under the local computer account and protected by the PlotPickle profile boundary. Credentials are kept outside PPF project files, exports, prompts, reports, and source control.

PlotPickle shows a profile recovery secret once. The official project does not keep a separate recovery copy and cannot reset a local profile by email.

## When information leaves the Node

Connecting an optional service does not itself upload the active project. Information leaves the Node only when the Human initiates an action that needs an external destination.

| Destination | Information deliberately sent | Information not sent merely by connecting |
| --- | --- | --- |
| BUZZ Community | Connected BUZZ identity, signed presence and membership data, the exact message deliberately posted, and BUZZ event metadata needed for delivery | Private PPF state, LEARN answers, PLAN decisions, BUILD artifacts, local files, provider prompts, and credentials |
| Cloud or remote AI provider | The prompt, selected story context, and selected media named for the requested generation or analysis | The entire project, unrelated profiles, BUZZ history, and credentials for other services |
| GitHub | Repository identifiers and the project/proposal material deliberately pushed, proposed, or opened in GitHub | Unsubmitted local drafts, local backups, other projects, and unrelated credentials |
| Google | Account name and email after consent, plus the event title, time, attendees, and meeting details deliberately saved through the requested Calendar action | The active story or private project state |
| Manual export or prompt copy | The files, text, or media the Human deliberately downloads, exports, or copies | Other profile-private records |

Local AI runtimes and a loopback ComfyUI endpoint do not inherently send prompts to a hosted provider. A Human who configures a non-loopback or third-party compatible endpoint is choosing that endpoint's operator as an external recipient.

External services apply their own account, billing, logging, retention, deletion, training, and jurisdiction terms. PlotPickle does not make those promises for them and does not silently replace a failed local route with a paid cloud request.

## Diagnostics, feedback, and operational evidence

The in-app Suggest / Report surface prepares a sanitized GitHub issue draft. It can include version, browser, platform, and time only after the Human opts in. It does not attach the active story, project title, local paths, credentials, or private repository details. The Human reviews the draft and submits it on GitHub.

Developer and agent telemetry may contain runtime, tool, model, timing, status, and reproducible error metadata. It must not contain credentials, hidden reasoning, full prompts, full model responses, or private story text.

## Storage, backups, retention, and deletion

Local project files, encrypted profile records, exports, caches, and backups remain under the Human's computer account. Backup retention is bounded by the configured local backup behavior; it is not permanent storage. Moving a story to PlotPickle's Archive is not deletion.

Removing the application does not guarantee removal of projects, profile data, exports, credentials, backups, or external copies. The Human must deliberately remove local data they no longer want and use each external service's controls for information already sent there. PlotPickle cannot promise that an external operator will retain or delete information on a particular schedule.

## BUZZ rooms and visibility

BUZZ signed room history is the authoritative record shared by PlotPickle and BUZZ Desktop. Public-room messages should be treated as public to that Community. Closed and private rooms restrict access according to BUZZ membership policy, but participants should not treat a room label as a confidentiality agreement.

Merrin Bellwarden may use bounded public-room etiquette or spam patterns but must not build sensitive profiles about participants. Merrin must not silently enter a private Story Room or copy private Story Room text into public memory, public conversation, training data, or PPF canon.

## Server operators

PlotPickle includes an advanced `server-network` mode, but the official project does not provide a hosted PlotPickle SaaS. An independent operator must secure the deployment and publish terms that accurately describe that operator's collection, access, backups, retention, deletion, support, and jurisdiction practices. This notice must not be reused to imply practices the operator cannot support.

## Questions and review

Use PlotPickle's Suggest / Report surface for a factual product or documentation problem. Privacy obligations for a particular organization, deployment, or jurisdiction require review by an appropriately qualified Human professional; a software agent does not approve legal sufficiency.
