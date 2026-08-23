# UI/UX audit setup checklist

- [ ] Add `OPENAI_API_KEY` to GitHub Actions secrets.
- [ ] Optionally set `OPENAI_UI_AUDIT_MODEL` as a repository variable.
- [ ] Merge the workflow and tests.
- [ ] Apply `config/public-repository.settings.json` to the `main` branch ruleset.
- [ ] Confirm `Visual` appears as a required check.
- [ ] Confirm a non-UI pull request passes without an external model call.
- [ ] Confirm a synthetic deterministic UI contract issue produces a failing check; AI review remains advisory.
