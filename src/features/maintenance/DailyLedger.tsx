import { useCallback, useState } from 'react';
import type { AssetDetail, LedgerObligation, MaintenanceAdapter } from '../../contracts';
import { useRead } from '../machines/useRead';
import { EntryForm } from './EntryForm';
import { LedgerReadState, LedgerTime, RevisionDetails } from './Revision';
import type { AccessError } from './Revision';
import './ledger.css';

type Query = { operationalDate: string; shiftKey?: string };
type Props = {
  adapter: MaintenanceAdapter; machine: AssetDetail; userId: string;
  onSaved: () => void; onRestricted: (code: AccessError) => void;
};

export function DailyLedger(props: Props) {
  const [query, setQuery] = useState<Query | null>(null);
  const [date, setDate] = useState('');
  const [shift, setShift] = useState('');
  return <section className="mc-panel ledger" aria-labelledby="daily-ledger-title">
    <h2 id="daily-ledger-title">Daily maintenance ledger</h2>
    {query ? <LedgerDay {...props} query={query} changeDay={() => setQuery(null)}/> :
      <form className="ledger-lookup" onSubmit={event => {
        event.preventDefault();
        const shiftKey = shift.trim();
        setQuery({ operationalDate: date, ...(shiftKey && { shiftKey }) });
      }}>
        <label>Operational date<input type="date" required max="9999-12-31" value={date} onChange={e => setDate(e.target.value)}/></label>
        <label>Shift key (optional)<input maxLength={64} value={shift} onChange={e => setShift(e.target.value)}
          aria-describedby="ledger-shift-help"/></label>
        <button className="primary">Open ledger</button>
        <small id="ledger-shift-help">Enter the configured shift key, or leave blank for an unshifted entry.</small>
      </form>}
  </section>;
}

function LedgerDay({ query, changeDay, ...props }: Props & { query: Query; changeDay: () => void }) {
  const { adapter, machine, onRestricted } = props;
  const request = useCallback(() => adapter.getDailyObligation({ assetId: machine.id, ...query }), [adapter, machine.id, query]);
  const { result, retry } = useRead(request);
  const [editing, setEditing] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  function reload() {
    setEditing(false);
    retry();
  }
  return <>
    <div className="ledger-context">
      <div><strong>{machine.machineNumber} · {machine.name}</strong>
        <span><time dateTime={query.operationalDate}>{query.operationalDate}</time> · {query.shiftKey ? 'Shift ' + query.shiftKey : 'Unshifted'}</span></div>
      {!editing && <button type="button" onClick={changeDay}>Change date or shift</button>}
    </div>
    {savedVersion !== null && <p className="ledger-saved" role="status">Revision {savedVersion} saved.</p>}
    {!result?.ok ? <LedgerReadState {...(result && { code: result.error.code })} retry={retry} onRestricted={onRestricted}/> :
      result.data === null ? <p role="status">No daily update is configured for this date and shift.</p> :
      <div className="ledger-day">
        <div className="ledger-state"><strong>{result.data.state === 'open' ? 'Open · awaiting submission' : 'Completed · submitted'}</strong>
          {result.data.dueAt && <span>Due <LedgerTime value={result.data.dueAt}/></span>}</div>
        {editing && machine.capabilities.canManageAsset ?
          <EntryForm key={result.data.id} adapter={adapter} obligation={result.data} userId={props.userId}
            onRestricted={onRestricted} onCancel={() => setEditing(false)} reload={reload}
            onSaved={version => { setSavedVersion(version); reload(); props.onSaved(); }}/> :
          <LedgerRecord key={result.data.id + '/' + result.data.version} adapter={adapter} obligation={result.data}
            onRestricted={onRestricted} canManage={machine.capabilities.canManageAsset}
            edit={() => { setSavedVersion(null); setEditing(true); }}/>}
      </div>}
  </>;
}

function LedgerRecord({ adapter, obligation, onRestricted, canManage, edit }: {
  adapter: MaintenanceAdapter; obligation: LedgerObligation; onRestricted: Props['onRestricted'];
  canManage: boolean; edit: () => void;
}) {
  const [version, setVersion] = useState(obligation.version);
  const latest = version === obligation.version;
  return <>
    {obligation.current && <>
      {latest ? <RevisionDetails revision={obligation.current}/> :
        <EarlierRevision key={version} adapter={adapter} obligationId={obligation.id} version={version} onRestricted={onRestricted}/>}
      {obligation.version > 1 && <nav className="ledger-actions" aria-label="Ledger revisions">
        <button disabled={version <= 1} onClick={() => setVersion(version - 1)}>Previous revision</button>
        <span aria-live="polite">{version} of {obligation.version}</span>
        <button disabled={latest} onClick={() => setVersion(version + 1)}>Next revision</button>
      </nav>}
    </>}
    {canManage && latest && <button className="primary" onClick={edit}>
      {obligation.current ? 'Correct latest revision' : 'Add daily entry'}</button>}
  </>;
}

function EarlierRevision({ adapter, obligationId, version, onRestricted }: {
  adapter: MaintenanceAdapter; obligationId: string; version: number; onRestricted: Props['onRestricted'];
}) {
  const request = useCallback(() => adapter.getDailyRevision({ obligationId, version }), [adapter, obligationId, version]);
  const { result, retry } = useRead(request);
  return result?.ok ? <RevisionDetails revision={result.data}/> :
    <LedgerReadState {...(result && { code: result.error.code })} retry={retry} onRestricted={onRestricted}/>;
}
