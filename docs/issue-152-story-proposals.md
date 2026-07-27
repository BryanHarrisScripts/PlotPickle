# Phase 4 — Story Proposals

Issue: #152

## Purpose

Story Proposals turn GitHub branches and pull requests into a filmmaker-facing review workflow. Contributors work locally, refresh the Project Lead-approved canonical folder, make changes and create a proposal without manually naming branches, commits, repository paths or pull requests.

## Contributor flow

1. Refresh the approved story.
2. Edit locally in any PlotPickle workspace.
3. Create a Story Proposal.
4. PlotPickle compares the local canonical `project/` folder with the approved commit.
5. Only changed canonical project files are written to a new `plotpickle/proposal/` branch.
6. PlotPickle opens a GitHub pull request and shows it in the Story Proposal queue.

The approved branch is never changed during proposal creation.

## Semantic review

PlotPickle compares the approved and proposed projects as story models rather than presenting only text-file diffs. Changes are grouped into:

- Story and development
- Dialogue and screenplay
- Characters and voices
- Scenes and structure
- World and canon
- Production
- Review and revisions
- Rights and provenance

The Project Lead can approve any combination of changed groups. PlotPickle rebuilds the accepted project from the approved base plus the selected semantic groups. Unselected groups remain out of the approved result.

## Guarded approval

Approval records the exact approved base commit used during review. Before writing, PlotPickle verifies that:

- the connected repository and approved branch are still available;
- the current approved branch commit matches the reviewed base commit;
- the proposal base matches that same commit;
- the proposal contains a valid canonical PlotPickle project folder;
- the project ID matches the repository manifest;
- every deletion remains inside the managed canonical project root.

If the approved branch moved after review began, PlotPickle stops and requires a fresh review.

## Git operations

Proposal creation uses the Git Data API:

1. Create blobs for changed files.
2. Create one tree from the approved base tree.
3. Create one commit whose parent is the approved commit.
4. Create a proposal branch pointing to that commit.
5. Open a pull request.

Selective approval uses the same atomic tree and commit model, then performs a non-forced approved-branch ref update. The proposal is closed with a PlotPickle decision marker and a Project Lead decision comment.

## Local refresh

After approval, PlotPickle returns the approved project and commit to the local application and records the synchronization state in the encrypted local credential area. Any collaborator can also use **Refresh approved story** to replace the local project with the latest approved canonical folder.

## Privacy and ownership boundary

- GitHub access tokens and refresh tokens remain in PlotPickle's encrypted local secrets area.
- Credentials are not stored in canonical project files, `.ppf` snapshots, proposal bodies, reports, logs or commits.
- Local drafts, autosaves, prompts and assets remain local unless their canonical project representation is intentionally included in a Story Proposal.
- `.ppf` remains a portable exchange and release snapshot format, not the canonical collaboration payload.

## Compatibility

Repositories still using a single approved `.ppf` file retain the explicit legacy review path. New Story Proposals require the canonical modular project folder introduced in Phase 3.

## Phase boundaries

Phase 5 adds invitation packages and role-based onboarding. Phase 6 adds offline queues, retries, moved-repository recovery, deleted-branch recovery, conflict guidance and end-to-end sandbox reliability tests.
