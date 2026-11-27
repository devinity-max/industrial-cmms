# Requirements and traceability
Status: planning baseline. IDs below are internal planning IDs. “Demo” means synthetic records, not production authorization. Full supplier scope remains open until agreed in writing.

| ID | Requirement | Evidence | Delivery |
|---|---|---|---|
| R01 | Unique QR per machine number; stable URL; reprint/relocation preserve mapping; individual/batch printable labels | Slides 4–5; latest client messages | Demo individual, pilot batch |
| R02 | Configurable machine master: identity, photo, plant/department/line/location, OEM, serial, technical data, criticality, responsibility, lifecycle, documents | Slide 6 | Demo subset, pilot full |
| R03 | Password-protected Viewer read-only and Admin authorized write; future scoped roles, account management, audit | Slide 11; latest client messages | Demo core, pilot granular |
| R04 | Daily records and JH cleaning/inspection/lubrication checks, machine/shift templates, OK/Not OK/NA, remarks, evidence, abnormality ownership/verification | Slide 8; client daily-update request | Demo ledger sample, pilot JH |
| R05 | PM recurring schedules (daily to yearly), assigned checklists, actual/next dates, evidence/sign-off, rescheduling reason, overdue tracking | Slide 7 | Pilot |
| R06 | Breakdown registration, category, diagnosis/RCA, actions, spares, start/response/restore, verified closure | Slide 9 | Pilot |
| R07 | Consolidated history, PM/JH/breakdown/spares/modifications/Kaizen/documents/abnormalities | Slide 10 | Demo daily history, pilot core, remaining approved scope |
| R08 | Dashboard filters, PM/JH compliance, breakdown count, downtime, MTTR/MTBF, abnormalities, Excel/PDF | Slide 12 | Demo daily status, pilot core, approved analytics later |
| R09 | Secure remote browser access, Android Chrome and modern Chrome/Edge, relational DB, private attachments PDF/XLSX/JPG/PNG, scalability, backups/restore | Slides 13–15 | Demo local, pilot approved cloud |
| R10 | Reminders due/overdue PM, abnormalities, breakdown actions; missing daily record notifications on approved channels | Slide 14; latest client messages | Demo missing daily update with in-app and test email, WhatsApp if approved/required |
| R11 | Audit actor/time/old-new/reason; ownership, full export, retention, no silent permanent deletion, exit/handover | Slides 14–15 | Demo basic audit, pilot full governance |
| R12 | Pilot, tests, training, documentation, migration, support, warranty/SLA/AMC/commercial terms | Slides 16–19 | Before production |

## Demonstration definition (proposed subset, confirm with client)
Two synthetic machine numbers DEMO-ROB-001 and DEMO-ROB-002. Scan genuine generated QR to a reachable controlled development URL; authenticate; resume requested asset after login with validated same-origin redirect. Viewer sees authorized machine profile and history and cannot mutate API/database. Admin creates an entry using a provisional daily ledger form and server persists it with audit data. Both see consistent history. A synthetic daily obligation with a demo deadline allows missing-update detection; in-app alert and test mail appear only for missing eligible submissions. Complete the submission and pending alert resolves. No anonymous asset data. No real messaging or robot operations. Mobile layout and QR tested on physical phone before demo. Localhost QR cannot be scanned from a phone unless the local host is reachable; use company-approved test network/HTTPS staging, never expose a raw dev server or DB publicly.

## Daily ledger provisional fields
Asset, operational date, optional shift (do not require until rule confirmed), start/end datetime, activity/category, observations, action, spare usage, performer, status, remarks, verification status. Based on prior workbook text review of Maintenance Daily Ledger Logbook (reported F-28); field list and form revision must be validated against approved sample. Separate daily submission status from each activity/work order and machine safety/operating state. Multiple activities per day may be needed. Do not equate any edit with required submission. Zero-activity reporting, late entries, holidays and shifts are unresolved. Do not assume L1/L2/L3 approval applies to every record.

## Later workbook formats
The supplied workbook contains maintenance planning, equipment evaluation, breakdown analysis, daily ledger, history, TBM/CBM, VED, root-cause and improvement formats per prior text review. Treat them as candidates for configuration or derived reports; not 28 separate demo modules. Validate approved revisions, ranking boundaries, formulas and audit levels with customer; do not invent or fix business rules. Obtain approved sanitized examples. IoT planning does not authorize OT connectivity.
