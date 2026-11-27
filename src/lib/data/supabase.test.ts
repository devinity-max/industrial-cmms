import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCmmsAdapter } from './supabase';

const url = 'https://synthetic.supabase.co';
const key = 'sb_publishable_synthetic';
const userId = '00000000-0000-4000-8000-000000000001';
let adapter: ReturnType<typeof createCmmsAdapter>;
let failLogout: boolean;
let failVerify: boolean;
let rpcStarted: (() => void) | undefined;
let completeRead: (() => void) | undefined;
let account: string;
let intercept: ((path: string) => Response | Promise<Response> | undefined) | undefined;
const json = (value: unknown, status = 200) => Response.json(value, { status });

beforeEach(() => {
  const memory = new Map<string,string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string,v: string) => memory.set(k,v),
    removeItem: (k: string) => memory.delete(k),
  });
  vi.stubGlobal('window', new EventTarget());
  failLogout = false;
  failVerify = false;
  rpcStarted = undefined;
  completeRead = undefined;
  account = userId;
  intercept = undefined;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const path = String(input);
    const override = intercept?.(path);
    if (override) return override;
    if (path.includes('grant_type=refresh_token')) {
      return json({ code: 'refresh_token_not_found', message: 'Invalid refresh token' }, 400);
    }
    if (path.includes('/auth/v1/token')) {
      const exp = Math.floor(Date.now()/1000) + 3600;
      const jwt = [btoa('{"alg":"HS256"}'), btoa(JSON.stringify({ sub: account, exp })), 'test'].join('.');
      return json({ access_token: jwt, refresh_token: crypto.randomUUID(), expires_in: 3600,
        token_type: 'bearer', user: { id: account } });
    }
    if (path.endsWith('/rpc/m1_user')) return failVerify ? json({}, 400) : json(account);
    if (path.endsWith('/rpc/m1_assets')) {
      rpcStarted?.();
      await new Promise<void>(resolve => { completeRead = resolve; });
      return json({ items: [], nextCursor: null });
    }
    if (path.includes('/logout?scope=local')) return json({}, failLogout ? 503 : 200);
    throw new Error('Unexpected test request');
  });
  adapter = createCmmsAdapter(url,key);
});

afterEach(() => { adapter.dispose(); vi.unstubAllGlobals(); });

it('reports expiry after the provider rejects renewal of a previously used session', async () => {
  expect((await adapter.signIn({ identifier: 'm1-viewer@example.invalid', password: crypto.randomUUID() })).ok).toBe(true);
  adapter.dispose();
  const prefix = 'cmms:' + url;
  const slot = prefix + ':' + localStorage.getItem(prefix + ':epoch') + ':session';
  const expired = JSON.parse(localStorage.getItem(slot)!);
  expired.expires_at = 1;
  localStorage.setItem(slot, JSON.stringify(expired));
  adapter = createCmmsAdapter(url,key);
  expect(await adapter.getAuthState()).toEqual({ ok: true, data: { status: 'expired' } });
});

it('verifies a restored session and publishes a signed-out snapshot on logout', async () => {
  expect(await adapter.getAuthState()).toEqual({ ok: true, data: { status: 'signed_out' } });
  expect(await adapter.signIn({ identifier: 'm1-viewer@example.invalid', password: crypto.randomUUID() }))
    .toEqual({ ok: true, data: { userId } });
  adapter.dispose();
  adapter = createCmmsAdapter(url,key);
  const listener = vi.fn();
  const unsubscribe = adapter.onAuthStateChange(listener);
  await vi.waitFor(() => expect(listener).toHaveBeenCalledWith({
    ok: true, data: { status: 'authenticated', session: { userId } },
  }));
  failVerify = true;
  expect(await adapter.getAuthState()).toMatchObject({ ok: false, error: { code: 'TEMPORARY_FAILURE' } });
  expect((await adapter.signOut()).ok).toBe(true);
  expect(listener).toHaveBeenCalledWith({ ok: true, data: { status: 'signed_out' } });
  unsubscribe();
});

it('discards an outstanding page and clears local credentials even if revocation is uncertain', async () => {
  expect((await adapter.signIn({ identifier: 'm1-viewer@example.invalid', password: crypto.randomUUID() })).ok).toBe(true);
  const started = new Promise<void>(resolve => { rpcStarted = resolve; });
  const page = adapter.listAssets({});
  await started;
  failLogout = true;
  expect(await adapter.signOut()).toMatchObject({ ok: false, error: { code: 'TEMPORARY_FAILURE' } });
  expect(await adapter.getAuthState()).toEqual({ ok: true, data: { status: 'signed_out' } });
  account = crypto.randomUUID();
  expect(await adapter.signIn(login())).toEqual({ ok: true, data: { userId: account } });
  completeRead?.();
  expect(await page).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  expect(await adapter.getAuthState()).toEqual({ ok: true, data: { status: 'authenticated', session: { userId: account } } });
});

