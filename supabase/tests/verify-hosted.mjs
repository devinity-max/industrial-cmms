import assert from 'node:assert/strict';
import { env } from 'node:process';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

// Explicit operator invocation only. No automatic dotenv loading or CI hook.
const ref = env.M1_APPROVED_TEST_REF;
assert.ok(ref && /^[a-z0-9]{20}$/.test(ref), 'Set the approved isolated test reference');
const url = 'https://' + ref + '.supabase.co';
assert.ok(env.M1_TEST_URL === url, 'Approved reference and test URL must match');
const key = env.M1_PUBLISHABLE_KEY;
assert.ok(key?.startsWith('sb_publishable_'), 'A publishable test key is required');

const client = () => createClient(url, key, { auth: {
  persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
} });
const sessions = [];
async function login(label) {
  const c = client();
  const password = env['M1_' + label.toUpperCase() + '_PASSWORD'];
  assert.ok(password, 'Missing isolated fixture credential');
  const result = await c.auth.signInWithPassword({ email: 'm1-' + label + '@example.invalid', password });
  assert.ok(!result.error && result.data.session, 'Fixture login failed');
  sessions.push(c);
  return c;
}
async function value(request) {
  const { error, data } = await request;
  assert.ok(!error && data !== null, 'Expected scoped result');
  return data;
}
async function denied(request, code) {
  const { error, data } = await request;
  assert.ok(data === null, 'Denied request returned a payload');
  assert.equal(error?.code, code);
}
function qr(n) { return '30000000-0000-4000-8000-' + String(n).padStart(12,'0'); }
try {
  const anonymous = client();
  await denied(anonymous.rpc('m1_asset', { token: qr(1) }), '42501');
  const viewer = await login('viewer');
  const admin = await login('admin');
  const machine = await login('machine');
  const south = await login('south');

  const detail = await value(viewer.rpc('m1_asset', { token: qr(1) }));
  assert.equal(detail.capabilities.canManageAsset, false);
  assert.equal((await value(admin.rpc('m1_asset', { token: qr(2) }))).capabilities.canManageAsset, true);
  assert.equal((await value(machine.rpc('m1_asset', { token: qr(1) }))).capabilities.canManageAsset, true);
  await denied(machine.rpc('m1_asset', { token: qr(2) }), '42501');
  await denied(admin.rpc('m1_asset', { token: qr(12) }), '42501');
  await denied(south.rpc('m1_history', { asset: detail.id }), '42501');
  assert.equal((await value(viewer.rpc('m1_history', { asset: detail.id }))).items.length, 1);
  const page = await value(viewer.rpc('m1_assets', { page_size: 10 }));
  assert.equal(page.items.length, 10);
  assert.equal(page.items[0].qrToken, qr(1));
  assert.equal((await value(viewer.rpc('m1_asset', { token: page.items[0].qrToken }))).id, page.items[0].id);
  assert.ok(page.nextCursor);
  const args = { page_size: 10, bookmark: page.nextCursor };
  const last = await value(viewer.rpc('m1_assets', args));
  assert.equal(last.items.length, 1);
  assert.equal(last.nextCursor, null);
  assert.ok(page.items.every(row => row.id < last.items[0].id));
  await denied(viewer.rpc('m1_assets', { page_size: 11 }), '22023');
  await denied(viewer.rpc('m1_assets', { ...args, filter: 'other' }), '22023');
  await denied(viewer.rpc('m1_assets', { ...args, page_size: 25 }), '22023');
  await denied(admin.rpc('m1_assets', args), '22023');
  // A non-existent ID makes this direct REST probe harmless even on a failing configuration.
  await denied(viewer.schema('cmms').from('assets').update({ display_status: 'test' })
    .eq('id','00000000-0000-0000-0000-000000000000'), 'PGRST106');
  const current = await viewer.auth.getSession();
  assert.ok(current.data.session);
  if (env.M1_TEST_DISABLE_VIEWER === '1') {
    assert.ok(stdin.isTTY, 'Requires the operator at an interactive terminal');
    const session = current.data.session;
    // Capture once. These two requests use identical authorization, without SDK refresh.
    const check = () => globalThis.fetch(url + '/rest/v1/rpc/m1_assets', {
      method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + session.access_token,
        'Content-Type': 'application/json' }, body: '{}', cache: 'no-store', redirect: 'error',
    });
    assert.equal((await check()).status, 200);
    const terminal = createInterface({ input: stdin, output: stdout });
    try { await terminal.question('Disable only the approved fixture viewer profile, commit, then press Enter. '); }
    finally { terminal.close(); }
    const response = await check();
    assert.ok(Date.now() < session.expires_at * 1000, 'JWT expired during test; repeat with a fresh login');
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, '42501');
  }
  const revoked = await viewer.auth.signOut({ scope: 'local' });
  assert.ok(!revoked.error, 'Fixture logout failed');
  assert.equal((await viewer.auth.getSession()).data.session, null);
  const renewal = await viewer.auth.refreshSession({ refresh_token: current.data.session.refresh_token });
  assert.ok(renewal.error && [400, 401, 403].includes(renewal.error.status),
    'Expected Auth to reject renewal of the revoked fixture session');
} finally {
  for (const c of sessions) {
    const { error } = await c.auth.signOut({ scope: 'local' });
    assert.ok(!error, 'Could not confirm test session revocation');
  }
}
