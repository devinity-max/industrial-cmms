import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { LedgerActivity, LedgerObligation, MaintenanceAdapter, SubmitLedgerInput } from '../../contracts';
import { useRead } from '../machines/useRead';
import { LedgerReadState, RevisionDetails } from './Revision';
import type { AccessError } from './Revision';

type Props = {
  adapter: MaintenanceAdapter; obligation: LedgerObligation; userId: string;
  onSaved: (version: number) => void; onCancel: () => void; reload: () => void;
  onRestricted: (code: AccessError) => void;
};
const blank: LedgerActivity = { category: '', machineCondition: null, observation: null, action: null };
const notes = [
  ['machineCondition', 'Observed machine condition'], ['observation', 'Observations'], ['action', 'Work performed'],
] as const;
type Stage = 'editing' | 'sending' | 'uncertain' | 'conflict';

export function EntryForm({ adapter, obligation, userId, onSaved, onCancel, onRestricted, reload }: Props) {
  const nextKey = useRef(obligation.current?.activities.length ?? 1);
  const [rows, setRows] = useState(() =>
    (obligation.current?.activities ?? [blank]).map((activity, key) => ({ key, activity })));
  const [reason, setReason] = useState('');
  const [stage, setStage] = useState<Stage>('editing');
  const [validation, setValidation] = useState('');
  const mounted = useRef(false);
  const sending = useRef(false);
  const retryInput = useRef<SubmitLedgerInput | null>(null);
  const correction = obligation.version > 0;

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; retryInput.current = null; };
  }, []);

  function update(key: number, field: keyof LedgerActivity, text: string) {
    setValidation('');
    setRows(previous => previous.map(row => row.key === key
      ? { key, activity: { ...row.activity, [field]: text } } : row));
  }

  async function submit() {
    if (sending.current || stage === 'conflict') return;
    if (rows.some(row => !row.activity.category.trim()) || (correction && !reason.trim())) {
      setValidation('Enter a category for each activity and a reason for any correction.');
      return;
    }
    const input = retryInput.current ?? {
      obligationId: obligation.id, expectedVersion: obligation.version, requestId: crypto.randomUUID(),
      activities: rows.map(({ activity }) => ({
        category: activity.category.trim(), machineCondition: activity.machineCondition?.trim() || null,
        observation: activity.observation?.trim() || null, action: activity.action?.trim() || null,
      })), ...(correction && { reason: reason.trim() }),
    };
    sending.current = true;
    retryInput.current = input;
    setValidation('');
    setStage('sending');
    try {
      const result = await adapter.submitDaily(input);
      if (!mounted.current) return;
      if (result.ok) {
        const receipt = result.data;
        if (receipt.status !== 'submitted' || receipt.obligationId !== input.obligationId ||
            receipt.version !== input.expectedVersion + 1 || receipt.submittedBy !== userId) {
          setStage('uncertain');
          return;
        }
        retryInput.current = null;
        onSaved(receipt.version);
      } else {
        switch (result.error.code) {
          case 'NOT_FOUND_OR_DENIED':
          case 'UNAUTHENTICATED':
            onRestricted(result.error.code);
            break;
          case 'CONFLICT':
            retryInput.current = null;
            setStage('conflict');
            break;
          case 'VALIDATION':
            retryInput.current = null;
            setValidation('The entry was rejected. Check the required fields and lengths, or reduce the total activity text.');
            setStage('editing');
            break;
          case 'TEMPORARY_FAILURE':
            setStage('uncertain');
        }
      }
    } catch {
      if (mounted.current) setStage('uncertain');
    } finally { sending.current = false; }
  }

  return <form className="ledger-editor" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <h3>{correction ? `Correct revision ${obligation.version}` : 'New daily entry'}</h3>
    {rows.map(({ key, activity }, index) => <fieldset className="ledger-activity" key={key} disabled={stage !== 'editing'}>
      <legend>Activity {index + 1}</legend>
      <label>Activity category<input required maxLength={64} value={activity.category}
        onChange={event => update(key, 'category', event.target.value)}/></label>
      {notes.map(([field, label]) => <label key={field}>{label}
        <textarea rows={2} maxLength={2000} value={activity[field] ?? ''}
          onChange={event => update(key, field, event.target.value)}/></label>)}
      {rows.length > 1 && <button type="button" aria-label={`Remove activity ${index + 1}`}
        onClick={() => setRows(previous => previous.filter(row => row.key !== key))}>Remove activity</button>}
    </fieldset>)}
    {stage === 'editing' && <button type="button" disabled={rows.length >= 32} onClick={() => {
      const row = { key: nextKey.current++, activity: blank };
      setRows(previous => [...previous, row]);
    }}>Add activity</button>}
    {correction && <label>Correction reason<textarea required maxLength={1000} rows={2}
      disabled={stage !== 'editing'} value={reason} onChange={event => { setReason(event.target.value); setValidation(''); }}/></label>}
    {validation && <p role="alert">{validation}</p>}
    {stage === 'uncertain' && <p role="alert">Submission could not be confirmed. Retry this exact entry, or discard the draft and reload the ledger.</p>}
    {stage === 'conflict' ? <ConflictReview adapter={adapter} obligation={obligation} reload={reload} onRestricted={onRestricted}/> :
      <div className="ledger-actions">
        <button className="primary" disabled={stage === 'sending'}>
          {stage === 'sending' ? 'Submitting…' : stage === 'uncertain' ? 'Retry same submission' :
            correction ? 'Submit correction' : 'Submit daily entry'}</button>
        <button type="button" disabled={stage === 'sending'} onClick={stage === 'uncertain' ? reload : onCancel}>
          {stage === 'uncertain' ? 'Discard draft and reload' : 'Discard draft'}</button>
      </div>}
  </form>;
}

function ConflictReview({ adapter, obligation, reload, onRestricted }: Pick<Props, 'adapter' | 'obligation' | 'reload' | 'onRestricted'>) {
  const request = useCallback(() => adapter.getDailyObligation({ assetId: obligation.assetId,
    operationalDate: obligation.operationalDate, ...(obligation.shiftKey && { shiftKey: obligation.shiftKey }),
  }), [adapter, obligation]);
  const { result, retry } = useRead(request);
  return <div className="ledger-message">
    <p role="alert">A version or request conflict prevented this submission. Compare your draft above with the latest record.</p>
    {result?.ok ? result.data?.current ? <RevisionDetails revision={result.data.current}/> :
      <p>No submitted revision is available for this date and shift.</p> :
      <LedgerReadState {...(result && { code: result.error.code })} retry={retry} onRestricted={onRestricted}/>}
    <button type="button" onClick={reload}>Discard draft and reopen ledger</button>
  </div>;
}
