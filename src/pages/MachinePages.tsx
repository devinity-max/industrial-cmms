import { useCallback, useEffect, useState } from 'react';
import type { CmmsAdapter, MaintenanceAdapter } from '../contracts';
import { useRead } from '../features/machines/useRead';
import { DailyLedger } from '../features/maintenance/DailyLedger';

function ReadMessage({ code, retry }: { code?: string; retry: () => void }) {
  if (!code) return <p role="status">Loading records…</p>;
  if (code === 'NOT_FOUND_OR_DENIED') return <p role="alert">This machine record is unavailable for your account.</p>;
  if (code === 'UNAUTHENTICATED') return <p role="alert">Your session needs verification. <a href={location.pathname}>Sign in again</a></p>;
  return <div role="alert"><p>Unable to load these records.</p><button onClick={retry}>Try again</button></div>;
}

function usePages() {
  const [cursors, setCursors] = useState<string[]>([]);
  return {
    cursor: cursors.at(-1), number: cursors.length + 1,
    previous: () => setCursors(old => old.slice(0, -1)),
    next: (cursor: string) => setCursors(old => [...old, cursor]),
  };
}
function Pager({ pages, next }: { pages: ReturnType<typeof usePages>; next: string | null }) {
  return <nav className="mc-pager" aria-label="Record pages"><span>Page {pages.number}</span>
    <button disabled={pages.number === 1} onClick={pages.previous}>Previous</button>
    <button disabled={!next} onClick={() => next && pages.next(next)}>Next</button></nav>;
}

export function Directory({ adapter }: { adapter: CmmsAdapter }) {
  const [filter, setFilter] = useState('');
  return <><h1>Machine directory</h1><div className="mc-panel">
    <form className="mc-search" onSubmit={event => {
      event.preventDefault();
      setFilter(String(new FormData(event.currentTarget).get('search') ?? '').trim());
    }}>
      <label htmlFor="machine-search">Find a machine</label>
      <div><input id="machine-search" name="search" type="search" maxLength={128} placeholder="Machine number or name" />
      <button className="primary">Search</button></div>
    </form><DirectoryResults key={filter} filter={filter} adapter={adapter} />
  </div></>;
}
function DirectoryResults({ filter, adapter }: { filter: string; adapter: CmmsAdapter }) {
  const pages = usePages();
  return <AssetRows key={pages.cursor ?? ''} pages={pages} filter={filter} adapter={adapter} />;
}
function AssetRows({ filter, adapter, pages }: { filter: string; adapter: CmmsAdapter; pages: ReturnType<typeof usePages> }) {
  const cursor = pages.cursor;
  const request = useCallback(() => adapter.listAssets({ filter, pageSize: 10, ...(cursor && { cursor }) }), [adapter, cursor, filter]);
  const { result, retry } = useRead(request);
  if (!result?.ok) return <ReadMessage {...(result && { code: result.error.code })} retry={retry} />;
  return <>{result.data.items.length ? <ul className="mc-list">{result.data.items.map(row =>
    <li key={row.id}><a className="mc-row" href={'/m/' + encodeURIComponent(row.qrToken)}>
      <span className="mc-tile" aria-hidden="true">▦</span>
      <span><small>{row.machineNumber}</small><strong>{row.name}</strong></span>
      <span className="mc-dept">{row.department}</span><span aria-hidden="true">→</span>
    </a></li>)}</ul> : <p role="status">{filter ? 'No machines match your search.' : 'No machines are assigned to your account.'}</p>}
    <Pager pages={pages} next={result.data.nextCursor} /></>;
}

export function MachineProfile({ token, adapter, userId }: {
  token: string; adapter: CmmsAdapter & MaintenanceAdapter; userId: string;
}) {
  const [profileError, setProfileError] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const request = useCallback(() => adapter.getAssetByQr(token), [adapter, token]);
  const { result, retry } = useRead(request);
  if (profileError) return <ReadMessage code={profileError} retry={() => { setProfileError(null); retry(); }} />;
  if (!result?.ok) return <ReadMessage {...(result && { code: result.error.code })} retry={retry} />;
  const machine = result.data;
  return <><a href="/machines">← Machine directory</a><h1>{machine.name}</h1>
    <div className="mc-details">{[
      ['Machine number', machine.machineNumber], ['Department', machine.department],
      ['Recorded status', machine.displayStatus === 'unknown' ? 'Unknown' : machine.displayStatus],
      ['Your access', machine.capabilities.canManageAsset ? 'Machine admin' : 'View only'],
    ].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    <DailyLedger key={machine.id} adapter={adapter} machine={machine} userId={userId}
      onRestricted={setProfileError} onSaved={() => setHistoryRefresh(n => n + 1)} />
    <div className="mc-panel"><h2>Machine history</h2><History key={historyRefresh} adapter={adapter} assetId={machine.id} onFailure={setProfileError} /></div></>;
}
type HistoryProps = { adapter: CmmsAdapter; assetId: string; onFailure: (code: string) => void };
function History(props: HistoryProps) {
  const pages = usePages();
  return <HistoryPage key={pages.cursor ?? ''} {...props} pages={pages} />;
}
function HistoryPage({ adapter, assetId, pages, onFailure }: HistoryProps & { pages: ReturnType<typeof usePages> }) {
  const cursor = pages.cursor;
  const request = useCallback(() => adapter.listHistory({ assetId, ...(cursor && { cursor }) }), [adapter, assetId, cursor]);
  const { result, retry } = useRead(request);
  useEffect(() => { if (result && !result.ok) onFailure(result.error.code); }, [result, onFailure]);
  if (!result?.ok) return <ReadMessage {...(result && { code: result.error.code })} retry={retry} />;
  return <>{result.data.items.length ? <ol className="mc-history">{result.data.items.map(item =>
    <li key={item.id}><time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'})}</time>
    <strong>{item.summary}</strong><span>{item.actorDisplay}</span></li>)}</ol> : <p>No history has been recorded.</p>}
    <Pager pages={pages} next={result.data.nextCursor} /></>;
}
