# Issue #158 — Phase 6 GitHub recovery and offline resilience

## Purpose

Phase 6 completes the six-phase GitHub collaboration roadmap. PlotPickle remains local-first when GitHub is unavailable, authorization expires, a repository moves or is renamed, the approved branch is deleted, or a guarded write finds that the approved story changed.

The recovery layer does not create another collaboration engine. It observes eligible failures and retries the existing canonical synchronization, Story Proposal and collaboration-policy APIs.

## Local-first behaviour

- Writing, planning, storyboarding, reports, backups and portable exports remain available.
- Failed GitHub writes do not roll back or damage the local story.
- A visible recovery centre explains what failed, whether a retry is safe and what the user should do next.
- Restarting PlotPickle preserves the queue and its retry state.

## Credential-protected queue

Queued operations are stored through PlotPickle’s protected local credential-file service. On Windows, the queue receives current-user DPAPI protection. On macOS and Linux, the file remains restricted to the local account.

Before an operation enters the queue, PlotPickle rejects fields whose names indicate an authorization header, token, password, private key, passphrase, client secret, cookie or other credential. The queue is never serialized into a story project, canonical folder, `.ppf`, report, export or GitHub commit.

The browser-facing recovery status never returns the queued request body.

## Eligible operations

The recovery centre observes these existing write paths:

- canonical folder publishing;
- portable release snapshots;
- Story Proposal submission;
- selective Story Proposal approval;
- Story Proposal decline;
- collaboration-policy updates.

The path allowlist is explicit. Arbitrary local or internet requests cannot be placed in the queue.

## Failure classification

PlotPickle distinguishes:

- offline or network failures;
- temporary GitHub and HTTP 5xx failures;
- rate limiting;
- expired or insufficient authorization;
- missing or inaccessible repositories;
- missing approved branches;
- stale-commit and non-fast-forward conflicts;
- invalid requests that require a fresh comparison or proposal.

Temporary failures use bounded exponential backoff. The delay starts at five seconds and never exceeds fifteen minutes. Automatic retries stop after eight failed attempts, while Retry now remains available after the user reviews the connection.

Authorization, repository and branch failures pause instead of retrying blindly. Conflicts move to a review-required state.

## Idempotency and stale-write protection

Queue entries receive a deterministic idempotency key from the allowed path and sanitized body. Repeated capture of the same failed write produces one queue entry.

Each retry is sent back through the original PlotPickle API with the preserved expected remote commit or proposal identity. Existing stale-commit, unique-branch and access-control guards remain authoritative. If a response is lost after GitHub accepted a write, the next retry stops at the existing conflict or already-exists boundary rather than force-writing a duplicate.

## Repository moves or renames

The Diagnose repository action asks GitHub to resolve the saved repository and compares the returned full name with the saved connection.

A moved repository is not adopted automatically. PlotPickle requires:

1. the resolved owner and repository name;
2. an accessible approved branch;
3. a valid `plotpickle-project.json`;
4. the same PlotPickle project ID.

After adoption, the saved connection returns to a not-ready state. The user must run the normal live connection test and receive the green Ready light before collaboration writes resume.

## Deleted approved branch

The Project Lead can recreate a deleted approved branch only when PlotPickle has a previously verified synchronized commit for the same repository and project ID.

The recovery operation:

1. confirms the branch is actually missing;
2. rejects collaborator invitation workspaces;
3. checks that the saved synchronization state belongs to the connected repository;
4. confirms the verified commit still exists;
5. reads `plotpickle-project.json` at that commit and confirms the same project ID;
6. creates a new branch reference from that commit.

PlotPickle never force-pushes, replaces an existing branch or invents a recovery commit.

## Conflict repair

A stale expected commit, non-fast-forward response or already-existing proposal becomes a conflict-review item. PlotPickle does not automatically prefer the local or remote story.

The safe next step is to refresh the approved version, compare it with the local project and create a new review candidate or Story Proposal. Semantic review and selective approval remain the responsibility of the existing Phase 4 engine.

## Recovery centre

The recovery centre is mounted once in the application shell. It:

- captures eligible failed writes;
- shows queue, pause, conflict and failure states;
- retries due operations while the local application is open;
- reacts immediately when the browser reports that connectivity returned;
- allows Retry now and Remove from queue;
- diagnoses repository and branch status without writing;
- offers verified repository adoption and Project Lead-only branch recreation.

Removing an entry affects only the retry queue. It does not alter the local story, backups or GitHub repository.

## Validation

Focused tests cover:

- credential-field rejection and secret redaction;
- failure classification;
- bounded retry timing;
- deterministic queue deduplication;
- public status redaction;
- reuse of existing collaboration endpoints;
- repository identity checks;
- non-forced branch recovery;
- global recovery-centre integration;
- test registration.

The full PlotPickle Quality, Phase 1 compatibility and Windows/macOS/Linux release-candidate workflows remain required before Phase 6 can merge.
