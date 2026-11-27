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

## FND-01 local evidence

27 November 2026, native Windows x64, Node 22.23.5, npm 10.9.9, Git 2.56.0.windows.4. Tested on `feature/foundation` from baseline `4b0a4eec2aebac638aff938f4d6e0eec97d7ee25`. The foundation commit contains the tested source and this evidence. Executed by the engineering assistant. Human review is pending.

| Command or check | Observed result |
|---|---|
| `npm.cmd install --package-lock-only --ignore-scripts` | Exit 0. Generated lockfile. |
| `npm.cmd ci` | Exit 0. Installed 137 packages on Windows from the lockfile. |
| `npm.cmd run check` | Exit 0. ESLint passed with zero warnings, TypeScript passed, Vitest passed 1 of 1 test, and Vite built 16 modules into `dist/`. |
| `npm.cmd audit` | Exit 0. npm reported zero known vulnerabilities. |
| Lockfile origin, integrity and license metadata inspection | All 163 dependency entries use the public npm registry and SHA-512 integrity. Declared licenses include MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0 and BlueOak-1.0.0. The MPL and Blue Oak entries are development tooling. |
| `npm.cmd run preview -- --port 4181` and `Invoke-WebRequest http://127.0.0.1:4181/` | Built shell returned HTTP 200 on loopback. |
| Edge headless `--dump-dom http://127.0.0.1:4181/` | The mounted page contained both status values. Preview stopped after verification. |
| `npm.cmd run dev -- --port 5174` and Edge headless `--dump-dom http://127.0.0.1:5174/` | The native development server started and Edge rendered both setup statuses. Server stopped after verification. |
| `git check-ignore .env.local .env.production supabase/.temp/project-ref private.pem .npmrc dist/index.html node_modules/react/package.json` | All seven sample paths matched ignore rules. |
| Staged file review, `git diff --cached --check` and targeted `git grep --cached` credential check | Clean diff check. No matching private key blocks, Supabase secret keys, JWTs, GitHub tokens or credential-bearing PostgreSQL URLs. |

The Windows GitHub Actions workflow is configured for the same clean install and four checks. Hosted CI, the database, authentication, RLS and T01–T22 remain untested in FND-01.

## Evidence log template
- Test ID / commit / environment:
- Expected / observed:
- Commands and exit status:
- Evidence path (no sensitive data):
- Result: NOT RUN / PASS / FAIL / BLOCKED
- Reviewer and follow-up:

## Cloud-development isolation
Foundation CI must not need hosted credentials. Run database and RLS integration tests against disposable CI infrastructure or separately approved test projects, using real synthetic auth identities. Do not reset shared dev or production, do not run tests with privileged bypass credentials to prove Viewer restrictions, and verify target project identity before any write. No Docker or WSL required on either Windows PC.
