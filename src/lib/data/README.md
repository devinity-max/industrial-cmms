# M1 frontend handoff

At integration, create one browser adapter per application with `createCmmsAdapter(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)` from `supabase.ts`, passing the two configuration values. Use the approved standard HTTPS project origin without a trailing slash and a browser publishable key. Dispose the adapter when tearing down the app. The M1-A branch leaves the mount point to the integration owner.

Subscribe before rendering protected routes. Keep content locked until an authenticated snapshot arrives. Restoration verifies the current subject and enabled profile using the database. On signed-out, expired, error or identity change, clear protected state, cached capabilities and unresolved navigation results. On back/forward cache restoration and tab resume reverify before showing old content. Bind every frontend async result to the current identity and request generation. Keep machine data in memory only. A failed scoped read must remove previously displayed data. Use only the returned asset's capability for its UI. Sign out before switching accounts.

The SDK owns password exchange, session persistence and renewal. Local storage contains the SDK session under a project- and login-specific key. Treat same-origin script execution as credential access. Data requests use no-store. A new login epoch invalidates old completions and other tabs observe the change. Sign-out locks locally first and asks Auth to revoke the current refresh session. A failed revocation returns TEMPORARY_FAILURE and leaves local access locked. Access JWTs already issued can survive refresh revocation until expiry. Disable the profile for immediate database denial.

The pinned SDK's WebAuthn declarations conflict with TypeScript 6 DOM declarations. The narrow sdk.mjs / sdk.d.mts boundary describes only the SDK calls consumed here. Strict checks remain enabled. Recheck the boundary and real-SDK tests when upgrading. Offline tests use the installed SDK with intercepted HTTP. Hosted checks are described in [the migration runbook](../../../supabase/migrations/README.md).

## M1-A local verification, 27 November 2026

Windows checkout from main baseline 36ffa8f. Developer A approved the pinned MIT SDK 2.119.2. The first typecheck failed on the vendor WebAuthn DOM declarations and Node globals. After isolating the SDK import, `npm.cmd ci --offline` passed, `npm.cmd run check` passed lint, strict typecheck, six tests and the shell build, and `npm.cmd audit` reported zero known vulnerabilities. The SDK and its new transitive packages declare MIT or 0BSD licenses. `node --check supabase/tests/verify-hosted.mjs` verified runner syntax. The adapter also bundled independently with Vite (46 modules, in memory). No local PostgreSQL executable was found and no hosted target was authorized. Migrations, real JWT/RLS enforcement, fixture setup, and the hosted runner await Developer A's SQL review and target approval.

## M1-A.1 integration changes

Both developers approved the required qrToken on AssetSummary. Pass the selected authorized row's qrToken to getAssetByQr. AssetDetail inherits the field. Each lookup still requires an active profile and current machine or plant membership. History pages are newest first by occurredAt, then descending UUID for ties.

A definitive profile denial clears the rejected login locally and attempts provider revocation. A new account can sign in immediately. A temporary verification failure locks reads. Retry getAuthState or call signOut before switching accounts. An uncertain revocation returns TEMPORARY_FAILURE. Restoration compares the SDK session user with the validated m1_user UUID. Login completion checks the initiating epoch and account again before returning success.

Reviewed the narrow SDK declaration against installed auth-js 2.119.2 password login, getSession, subscription/unsubscribe and async dispose methods. PostgREST data crosses this boundary as unknown. Identity, directory, detail and history responses must pass runtime checks before being returned.
