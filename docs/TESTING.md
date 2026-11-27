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

## FND-02 contract verification

27 November 2026, native Windows, foundation baseline `e41b031`. `npm.cmd run check` passed lint and TypeScript checks, both Vitest tests and the Vite build. TypeScript verifies the public session keys, bounded page sizes and separation of M1 from provisional operations. Runtime auth, scoped authorization and pagination tests depend on the M1 implementation. Hosted CI and human contract review are pending.

## M1-A.1 local evidence

27 November 2026, native Windows, baseline 3bb5314. Developers A and B approved moving the QR locator to AssetSummary. Developer A confirmed both M1 migrations were unapplied before editing. `npm.cmd run check` passed lint, strict type checking, 13 tests and the build. The focused `npm.cmd test -- src/lib/data/supabase.test.ts` passed 11 tests with intercepted HTTP. `node --check supabase/tests/verify-hosted.mjs` and `git diff --check` passed. Human SQL review is pending.

The SQL tie-boundary and grant assertions, hosted directory and same-JWT deactivation checks, and integrated two-browser-tab behavior remain unexecuted. Follow the [isolated test procedure](../supabase/migrations/README.md) after separate target approval.

## M1-B frontend handoff

28 November 2026, native Windows, feature/m1-frontend based on remote main 04ad77eda04f8d00f377df70d971eeb0ee326edb. The integration owner mounts `<MachineWorkspace adapter={adapter} />` from src/pages/MachineWorkspace.tsx using one approved browser adapter. The test entry is isolated from src/main.tsx. Serve the application entry for direct requests to /machines and /m/:qrToken. Login preserves the validated local machine path and ignores return-URL query parameters. Use the server's newest-first history order and per-asset capability.

The assistant ran `npm.cmd run check` successfully (lint, strict typecheck, 18 unit tests, foundation build). `node tests/frontend/browser.mjs <screenshot-directory>` built the actual frontend with its explicit synthetic test entry and passed the Edge flow at 1280×850 and 390×850. Set CMMS_PLAYWRIGHT to an existing Playwright package path if unavailable on the normal module path. The optional output directory receives directory and profile screenshots. The first browser harness run did not complete because the test library bundle lacked a browser definition for the React environment; the corrected test build passed.

Coverage includes signed-out deep link, sign-in and same-machine continuation, directory search, cursor navigation, profile/history, ignored stale search response, expiry, logout, empty result, temporary failure, denied machine and denied history. The responsive check uses a mobile viewport on desktop Edge. Physical Android QR scanning, real identity and two-tab session handling with Supabase await M1-I.

## M1-A.3 backend acceptance

**Hosted evidence source.** Developer A's M1-A.3 handoff for the isolated synthetic project cmms-dev, reference `fgawjraoekdnhdbqqrvm`. The assistant did not access the hosted project. The intended SQL source commit was `3b2559df821bbfd1917e14f94bfe771ab60df857`. Exact executed SQL hashes were not independently verified. No hosted execution time was supplied.

| Verification | Developer A's reported observation |
|---|---|
| Migrations | Developer A reported success for each complete migration submission via the Supabase SQL Editor, in this order: `20261127000100_m1_storage.sql` and `20261127000200_m1_reads.sql`. Both are immutable. |
| Database objects | Six application tables created, all six with RLS enabled. Four public RPC functions verified as security invoker. |
| Privileges | Anonymous RPC execution denied. All 24 checked authenticated table write privilege restrictions were confirmed. The private-schema REST probe checks schema isolation separately. |
| Fixtures | Four synthetic Auth accounts provisioned, twelve synthetic assets and twelve history records loaded. The Viewer account was replaced after its password was forgotten. |
| Database and API checks | SQL constraint tests executed. The replacement Viewer authenticated during the standard hosted security runner, which exited successfully using the publishable key. |

**Local evidence.** During the 28 November 2026 documentation handoff, the assistant ran `npm.cmd run check` on native Windows. Lint and strict type checking passed, Vitest passed 13 of 13 tests across three files, and Vite built 16 modules. Real two-tab browser verification remains pending frontend integration. CLI migration-history reconciliation is a separate prerequisite for future CLI applies.

**Constraint evidence.** Developer A reports the constraint-test screenshot showed no assertion errors and included the final ROLLBACK statement. Full-script execution and the post-test rollback outcome remain unconfirmed.

