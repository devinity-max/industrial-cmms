# M2-A daily maintenance ledger

**Review status.** Local proposal for Developer A and Developer B. Developer A authorized M2 development from the M1 QA baseline `5401a886c842c3a85878a2c155f86d11f22e68a0`. T08, T09 and T11 are deferred. M1 final acceptance remains open. [M1 evidence](M1-ACCEPTANCE.md)

## What counts as a daily update

A trusted operator configures an obligation for an asset, a plant-local calendar date and an optional shift. An authorized lookup returns one of three results.

| Result | Meaning for the form |
|---|---|
| Successful result with `null` | No obligation was configured for this asset/date/shift. Display that fact and omit submission controls. |
| `state: 'open'`, version 0, current revision null | An obligation exists and awaits its first submission. |
| `state: 'submitted'`, positive version | The latest committed revision contains the activities for this obligation. A correction creates the next version. |

Completion derives from an explicit ledger submission. An ordinary asset edit or another type of history event has no effect. A submitted update records what the author reported. Equipment operation and safety approval are outside its meaning.

## Developer B handoff

After joint contract review, inject `MaintenanceAdapter` alongside the existing M1 interface. The object returned by the existing `createCmmsAdapter` implements both with one managed session. Use the reviewed types exported from `src/contracts/index.ts`. The earlier `ProvisionalMaintenanceAdapter` remains available for source compatibility. M2-A uses the smaller activity shape below. [Shared ledger types](../src/contracts/maintenance.ts)

| Call | Successful response | Frontend behavior |
|---|---|---|
| `getDailyObligation({assetId, operationalDate, shiftKey?})` | `LedgerObligation \| null` | Use the authorized machine's ID and an explicit YYYY-MM-DD date. Omit shift for the unshifted obligation. Show current revision, version and due time if supplied. |
| `submitDaily({obligationId, expectedVersion, requestId, activities, reason?})` | `LedgerReceipt` with revision ID, obligation ID, new version, submitted status, server timestamp and author UUID | Generate one random UUID per intentional submission. Retain that UUID and exact payload in memory across an uncertain retry by the same identity. Show success only on a matching receipt. Refresh the current obligation and M1 history afterward. |
| `getDailyRevision({obligationId, version})` | `DailyRevision` with receipt fields, full activity snapshot and correction reason | Browse earlier versions of the same obligation using versions 1 through the last observed version. Missing or inaccessible versions give a generic denial. M1 history already shows an event per revision. |

**Proposed form.** Show the machine number and name from the authorized profile. Group the date, configured shift and completion state above a repeatable activity section. Each activity has a category (required free text, up to 64 characters), optional observed machine condition, observations and work performed (wire keys `machineCondition`, `observation`, `action`). Send missing optional activity fields as explicit nulls. Each optional text is limited to 2,000 characters. The prototype accepts 1–32 activities and caps their serialized JSONB representation at 128 KiB. These are technical bounds for the prototype. Multiple activities belong to one submission.

For version 0 omit the reason. For a correction, start from the current full snapshot and require a nonblank reason of up to 1,000 characters. Preserve the operational date and obligation. Render the submitted-by identifier and submission time from the server. The actor display in M1 history is generic. A display-name directory needs separate review.

Only offer write controls when the current machine's `capabilities.canManageAsset` is true and the obligation exists. Display Viewer records read-only. On `CONFLICT`, reload and let the user reconcile before starting a new submission with a new request ID. On `TEMPORARY_FAILURE`, the write outcome can be unknown. Retry the unchanged request or reload before editing. On `VALIDATION`, review the form. On `NOT_FOUND_OR_DENIED` or loss of authentication, clear protected results. Clear draft, retry payload and receipts on logout, expiry and account change. Scope delayed UI results to the current identity, machine and form. A lost response or logout cannot undo a transaction already accepted by PostgreSQL.

## Database design for review

