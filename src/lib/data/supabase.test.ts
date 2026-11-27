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
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.includes('grant_type=refresh_token')) {
      return json({ code: 'refresh_token_not_found', message: 'Invalid refresh token' }, 400);
    }
    if (path.includes('/auth/v1/token')) {
      const exp = Math.floor(Date.now()/1000) + 3600;
      const jwt = [btoa('{"alg":"HS256"}'), btoa(JSON.stringify({ sub: userId, exp })), 'test'].join('.');
      return json({ access_token: jwt, refresh_token: crypto.randomUUID(), expires_in: 3600,
        token_type: 'bearer', user: { id: userId } });
    }
    if (path.endsWith('/rpc/m1_user')) return failVerify ? json({}, 400) : json(userId);
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
  completeRead?.();
  expect(await page).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  expect(await adapter.getAuthState()).toEqual({ ok: true, data: { status: 'signed_out' } });
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
