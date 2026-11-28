# M1 final QA — acceptance withheld

Reviewed 28 November 2026 on native Windows, branch `feature/m1-integration`, clean baseline `59950e485c3d4cbef98d4b7a00d57fb7aa08c2c0`. The IDs below follow the final QA request. The approved target is the isolated synthetic project cmms-dev, reference `fgawjraoekdnhdbqqrvm`.

Developer A authorized hosted testing on this project, a temporary disable/restore of the replacement synthetic Viewer and one complete rollback-only constraint run. The USB HTTPS endpoint was verified by Developer A. Physical Android device approval is pending.

| ID | Expected | Actual result and evidence | Status | Remaining action |
|---|---|---|---|---|
| T01 | North directory contains exactly the assigned machines | Live Edge showed DEMO-ROB-001/002 and TEST-3 through TEST-10 on page one, then TEST-11 alone with Next disabled. Directory reload succeeded. | PASS | None for the synthetic directory. |
| T02 | Authorized profile and newest-first history | Live QR profile loaded after refresh with one parseable, dated history entry. The UI ordering assertion passed for that entry. | PASS (single-entry fixture) | T09 exercises multi-entry ordering and timestamp ties across a page boundary. |
| T03 | Signed-out QR resumes its machine | Live Edge showed sign-in with no protected records on direct directory and QR visits and refreshes. After Viewer login the URL retained QR 1 and the expected profile loaded. | PASS | None. |
| T04 | Machine Admin can access machine 1 and is denied machine 2 | Live Edge showed the Machine admin capability on robot 1, generic denial for robot 2 and denial on the second tab's South route. | PASS | None. |
| T05 | South Viewer sees only South assets | Live Edge returned only TEST-12 with Next disabled. Its QR opened a View only profile. Searching for DEMO-ROB returned zero matches. Direct QR 1 and 2 both showed generic denial with no detail, history or rows. | PASS | None. |
| T06 | Logout clears both tabs and Back cannot restore protected content | A real directory response was delayed locally after receipt. Logout locked both tabs, did not display the remote-sign-out failure and releasing the response left zero rows. Back showed sign-in without machine details. | PASS | None. |
| T07 | Shared tabs reflect login, logout and account changes | Live Edge loaded Viewer data in both tabs, locked both on logout, and enforced Machine Admin scope after switching accounts. | PASS | Genuine token expiry with rejected renewal and browser restoration remain separate follow-ups. Simulated expiry passed in the earlier run. |
| T08 | One unexpired JWT can read, is denied during disable, and can read again after restoration | The initial fixed read returned HTTP 200 and DEMO-ROB-001. The operator reported that they did not disable the profile and could not confirm T09 was idle. The test paused before the change. | DEFERRED | In an attended window, verify the current profile, obtain a fresh baseline, observe 403/42501 during disable, restore the original enabled state and observe HTTP 200 with the same request. |
| T09 | Complete constraint transaction rolls back and fixtures match | Static inspection confirmed BEGIN/ROLLBACK and the expected assertions. Earlier operator screenshot showed the rollback statement and no visible assertion errors. New run and matching snapshots await operator evidence. | DEFERRED | Developer A records the one authorized execution and before/after comparison below. |
| T10 | Incident controls reviewed and outcomes recorded | Developer A attested to verified revocation, temporary key disposition, review of API and Auth logs, rejection of the accidental request and dependent-service checks. Prior local pattern scan found zero candidates. | PASS | Attestation-based M1 review. The specific temporary-key disposition, log coverage dates and retention gaps were not supplied. Available logs cannot exclude misuse. |
| T11 | Physical Android camera scans both labels over trusted USB HTTPS | Developer A verified the endpoint. Two synthetic labels exist. No approved phone or physical scan evidence. | DEFERRED | Perform the device procedure below when an approved phone is available. |

Developer A deferred T08, T09 and T11 to allow local M2 development. M1 final acceptance remains withheld. The last T08 attempt stopped before the operator changed the profile. At the M2 handoff there was no local hosted test runner or listener on port 5184. No hosted account inspection or deferred test was performed at this handoff.

