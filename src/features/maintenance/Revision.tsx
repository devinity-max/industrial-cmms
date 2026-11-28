import { useLayoutEffect } from 'react';
import type { ApiErrorCode, DailyRevision } from '../../contracts';

export type AccessError = 'NOT_FOUND_OR_DENIED' | 'UNAUTHENTICATED';

export function LedgerReadState({ code, retry, onRestricted }: {
  code?: ApiErrorCode; retry: () => void; onRestricted: (code: AccessError) => void;
}) {
  useLayoutEffect(() => {
    if (code === 'NOT_FOUND_OR_DENIED' || code === 'UNAUTHENTICATED') onRestricted(code);
  }, [code, onRestricted]);
  if (!code) return <p role="status">Loading ledger…</p>;
  if (code === 'NOT_FOUND_OR_DENIED' || code === 'UNAUTHENTICATED') return null;
  if (code === 'VALIDATION') return <p role="alert">The ledger lookup is invalid. Check the date and shift.</p>;
  return <div className="ledger-message" role="alert">
    <p>The ledger could not be loaded.</p><button type="button" onClick={retry}>Try again</button>
  </div>;
}

export function LedgerTime({ value }: { value: string }) {
  return <time dateTime={value}>{new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })}</time>;
}

export function RevisionDetails({ revision }: { revision: DailyRevision }) {
  return <article className="ledger-revision" aria-label={`Revision ${revision.version}`}>
    <h3>Revision {revision.version}</h3>
    <dl className="ledger-meta">
      <div><dt>Submitted</dt><dd><LedgerTime value={revision.submittedAt}/></dd></div>
      <div><dt>Author ID</dt><dd>{revision.submittedBy}</dd></div>
      {revision.reason && <div><dt>Correction reason</dt><dd>{revision.reason}</dd></div>}
    </dl>
    <ol className="ledger-activities">{revision.activities.map((entry, index) =>
      <li key={index}><h4>{entry.category}</h4>
        <dl className="ledger-meta">
          <div><dt>Observed machine condition</dt><dd>{entry.machineCondition || '—'}</dd></div>
          <div><dt>Observations</dt><dd>{entry.observation || '—'}</dd></div>
          <div><dt>Work performed</dt><dd>{entry.action || '—'}</dd></div>
        </dl>
      </li>)}</ol>
  </article>;
}
