# Acceptance tests — baseline (all NOT RUN)
Record actual command, commit SHA, environment, date, reviewer, result and evidence. No pass without evidence. Use synthetic accounts and records. Add SQL/RLS tests and browser tests; UI alone cannot demonstrate authorization.

| ID | Scenario | Expected |
|---|---|---|
| T01 | Anonymous scan/asset API/history direct request | no asset data or metadata returned; sign-in UI |
| T02 | QR A and B, login redirect | correct asset after login; reject external return URL |
| T03 | Viewer read then insert/update/delete via direct API/RPC | scoped read works; all writes denied |
| T04 | Account in another asset/plant, guessed id/token | no access to unauthorized rows, alerts or documents |
| T05 | Disabled account / old session / self role change | denied; role cannot be self elevated |
| T06 | Admin valid submission, reload and history | durable record, actor/time, audit event, correct asset |
| T07 | Invalid payload, end before start, wrong obligation | reject atomically, no partial audit or data |
| T08 | Repeated same request and competing revisions | one effect for retry; conflicting revision rejected |
| T09 | Server/network failure during submit | no false success; safe retry |
| T10 | Due time, before/after, no record / completed record | alert only for eligible missing requirement |
| T11 | scheduler retries/overlapping runs | no duplicate logical alert; failed delivery tracked |
| T12 | Submit after overdue, worker recheck | pending alert resolves; unsent reminders canceled |
| T13 | Approved holiday/shift/overnight rule fixtures | correct operational date and eligibility after rules approved |
| T14 | QR reprint, asset relocation and retirement | stable mapping/history; no identifier reuse |
| T15 | Android Chrome and desktop Chrome/Edge | responsive layout, usable input, physical QR test |
| T16 | PM recurrence incl end-of-month/reschedule | matches approved date rules, audit preserved |
| T17 | JH Not OK and breakdown closure | tracked verification and approved downtime rules |
| T18 | Report/export reconciliation | approved totals, scoped exports, safe spreadsheet cell escaping |
| T19 | Attachments upload/download and restore | scoped, validated, restored DB + objects |
| T20 | load at agreed user/asset scale | meets agreed latency/concurrency/availability thresholds |
| T21 | Security review, secret scanning, dependency audit | no unresolved release-blocking findings |
| T22 | UAT and maintenance/IT approval | written sign-off and operational support owner |

T01–T05 and T15 applicable to first vertical slice, T06–T09 daily submission, T10–T13 reminders, remaining at relevant pilot milestones. Add tests as business rules approved. Use automated synthetic test fixtures and manual actual-device verification. Release blocked by authorization failures, data loss, incorrect key workflows or unapproved production use.

## Evidence log template
- Test ID / commit / environment:
- Expected / observed:
- Commands and exit status:
- Evidence path (no sensitive data):
- Result: NOT RUN / PASS / FAIL / BLOCKED
- Reviewer and follow-up:

## Cloud-development isolation
Foundation CI must not need hosted credentials. Run database and RLS integration tests against disposable CI infrastructure or separately approved test projects, using real synthetic auth identities. Do not reset shared dev or production, do not run tests with privileged bypass credentials to prove Viewer restrictions, and verify target project identity before any write. No Docker or WSL required on either Windows PC.
