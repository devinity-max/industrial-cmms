import type { AssetDetail, AssetSummary, CursorPage, HistoryItem } from '../../contracts';

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
export function asset(value: unknown): value is AssetSummary {
  return record(value) && uuid(value.id) && uuid(value.qrToken) && typeof value.machineNumber === 'string' &&
    typeof value.name === 'string' && typeof value.department === 'string' && typeof value.displayStatus === 'string';
}
export function detail(value: unknown): value is AssetDetail {
  return record(value) && asset(value) &&
    record(value.capabilities) && typeof value.capabilities.canManageAsset === 'boolean';
}
export function instant(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(Date.parse(value));
}
export function history(value: unknown): value is HistoryItem {
  return record(value) && uuid(value.id) && uuid(value.assetId) && typeof value.kind === 'string' &&
    instant(value.occurredAt) &&
    typeof value.summary === 'string' && typeof value.actorDisplay === 'string' &&
    typeof value.version === 'number' && Number.isSafeInteger(value.version) && value.version > 0;
}
export function page<T>(value: unknown, limit: number, item: (v: unknown) => v is T): value is CursorPage<T> {
  return record(value) && Array.isArray(value.items) && value.items.length <= limit && value.items.every(item) &&
    (value.nextCursor === null || (typeof value.nextCursor === 'string' &&
      /^[0-9a-f]{64}$/.test(value.nextCursor) && value.items.length === limit));
}
