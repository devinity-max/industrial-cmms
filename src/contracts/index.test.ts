import { expectTypeOf, it } from 'vitest';
import type { AssetListQuery, CmmsAdapter, MaintenanceAdapter, ProvisionalMaintenanceAdapter, SessionInfo, SubmitLedgerInput } from './index';

it('keeps credentials and later maintenance operations outside the M1 contract', () => {
  expectTypeOf<keyof SessionInfo>().toEqualTypeOf<'userId'>();
  expectTypeOf<Extract<keyof CmmsAdapter, keyof ProvisionalMaintenanceAdapter>>().toBeNever();
  expectTypeOf<AssetListQuery['pageSize']>().toEqualTypeOf<10 | 25 | 50 | undefined>();
});

it('keeps the M2 write contract independent from auth claims and the M1 surface', () => {
  expectTypeOf<keyof SubmitLedgerInput>().toEqualTypeOf<'obligationId' | 'expectedVersion' | 'requestId' | 'activities' | 'reason'>();
  expectTypeOf<keyof MaintenanceAdapter>().toEqualTypeOf<'getDailyObligation' | 'getDailyRevision' | 'submitDaily'>();
  expectTypeOf<Extract<keyof CmmsAdapter, keyof MaintenanceAdapter>>().toBeNever();
});
