# Supabase adapter boundary

Developer A owns the future implementation of `CmmsAdapter` in this directory. The shared interface is in [src/contracts](../../contracts/index.ts). FND-01 has no adapter instance, SDK, mock login, or database connection. Supplying environment variables alone does not enable access.

After approval of the synthetic development project, place its URL and **publishable** key in ignored `.env.local` using the names in [the template](../../../.env.example). Treat browser configuration as public. Keep server secrets outside the frontend workspace. The backend slice must enforce the managed session, active membership, role and machine scope in PostgreSQL policies and sensitive RPCs before exposing any records. Return a sanitized `NOT_FOUND_OR_DENIED` for unavailable or inaccessible assets.
