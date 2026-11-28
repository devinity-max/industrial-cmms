/** First-slice wire types. The adapter returns server-authorized data only. */
export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND_OR_DENIED'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'TEMPORARY_FAILURE';

export interface ApiError {
  code: ApiErrorCode;
  /** Safe to display. Raw provider errors stay outside the UI. */
  message: string;
  requestId: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Public projection of a managed session. The auth adapter owns its tokens. */
export interface SessionInfo {
  userId: string;
}

export type AuthState =
  | { status: 'authenticated'; session: SessionInfo }
  | { status: 'signed_out' }
  | { status: 'expired' };

export interface AssetListQuery {
  cursor?: string;
  filter?: string;
  pageSize?: 10 | 25 | 50;
}

export interface AssetSummary {
  id: string;
  qrToken: string;
  machineNumber: string;
  name: string;
  department: string;
  /** The adapter returns "unknown" when no status is recorded. */
  displayStatus: string;
}

export interface AssetDetail extends AssetSummary {
  /** Effective server decision for this asset. UI guidance only. */
  capabilities: { canManageAsset: boolean };
}

export interface HistoryItem {
  id: string;
  assetId: string;
  kind: string;
  occurredAt: string;
  summary: string;
  actorDisplay: string;
  version: number;
}

export interface DailyObligation {
  id: string;
  assetId: string;
  /** Plant-local calendar date (YYYY-MM-DD). */
  operationalDate: string;
  dueAt: string;
  state: string;
  version: number;
}

export interface ActivityInput {
  /** ISO 8601 instants describing the work, independent of audit timestamps. */
  startedAt: string | null;
  endedAt: string | null;
  category: string;
  activity: string;
  observation: string | null;
  action: string | null;
  spareText: string | null;
  workStatus: string;
  remarks: string | null;
}

export interface SubmitDailyInput {
  obligationId: string;
  expectedVersion: number;
  /** Reuse for retries of the same logical submission. */
  requestId: string;
  activities: readonly ActivityInput[];
  /** Required by the server when revising an existing submission. */
  reason?: string;
}

export interface SubmissionReceipt {
  id: string;
  version: number;
  status: string;
  submittedAt: string;
}

export interface NotificationSummary {
  id: string;
  obligationId: string;
  summary: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CursorPage<T> {
  items: readonly T[];
  nextCursor: string | null;
}

export interface CmmsAdapter {
  signIn(input: { identifier: string; password: string }): Promise<Result<SessionInfo>>;
  getAuthState(): Promise<Result<AuthState>>;
  onAuthStateChange(listener: (state: Result<AuthState>) => void): () => void;
  signOut(): Promise<Result<void>>;
  listAssets(input: AssetListQuery): Promise<Result<CursorPage<AssetSummary>>>;
  getAssetByQr(qrToken: string): Promise<Result<AssetDetail>>;
  listHistory(input: { assetId: string; cursor?: string }): Promise<Result<CursorPage<HistoryItem>>>;
}

/** Provisional M2/M3 operations. Outside the M1 implementation contract. */
export interface ProvisionalMaintenanceAdapter {
  getDailyObligation(input: {
    assetId: string;
    operationalDate: string;
  }): Promise<Result<DailyObligation | null>>;
  submitDaily(input: SubmitDailyInput): Promise<Result<SubmissionReceipt>>;
  listAlerts(input: { cursor?: string }): Promise<Result<CursorPage<NotificationSummary>>>;
}

export type { MaintenanceAdapter, LedgerObligation, LedgerActivity, SubmitLedgerInput, LedgerReceipt, DailyRevision } from './maintenance';
