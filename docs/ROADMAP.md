# Milestones and ownership
No fixed dates or cost commitments; estimate after environment setup and approved requirements. Owners A and B are provisional and interchangeable. Work in vertical slices with small PRs.

| Milestone | A — backend | B — frontend | Exit gate |
|---|---|---|---|
| M0 kickoff | shared repo, bootstrap, contract | review requirements, sketch screens locally | agreed contract, one reproducible Windows setup with cloud-ready configuration |
| M1 secure scan-to-view | auth, scope, RLS, asset seed, QR lookup | login, route resume, list/profile, denied/error/loading states | direct API denial, QR A/B, browser flow pass |
| M2 daily record | obligations, submission transaction, revisions, audit | form, confirmation, history, pending states | persist/reload, viewer denied, duplicates/concurrency pass |
| M3 reminders | scheduler/outbox, test email, alert resolution | bell, missing status, alert view | deterministic time tests, missing only, retry and resolution |
| M4 approved demo | approved synthetic/sanitized configuration, staging if authorized | actual-device test, demo script | client walkthrough, explicit scope feedback |
| M5 3-robot pilot | PM/JH, breakdown, abnormality, storage, reporting and approvals | corresponding screens, QR batch print, reports | approved rules + UAT + restore + security review |
| M6 production | deployment, monitoring, data migration, backups | training, docs, user feedback | maintenance and IT sign-off, support owner, rollback plan |
| M7 150+ rollout | load/storage capacity test and import dry run | bulk operations, filters, reporting | staged onboarding and measurement |

M0–M3 use synthetic data only; no real recipients. Do not treat demo as production. Existing maintenance process remains authoritative until formal rollout. Scope changes after signoff recorded in DECISIONS.md. Advanced workbook formats follow approved priority rather than automatically expanding scope.

## Credit budget workflow
One task, one agent, one branch. Supply only relevant sanitized files and task. Ask agent to inspect current state, implement narrow scope, test, report diffs and stop. Use normal chat/local tools for planning and simple bugs; reserve Work for bounded multi-file changes. Never run the same implementation task on two accounts. Review manually and run tests locally. Avoid rerunning entire prompts for one small fix. Record baseline commit in handoff. After each PR, record changed contract, test commands, failures, next task. Never rely on memory shared between accounts.