## Resumed hosted run

On native Windows, `node tests/integration/browser.mjs --hosted` exited 0 using headed Edge, the real adapter and the approved project. The assertions above are automated browser observations. Passwords were entered locally. The delayed-read assertion held the delivery of an actual response. The functional runner signed out the final South Viewer and closed its browser and server. The earlier start was observed only through the password prompt and contributes no authenticated evidence.

`node tests/integration/browser.mjs --hosted --same-jwt` reached the initial 200. The operator asked to pause before any profile change. Interrupting the terminal prompt ended the run with exit 1 (readline closed). The runner's sign-in-screen cleanup check raised no error. A subsequent Windows process check found the runner gone, zero remaining direct child processes and zero listeners on port 5184. No disable or restoration was performed in this attempt. The earlier baseline demonstrates enabled Viewer access at the time of that read only.

`npm.cmd run check` exited 0 after the QA changes. ESLint and strict type checking passed, Vitest passed 18/18 in four files and Vite built 65 modules. The three changed JavaScript test modules passed `node --check`. `git diff --check` exited 0. These checks did not execute SQL.

## Evidence from the preceding offline review

- `npm.cmd run check` exited 0. Lint and strict type checking passed, Vitest passed 18/18 tests in four files, and Vite bundled 65 modules.
- Ran the existing integration browser script in its intercepted mode with Edge forced through a temporary loopback deny-only proxy for non-loopback traffic. Service workers were blocked. The proxy rejected 53 requests, including possible browser background traffic, and forwarded none. Direct routes and refresh, QR continuation, history, scoped denials, two-tab changes, delayed reads, Back and simulated expiry/restoration passed. This additional network guard applied to this run only. Use it or equivalent egress isolation for future simulated runs. This earlier run used intercepted HTTP.
- Targeted offline pattern scan covered 49 tracked/non-ignored working files, 92 distinct Git blobs and 14 commit/tag objects reachable through local refs and reflogs. Zero candidates for the checked Supabase secret, JWT, private-key, GitHub token, database URI and credential-assignment patterns. The scan does not establish absence of arbitrary passwords, historical material outside those objects, screenshot leaks or unauthorized use.
- The ignored local configuration matched the exact approved origin and expected browser publishable-key format. No unexpected Vite variable names were found there or in the current process. The built JS contained the approved project origin and no match for the privileged-key pattern. No values were printed. Other machines and dependent services remain outside this check.
- The earlier accidental hosted request originated from a test helper that bypassed interception. The current runner holds the result of normal browser fetch instead. Developer A subsequently identified the matching request as rejected in the API and Auth log investigation.
- Temporary browser and proxy closed; no listener remained on the test runner's port 5184. The earlier offline review created no hosted sessions and disabled no profiles. The earlier Viewer restoration remains unverified.

## SQL Editor evidence for Developer A

Use only cmms-dev (`fgawjraoekdnhdbqqrvm`). Keep T08 and T09 in separate quiet windows. Report counts, booleans, HTTP status and SQLSTATE only. Keep account identifiers and digests local.

### T08 replacement Viewer

1. Look up the current account in Auth using the exact fixture email. In SQL Editor, inspect the query below. Confirm exactly one enabled profile, its UUID matches the **current** Auth account, and the active membership is the expected North Viewer membership. If the profile is missing or disabled, stop and report the precondition. Preserve the observed UUID locally and prepare the restoration statement before changing anything.

   ```sql
   select p.user_id, p.enabled, m.role, m.plant_id, m.asset_id, m.active
   from auth.users u join cmms.profiles p on p.user_id = u.id
   left join cmms.memberships m on m.user_id = p.user_id
   where u.email = 'm1-viewer@example.invalid';
   ```