it('locks a subscribed second client when a logout epoch reaches its tab', async () => {
  expect((await adapter.signIn({ identifier: 'm1-viewer@example.invalid', password: crypto.randomUUID() })).ok).toBe(true);
  const otherTab = createCmmsAdapter(url, key);
  try {
    const listener = vi.fn();
    otherTab.onAuthStateChange(listener);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith({
      ok: true, data: { status: 'authenticated', session: { userId } },
    }));
    expect((await adapter.signOut()).ok).toBe(true);
    window.dispatchEvent(Object.assign(new Event('storage'), { key: 'cmms:' + url + ':epoch' }));
    expect(listener).toHaveBeenLastCalledWith({ ok: true, data: { status: 'signed_out' } });
  } finally { otherTab.dispose(); }
});

const login = () => ({ identifier: 'm1-viewer@example.invalid', password: crypto.randomUUID() });

it.each([false, true])('releases a denied profile for another login (revocation failure %s)', async uncertain => {
  failLogout = uncertain;
  intercept = path => path.endsWith('/m1_user') ? json({ code: '42501' }, 403) : undefined;
  expect(await adapter.signIn(login())).toMatchObject({ ok: false, error: {
    code: uncertain ? 'TEMPORARY_FAILURE' : 'NOT_FOUND_OR_DENIED',
  } });
  expect(await adapter.getAuthState()).toEqual({ ok: true, data: { status: 'signed_out' } });
  account = crypto.randomUUID();
  intercept = undefined;
  expect(await adapter.signIn(login())).toEqual({ ok: true, data: { userId: account } });
});

it('locks reads on temporary login verification failure and permits retry', async () => {
  failVerify = true;
  expect(await adapter.signIn(login())).toMatchObject({ ok: false, error: { code: 'TEMPORARY_FAILURE' } });
  expect(await adapter.listAssets({})).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  failVerify = false;
  expect(await adapter.getAuthState()).toMatchObject({ ok: true, data: { session: { userId } } });
});

it.each([false, true])('rejects delayed login verification after logout (replacement identity %s)', async replace => {
  let release!: (value: Response) => void;
  let entered!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  intercept = path => {
    if (path.endsWith('/m1_user')) {
      entered();
      return new Promise<Response>(resolve => { release = resolve; });
    }
  };
  const pending = adapter.signIn(login());
  expect(await adapter.signIn(login())).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
  await waiting;
  intercept = undefined;
  const other = createCmmsAdapter(url, key);
  try {
    expect((await other.signOut()).ok).toBe(true);
    if (replace) {
      account = crypto.randomUUID();
      expect(await other.signIn(login())).toEqual({ ok: true, data: { userId: account } });
    }
    release(json(userId));
    expect(await pending).toMatchObject({ ok: false });
    expect(await adapter.getAuthState()).toEqual({ ok: true, data: replace
      ? { status: 'authenticated', session: { userId: account } } : { status: 'signed_out' } });
  } finally { other.dispose(); }
});

it('rejects malformed and mismatched RPC identities', async () => {
  intercept = path => path.endsWith('/m1_user') ? json({ secret: 'synthetic' }) : undefined;
  expect(await adapter.signIn(login())).toMatchObject({ ok: false, error: { code: 'TEMPORARY_FAILURE' } });
  intercept = path => path.endsWith('/m1_user') ? json(crypto.randomUUID()) : undefined;
  expect(await adapter.getAuthState()).toMatchObject({ ok: false, error: { code: 'TEMPORARY_FAILURE' } });
});

it('validates directory, detail, history and continuation payloads before exposing them', async () => {
  expect((await adapter.signIn(login())).ok).toBe(true);
  const summary = { id: userId, machineNumber: 'T', name: 'Test', department: 'Test', displayStatus: 'unknown' };
  const qrToken = crypto.randomUUID();
  let payload: unknown = { items: [{ ...summary, qrToken }], nextCursor: null };
  intercept = path => path.includes('/rpc/') ? json(payload) : undefined;
  expect((await adapter.listAssets({})).ok).toBe(true);
  payload = { items: [summary], nextCursor: null };
  expect(await adapter.listAssets({})).toMatchObject({ ok: false, error: { code: 'TEMPORARY_FAILURE' } });
  payload = { ...summary, qrToken, capabilities: { canManageAsset: 'false' } };
  expect((await adapter.getAssetByQr(qrToken)).ok).toBe(false);
  payload = { items: [], nextCursor: 123 };
  expect((await adapter.listHistory({ assetId: userId })).ok).toBe(false);
  payload = { items: [{ id: userId }], nextCursor: null };
  expect((await adapter.listHistory({ assetId: userId })).ok).toBe(false);
});
