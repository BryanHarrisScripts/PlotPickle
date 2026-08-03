# UI/UX audit setup checklist

- [ ] Add `OPENAI_API_KEY` to GitHub Actions secrets.
- [ ] Optionally set `OPENAI_UI_AUDIT_MODEL` as a repository variable.
- [ ] Merge the workflow and tests.
- [ ] Apply `config/public-repository.settings.json` to the `main` branch ruleset.
- [ ] Confirm `Audit UI/UX against Design Rules` appears as a required check.
- [ ] Confirm a non-UI pull request passes without an external model call.
- [ ] Confirm a synthetic UI issue produces a failing check and updates the single audit comment.