2. Wait for a successful authorized machine read with the selected JWT. Only then run the following guarded update after replacing the UUID placeholder locally. Confirm exactly one returned row with `enabled = false`.

   ```sql
   update cmms.profiles p set enabled = false
   from auth.users u
   where p.user_id = u.id and u.email = 'm1-viewer@example.invalid'
     and p.user_id = '<verified replacement UUID>'::uuid and p.enabled
   returning p.enabled;
   ```

3. Record the same-request result while disabled. Restore immediately even on test failure, interrupted automation or token expiry. For restoration use the same verified UUID and require exactly one returned row with `enabled = true`. If identity matching or the row count is unexpected, inspect the specific profile locally before any further action.

   ```sql
   update cmms.profiles p set enabled = true
   from auth.users u
   where p.user_id = u.id and u.email = 'm1-viewer@example.invalid'
     and p.user_id = '<verified replacement UUID>'::uuid and not p.enabled
   returning p.enabled;
   ```

4. Repeat the read after restoration and record the result. For same-JWT evidence require the fixed JWT to remain valid through each observed response. Keep a fresh-login recovery result separate if the JWT expired.

### T09 single rollback-only run

1. From a fresh SQL Editor query, run the following read-only snapshot. Keep the output locally for comparison. It covers all six application tables, profile flags, grants of membership and the current identity associations for the four synthetic accounts. The Auth projection deliberately includes only fixture identity fields.

   ```sql
   with fixture_rows(group_name, row_data) as (
     select 'plants', to_jsonb(p) from cmms.plants p
     union all select 'departments', to_jsonb(d) from cmms.departments d
     union all select 'assets', to_jsonb(a) from cmms.assets a
     union all select 'history', to_jsonb(h) from cmms.history h
     union all select 'profiles', to_jsonb(p) from cmms.profiles p
     union all select 'memberships', to_jsonb(m) from cmms.memberships m
     union all select 'fixture_accounts', jsonb_build_array(id, email)
       from auth.users where email in ('m1-viewer@example.invalid',
       'm1-admin@example.invalid','m1-machine@example.invalid','m1-south@example.invalid')
   )
   select group_name, count(*) as row_count,
     md5(jsonb_agg(row_data order by row_data)::text) as comparison_digest,
     count(*) filter (where group_name = 'profiles' and row_data->>'enabled' = 'true') as enabled_profiles
   from fixture_rows group by group_name order by group_name;
   ```

2. Verify the four fixture associations, the expected counts (12 assets and 12 history records), and the replacement Viewer's enabled North membership. With no other fixture edits in progress, run the complete unchanged [constraints.sql](../supabase/tests/constraints.sql) **once** as one selection from `begin;` through `rollback;`. Its assertions cover duplicate and immutable identifiers, chronological pagination with timestamp ties, Viewer scope, direct write grants, mutation denial and disabled access. Keep the SQL Editor completion result. On error stop, ensure the transaction is rolled back or the connection closed, and report the error category. Do not rerun the file.
3. Run the identical snapshot in a fresh transaction. Compare the full sets of groups, counts, digests and enabled-profile counts. Verify the final rollback and unchanged state before marking T09 passed.

## Physical Android procedure

1. Developer A verified the trusted loopback HTTPS USB endpoint on port 8443. Obtain the approved test phone and confirm the endpoint serves the built application with SPA fallback. The phone must trust the certificate for localhost.
2. Forward device localhost:8443 over USB to desktop localhost:8443. Verify HTTPS certificate validity first. Keep the endpoint private.
3. Present the existing synthetic labels on a separate screen or paper. Starting signed out, use the physical phone camera to scan DEMO-ROB-001, then sign in locally. Confirm the profile shows DEMO-ROB-001 and the expected history, and that controls fit and remain usable. Sign out and repeat for DEMO-ROB-002.
4. Record device/browser, expected and observed machine number, continuation and layout results. Capture only sanitized profile evidence. Sign out, close the test tabs and remove USB forwarding.

The hosted run command and fixture account roles are in [the integration handoff](TESTING.md#m1-i-integration). See the [credential incident record](SECURITY.md#synthetic-development-credential-incident) for the source and limits of the remediation evidence.
