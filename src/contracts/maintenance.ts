import type { ActivityInput, DailyObligation, Result, SubmissionReceipt, SubmitDailyInput } from './index';

/** M2-A contract proposal. Existing M1 and provisional planning types remain available. */
export interface LedgerActivity extends Pick<ActivityInput, 'category' | 'observation' | 'action'> {
  machineCondition: string | null;
}

export interface SubmitLedgerInput extends Omit<SubmitDailyInput, 'activities'> {
  activities: readonly LedgerActivity[];
}

/** id identifies the immutable revision and its machine-history event. */
export interface LedgerReceipt extends SubmissionReceipt {
  obligationId: string;
  status: 'submitted';
  submittedBy: string;
}

export interface DailyRevision extends LedgerReceipt {
  activities: readonly LedgerActivity[];
  reason: string | null;
}

export interface LedgerObligation extends Omit<DailyObligation, 'dueAt' | 'state'> {
  shiftKey: string | null;
  dueAt: string | null;
  state: 'open' | 'submitted';
  current: DailyRevision | null;
}

export interface MaintenanceAdapter {
  getDailyObligation(input: {
    assetId: string; operationalDate: string; shiftKey?: string;
  }): Promise<Result<LedgerObligation | null>>;
  getDailyRevision(input: { obligationId: string; version: number }): Promise<Result<DailyRevision>>;
  submitDaily(input: SubmitLedgerInput): Promise<Result<LedgerReceipt>>;
}
