# Decisions and cost register

## Confirmed client decisions
- 26 Nov: 150+ machines eventually; robotic cell only initially, three machines with daily read/update.
- 27 Nov: begin with 1–2 machines for demonstration; machine-number QR; Viewer also password protected, privacy maintained; missing daily update reminder via notification, WhatsApp or email.
- User: browser access without mandatory installation; two developers with separate Work accounts; funded by uncle, minimize cost subject to security and reliability; neutral branding.

## Provisional engineering decisions
P01 React/TS/Vite + managed Supabase/PostgreSQL development backend; no local Docker/WSL; P02 one private repository, trunk + feature branches; P03 demo individual provisioned accounts; P04 use stable opaque QR mapping and display actual machine number on label; P05 demo one daily obligation per machine/date and test-only reminders; P06 in-app + simulated email first, WhatsApp optional until client clarifies requirement; P07 local browser first, no PWA dependency; P08 user owns backend, brother provisionally owns frontend. These are proposals, not customer approval. Review before coding relevant parts.

## Foundation implementation decisions

FND-01 records the requested React/TypeScript/Vite stack and native Windows setup. React and React DOM are the only direct runtime packages. The shell uses Vite's built-in JSX support. TypeScript stays on the 6.0 line supported by the selected ESLint integration. Supabase integration is a shared type contract until the backend slice. A and B's review of the [contract](ARCHITECTURE.md#m1-contract-for-developer-review) is pending.

## Open questions (blocking only dependent work)

| ID | Decision/input | Blocks |
|---|---|---|
| Q01 | Machine numbers, approved master data/photos, ID uniqueness plant-wide or company-wide | real profiles/labels |
| Q02 | Filled daily ledger/JH/PM samples, exact required fields, zero-work days | real forms |
| Q03 | Daily update means ledger, JH, or both; cutoff, shifts, holidays, downtime exemption, late correction | real reminders |
| Q04 | Recipients, escalation, email vs WhatsApp mandatory for demo, opt-in | real notifications |
| Q05 | Individual vs temporary guest Viewer accounts; scopes and provisioning/reset | production account policy |
| Q06 | L1/L2/L3 approvals and who may submit/verify/approve | verification |
| Q07 | PM recurrence, overdue/reschedule, MTTR/MTBF and downtime formulas; workbook scoring ambiguities | final reports |
| Q08 | IT hosting region, cloud/on-prem, security policy, data retention/export, authorized use of AI, network connectivity | real data/staging/production |
| Q09 | User/concurrency counts, attachment volumes, retention, RPO/RTO, SLA/support | sizing and budget |
| Q10 | Brand/logo and permanent company domain | client branding/permanent QR |
| Q11 | Commercial scope, ownership, deliverables, maintenance responsibilities, security review funding | production contract |
| Q12 | Approved workbook revision and hidden formats relevance | configuration and calculations |

## Cost approach
Target no additional spend for foundation and synthetic development, subject to approved hosted free-tier availability and quotas; no paid upgrades without approval. No final INR budget without sizing or quotations. Compare company infrastructure first, then managed hosting. Track one-time domain/setup/labels/review and recurring database, frontend hosting, storage/egress, backups, monitoring, email/WhatsApp, private repo protection, support, taxes and currency. Free plans may have limits, pause policies or missing recovery features; not automatically fit for production. Paid private repository protection may be required: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches . Avoid buying infrastructure before IT approval. Review cost per month and year, limits and exit costs. WhatsApp only approved official provider with verified current pricing; no unofficial automation. Keep separate dev and prod environments.

Cost approval template: item / purpose / alternative / quoted amount & currency / taxes / billing frequency / usage assumptions / safety impact / owner / approval date. No quote obtained or spending authorized by this kit.
