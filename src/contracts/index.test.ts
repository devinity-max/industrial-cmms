import { expectTypeOf, it } from 'vitest';
import type { AssetListQuery, CmmsAdapter, ProvisionalMaintenanceAdapter, SessionInfo } from './index';

it('keeps credentials and later maintenance operations outside the M1 contract', () => {
  expectTypeOf<keyof SessionInfo>().toEqualTypeOf<'userId'>();
  expectTypeOf<Extract<keyof CmmsAdapter, keyof ProvisionalMaintenanceAdapter>>().toBeNever();
  expectTypeOf<AssetListQuery['pageSize']>().toEqualTypeOf<10 | 25 | 50 | undefined>();
});
