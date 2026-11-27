# QR-Based Digital Machine Maintenance System — engineering starter kit
Version 1.1 | 27 November 2026 | Internal planning | NOT production-ready

## Start here
FND-01 implements the local application shell and shared adapter contract. Latest client messages supersede the earlier five-machine pilot: demonstrate 1–2 robots, then consider a 3-robot pilot and eventual 150+ machine rollout. Viewer passwords are mandatory; no anonymous robot data. Use browser access, no required installation. Funding is available; minimize lifecycle cost without cutting security or reliability. Two developers use separate ChatGPT Work accounts with limited credits. No agency branding.

1. Both developers read AGENTS.md and docs/REQUIREMENTS.md and agree on A (backend) / B (frontend); Developer A is the user (backend); Developer B is the brother (frontend, subject to agreement).
2. Create one private repository `industrial-cmms` (or company-approved name). Enable MFA on both developer accounts. Commit this kit as the first documentation commit. Never commit the supplied company workbook, deck, photos, credentials or live data unless explicitly authorized.
3. Developer A alone runs prompts/01-foundation.md in a local Windows checkout or approved Work workspace; review and merge its PR before any further implementation.
4. After the foundation merges, both developers pull main and agree on contract in docs/ARCHITECTURE.md. Run prompts/02-backend.md and prompts/03-frontend.md on separate branches. Review each other's PRs; run tests on merged code. Then run prompts/04-integration.md once.
5. Record evidence in docs/TESTING.md and decisions in docs/DECISIONS.md. Do not move onto later features until this slice works. See docs/ROADMAP.md for remaining slices.

## Documentation map
- AGENTS.md — binding working rules for AI coding sessions and human developers.
- docs/REQUIREMENTS.md — traceable scope and acceptance boundaries.
- docs/ARCHITECTURE.md — proposed stack, conceptual schema and API contract v0.1.
- docs/SECURITY.md — security and data governance controls.
- docs/ROADMAP.md — milestones, ownership and go/no-go conditions.
- docs/TESTING.md — executable-test specifications and evidence template.
- docs/DECISIONS.md — decisions, unresolved requirements and cost approvals.
- prompts/ — four staged tasks; do not execute all at once.

## Sources and limitations
Supplier presentation, version 1.0 dated 26 November 2026, slides 2–19; eight reference screenshots; client messages on 26–27 November; PM Pillar Standard Formats.xls (legacy workbook, previously text-reviewed; not fully revalidated for formulas, hidden sheets or visual layout in this package). Workbook field mappings remain provisional and require approved samples; no internal source documents are redistributed here. Foundation test evidence is in [docs/TESTING.md](docs/TESTING.md). The proposed architecture is subject to company IT approval, independent security review, and customer workflow sign-off.

## Run the M1 workspace on Windows

Use native Node.js **22.23.5** and npm **10.9.9**. In a fresh checkout run `npm.cmd ci` once. In the ignored `.env.local`, set `VITE_SUPABASE_URL` to `https://fgawjraoekdnhdbqqrvm.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY` to that project's browser publishable key. Keep passwords and privileged keys out of Vite configuration. Missing or invalid settings display **Workspace unavailable**. Restart Vite or rebuild after changing configuration.

```powershell
node --version
npm.cmd --version
npm.cmd run check
npm.cmd run dev
```

Open **http://127.0.0.1:5173/machines** or a synthetic machine's **/m/:qrToken** path. Enter the provisioned account's password directly in the browser. A fresh session starts at sign-in and resumes the local machine path after verification. Stop with Ctrl+C. If the port is occupied, use `npm.cmd run dev -- --port 5174`.

`npm.cmd run check` runs lint, TypeScript, the unit test and the Vite build in sequence. To check the built assets, run `npm.cmd run preview` after the build and open **http://127.0.0.1:4173/**. Generated assets live in ignored `dist/`.

The [M1 integration evidence](docs/TESTING.md#m1-i-integration) includes the interactive browser acceptance procedure and physical Android test plan.

## Windows cloud-development setup (v1.1)
Use Node.js LTS, npm, Git and a private repository. Docker Desktop, WSL and local PostgreSQL are not required on developer PCs. Create a separate synthetic-only Supabase development project manually after approving its plan and region; no real company data. FND-01 does not need access to any hosted project. Developer A alone applies reviewed versioned migrations to the verified development target after explicit approval. Developer B uses scoped synthetic app accounts or explicit test fixtures, not administrative credentials. Keep staging and production separate; add them only with approval. See docs/ARCHITECTURE.md for workflow and official references.
