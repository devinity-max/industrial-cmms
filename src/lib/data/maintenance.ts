import type { LedgerActivity, LedgerObligation, DailyRevision, LedgerReceipt } from '../../contracts';
import { instant, record, uuid } from './responses';

function optionalText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function activity(value: unknown): value is LedgerActivity {
  return record(value) && typeof value.category === 'string' && value.category.trim().length > 0 &&
    optionalText(value.machineCondition) && optionalText(value.observation) && optionalText(value.action);
}

export function receipt(value: unknown): value is LedgerReceipt {
  return record(value) && uuid(value.id) && uuid(value.obligationId) && uuid(value.submittedBy) &&
    value.status === 'submitted' && instant(value.submittedAt) &&
    typeof value.version === 'number' && Number.isSafeInteger(value.version) && value.version > 0;
}

export function revision(value: unknown): value is DailyRevision {
  return record(value) && receipt(value) && Array.isArray(value.activities) &&
    value.activities.length >= 1 && value.activities.length <= 32 && value.activities.every(activity) &&
    (value.version === 1 ? value.reason === null : typeof value.reason === 'string' && value.reason.trim().length > 0);
}

export function obligationReply(value: unknown, query: {
  assetId: string; operationalDate: string; shiftKey?: string;
}): value is { obligation: LedgerObligation | null } {
  if (!record(value)) return false;
  const row = value.obligation;
  if (row === null) return true;
  return record(row) && uuid(row.id) && uuid(row.assetId) && row.assetId === query.assetId.toLowerCase() &&
    row.operationalDate === query.operationalDate && row.shiftKey === (query.shiftKey || null) &&
    (row.dueAt === null || instant(row.dueAt)) &&
    ((row.state === 'open' && row.version === 0 && row.current === null) ||
      (row.state === 'submitted' && revision(row.current) && row.current.obligationId === row.id &&
        row.current.version === row.version));
}