The proposed forward migration follows the two immutable M1 migrations. It introduces two private, RLS-enabled tables and three public RPCs. Submit the entire file in one migration transaction only after separate review and target authorization. [Draft migration](../supabase/migrations/20261128000100_m2_daily_ledger.sql)

- `cmms.daily_obligations` binds a machine to one operational date and shift key. A unique constraint prevents duplicate slots. The empty internal shift key denotes the unshifted slot. A null deadline is valid. Only trusted provisioning can define slots.
- `cmms.daily_revisions` stores one complete activity snapshot per obligation/version with the author's profile UUID, server time, retry key, correction reason and immutable reference to the corresponding M1 history event. Comparing adjacent versions supplies the before/after audit record. The application has no direct write, update or delete privileges on either table.
- `m2_daily_obligation` and `m2_daily_revision` are security-invoker functions. Their reads follow existing active-profile and machine/plant membership policies through the asset. Only an authorized asset lookup may report an unconfigured day.
- `m2_submit_daily` is the elevated write boundary. Its owner must be trusted and able to write the history and revision tables. It has a fixed empty search path, qualified tables, static SQL and restricted execution grants. Because the owner can bypass RLS, the function independently binds `auth.uid()` to an enabled profile and an active admin membership for the exact machine or its owning plant. The asset comes from the stored obligation. It locks the obligation and matched scope records before accessing receipts or changing data.
- Retries are scoped to obligation, authenticated author and request UUID. An identical retry returns its original receipt even after a later correction. Changed contents under that key, or a new request with a stale version, produces a conflict. Concurrent writers serialize on the obligation. PostgreSQL commits the history event and revision together. Completion derives from the latest revision, so it needs no separate mutable flag.

## Decisions still open

| Decision owner | Confirmation needed |
|---|---|
| Client and Developer A | Approved ledger sample and required fields, category/condition vocabulary, start/end times, performer versus submitting author, spare usage, remarks and zero-work days. These fields and rules remain provisional. |
| Client operations | Eligible machines and dates, holidays/outages, shift identifiers, overnight rollover, plant timezone and daily deadline. The prototype accepts explicitly provisioned dates and optional deadlines. Scheduling and overdue classifications await those rules. |
| Developer A and client | Whether an unshifted obligation may coexist with individual shift obligations, which activities are duplicates, and whether corrected entries can move between dates. The prototype prevents duplicate submissions and preserves intentional repeated activities. |
| Client and security owner | Who may correct another author's submission, correction window, approval/sign-off, audit visibility, retention and treatment of mistaken submissions. The synthetic proposal allows any currently scoped admin to correct with a reason. |

## Verification boundary

The offline Vitest cases use the installed Supabase SDK with an intercepted transport. They cover the public types, configured and unconfigured days, receipt and version matching, repeat-request serialization, error handling and stale responses after logout. They do not exercise PostgreSQL.

On 28 November 2026, `npm.cmd run check` exited 0 on native Windows. ESLint and strict TypeScript passed, Vitest passed 26/26 tests across four files, and Vite built 66 modules. The focused command `npm.cmd test -- src/contracts/index.test.ts src/lib/data/supabase.test.ts` passed 20/20 tests across two files.

The prepared rollback-only SQL test uses the existing synthetic identities and two explicit North obligations. It checks application grants, scoped authorization, disabled access, retry after correction, stale versions, validation, preserved snapshots and machine history. It requires a separately approved disposable database with both M1 migrations, its synthetic accounts/fixtures and the reviewed M2 migration. It has not been executed. [Prepared SQL test](../supabase/tests/m2-ledger.sql)

Before acceptance, also exercise two independent sessions submitting the same version concurrently. Verify one persisted revision/event, the matching replay receipt for an identical request by the same author, and a conflict for competing edits. Verify rollback on an injected persistence failure in a disposable target, compare fixture counts afterward and review the function owner, effective grants and Auth/RLS behavior with actual scoped users. Use a reviewed forward migration for recovery after a future apply. Keep historical data intact.
