# Issue #165 — Phase 6C guarded repository and branch recovery

Phase 6C completes the recovery controls left after the durable Phase 6A outbox and passive Phase 6B Recovery Centre. Every repository or branch change is an explicit Project Lead action performed by the local server after live GitHub verification.

## Repository moves and renames

PlotPickle follows GitHub's repository response and compares the canonical `owner/repository` name with the saved connection. A moved or renamed repository is only offered as a recovery candidate after `plotpickle-project.json` proves the same PlotPickle project identity. PlotPickle never adopts the resolved repository automatically.

After adoption, the saved connection returns to a non-ready state. The Project Lead must run the normal green Ready check before any GitHub write can resume.

## Missing approved branches

A missing repository and a missing branch remain separate recovery states. For a missing approved branch, PlotPickle can:

- show existing branches whose manifests prove the same project identity;
- let the Project Lead select one verified branch; or
- recreate the approved branch from the last verified synchronization commit.

Branch recreation is non-forced. PlotPickle first proves that the branch does not already exist, verifies the recovery commit and its project manifest, and then creates a new `refs/heads/...` ref. It never overwrites an existing ref.

## Conflict review

Stale expected commits, non-fast-forward changes and other synchronization conflicts become a review candidate. The Recovery Centre shows only public command metadata and the expected commit. It does not expose story payloads, credentials or private content.

**No automatic conflict resolution:** PlotPickle never chooses local or remote content. The writer or Project Lead refreshes the approved story and uses the existing comparison, Story Proposal and semantic review tools.

## Safety boundaries

- Recovery APIs accept loopback requests only.
- Credentials remain server-side and outside projects, `.ppf` files, reports, logs and browser responses.
- Collaborator invitation workspaces cannot change the saved repository or approved branch.
- Repository and branch candidates must prove the same PlotPickle project identity.
- Every adopted repository or selected/recreated branch requires a new green Ready check.
- Local writing, backups and exports remain available throughout recovery.