**Same-JWT evidence.** Developer A reported completing the deactivation test. Detailed evidence is pending for each of the following observations. The standard hosted runner pass stands independently.

- Successful initial machine read with the JWT selected for this test.
- HTTP 403 / PostgreSQL 42501 after disabling the profile using the same still-unexpired JWT.
- Restoration of the replacement Viewer profile.
- Successful machine-data read after restoration.

The privileged-key incident remains open. See the [incident record](SECURITY.md#synthetic-development-credential-incident).

## M1-I integration

The integration branch starts at frontend commit `5bc3502`, which contains reviewed backend commit `3b2559d`. The separate handoff `1e4e9af` contributed documentation only. Its security, testing, adapter and migration records were incorporated without merging branches. The normal React entry creates one adapter outside the StrictMode render lifecycle and injects it into MachineWorkspace. Hot-module teardown unmounts React and disposes the adapter. Vite exposes only the approved project origin and a validated publishable-key value. The setup error screen keeps protected routes locked.

**Local evidence, native Windows / Edge.** The assistant ran these checks on the integrated checkout. The transport fixture is imported only by the browser test runner, outside the application build.

| Command | Observed result |
|---|---|
| `npm.cmd run check` | Lint and strict TypeScript passed. Vitest passed 18/18 across four files. The integrated production build transformed 65 modules. |
| `node tests/integration/browser.mjs` | Passed against the development entry with the actual SDK and intercepted project HTTP. |
| `node tests/integration/browser.mjs --preview` | Passed against the built assets with the same interception. Direct /machines and /m/:qrToken loads and reloads, login continuation, directory/profile/history reads, scoped denials, two real tabs, account switching, delayed directory delivery after logout, back navigation and simulated expiry/rejected renewal all passed. |
| `node tests/integration/browser.mjs --invalid-config` and `node tests/integration/browser.mjs --missing-config` | Both showed Workspace unavailable with no login controls or machine rows. |
| `node tests/frontend/browser.mjs "$env:CMMS_SCREENSHOTS"` | Frontend fixture flows passed at widths 1280 and 390. |

An early delayed-read test used a request helper that bypassed interception and attempted a project read with a synthetic token. That run is excluded from offline evidence. The final test delays delivery inside the tab after the normal intercepted fetch. Screenshots labeled integrated-fixture show synthetic HTTP results. They do not establish server authorization.

**Hosted browser acceptance (prepared; pending).** Configure the ignored .env.local as described in the README. Use the existing Playwright package and installed Edge. On this workstation, in PowerShell:

```powershell
$env:CMMS_PLAYWRIGHT = "$env:USERPROFILE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
node tests/integration/browser.mjs --hosted
```

The runner starts its own loopback listener on 5184 and opens a fresh browser context. Developer A enters the two existing synthetic account passwords only into the visible application form when prompted. The Viewer should resume DEMO-ROB-001 after login, read its history and directory after reload, and receive generic denial for the South asset. The machine-specific admin should gain the asset-specific indicator on DEMO-ROB-001 and receive denial on DEMO-ROB-002 and the South asset. The runner holds a directory response across logout and checks the second tab during the subsequent account switch. Capture only redacted outcomes. An unconfirmed remote sign-out is a failure requiring follow-up.

Separately check genuine session expiry in two tabs using a synthetic test session whose provider renewal has become invalid. Allow its issued access token to expire under the project's existing lifetime, resume each tab, and verify that protected data is cleared and sign-in is required. Successful normal renewal is not an expiry test. The automated expiry test uses a browser clock and intercepted rejected renewal; no provider policy changes were made. The credential incident, same-JWT evidence and constraint rollback evidence remain as recorded above.

**Physical Android (pending).** For an approved USB-only test, serve the built assets through a loopback-only HTTPS endpoint on port 8443 with a localhost certificate trusted by the managed test phone. Configure SPA fallback for /machines and /m/*. Forward the Android localhost port to that endpoint over USB; verify the exact HTTPS origin and valid certificate on the phone first. A temporary test label encodes https://localhost:8443/m/ followed by the corresponding synthetic QR UUID. Scan DEMO-ROB-001 and DEMO-ROB-002 while signed out, sign in as the authorized Viewer, verify the matching machine number and refresh each route. Remove forwarding after the test. This setup requires an approved device and trust configuration; none was provisioned here. [Chrome USB forwarding guide](https://developer.chrome.com/docs/devtools/remote-debugging/local-server/)
