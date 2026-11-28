/* global URL, console, window, PageTransitionEvent */
import { setTimeout } from 'node:timers';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { argv, env } from 'node:process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer, preview } from 'vite';
import { interceptProject } from './transport.mjs';
import { verifyDeactivation } from '../../supabase/tests/same-jwt.mjs';

const { chromium } = createRequire(import.meta.url)(env.CMMS_PLAYWRIGHT || 'playwright');
const live = argv.includes('--hosted');
const sameJwt = argv.includes('--same-jwt');
assert.ok(!sameJwt || live, '--same-jwt requires --hosted');
const invalid = argv.includes('--invalid-config') || argv.includes('--missing-config');
const project = 'https://fgawjraoekdnhdbqqrvm.supabase.co';
const qr = n => '30000000-0000-4000-8000-' + String(n).padStart(12, '0');
if (!live) {
  env.VITE_SUPABASE_URL = argv.includes('--missing-config') ? '' : project;
  env.VITE_SUPABASE_PUBLISHABLE_KEY = invalid ? 'invalid-fixture' : 'sb_publishable_offline_fixture';
}
const address = { host:'127.0.0.1', port:5184, strictPort:true };
const built = argv.includes('--preview');
const server = built ? await preview({preview:address, logLevel:'error'}) :
  await createServer({server:address, logLevel:'error'});
let browser;
let tab;
try {
  if (!built) await server.listen();
  const origin = 'http://127.0.0.1:5184';
  browser = await chromium.launch({ channel:'msedge', headless:!live });
  const context = await browser.newContext({ serviceWorkers:'block' });
  if (!live) await interceptProject(context,project,qr);
  tab = await context.newPage();
  if (sameJwt) {
    // Freeze only the directory read inside this document. Credentials, storage,
    // Auth request bodies and request headers are never inspected by the runner.
    await tab.addInitScript(endpoint => {
      const send = window.fetch.bind(window);
      let fixed;
      window.fetch = (input, init) => {
        if (!fixed && (input.url ?? String(input)) === endpoint && init?.method === 'POST') {
          fixed = new window.Request(input, { ...init, cache:'no-store', redirect:'error' });
        }
        return send(input, init);
      };
      window.repeatViewerRead = async () => {
        if (!fixed) throw new Error('No directory read is available');
        const response = await send(fixed.clone());
        const data = await response.json();
        return { status:response.status, hasRows:data.items?.[0]?.machineNumber === 'DEMO-ROB-001',
          code:data.code === '42501' ? '42501' : undefined };
      };
    }, project + '/rest/v1/rpc/m1_assets');
    await tab.goto(origin + '/machines');
    await tab.getByLabel('Email address').fill('m1-viewer@example.invalid');
    console.log('Enter the replacement Viewer password in Edge and select Sign in.');
    await tab.getByText('DEMO-ROB-001',{exact:true}).waitFor({timeout:180000});
    await verifyDeactivation(() => tab.evaluate(() => window.repeatViewerRead()));
  } else if (invalid) {
    await tab.goto(origin + '/machines');
    await tab.getByRole('heading',{name:'Workspace unavailable'}).waitFor();
    assert.equal(await tab.locator('input,.mc-row').count(),0);
    console.log('PASS invalid configuration locks workspace');
  } else {
    const second = await context.newPage();
    const login = page => page.getByRole('heading',{name:'Sign in',exact:true});
    const record = page => page.getByRole('heading',{name:'Synthetic robot 1',exact:true});
    const denied = page => page.getByText('This machine record is unavailable for your account.',{exact:true});
    const screenshot = async (page,name) => {
      if (!env.CMMS_SCREENSHOTS) return;
      await mkdir(env.CMMS_SCREENSHOTS,{recursive:true});
      await page.screenshot({ path:join(env.CMMS_SCREENSHOTS,name + '.png') });
    };
    for (const path of ['/machines','/m/' + qr(1)]) {
      await tab.goto(origin + path);
      await login(tab).waitFor();
      await tab.reload();
      await login(tab).waitFor();
      assert.equal(await tab.locator('.mc-details,.mc-row').count(),0);
    }
    await screenshot(tab,'integrated-login-desktop');
    await tab.setViewportSize({width:390,height:850});
    await screenshot(tab,'integrated-login-mobile');
    console.log('PASS integrated signed-out direct paths and refresh');
    // Passwords are entered in Edge. Never inspect login request bodies or stored sessions.
    const logout = async () => {
      await tab.getByRole('button',{name:'Sign out'}).click();
      await login(tab).waitFor();
      assert.equal(await tab.getByText('Local access is locked. Remote sign-out could not be confirmed.').count(),0);
    };
    const signIn = async (label, expected) => {
      await tab.bringToFront();
      await tab.getByLabel('Email address').fill('m1-' + label + '@example.invalid');
      if (live) console.log('Enter the synthetic ' + label + ' password in Edge and select Sign in.');
      else {
        await tab.getByLabel('Password').fill('offline-fixture-input');
        await tab.getByRole('button',{name:'Sign in',exact:true}).click();
      }
      await expected.waitFor({timeout:live ? 180000 : 10000});
    };
    await second.goto(origin + '/machines');
    await login(second).waitFor();
    await signIn('viewer',record(tab));
    assert.equal(new URL(tab.url()).pathname,'/m/' + qr(1));
    await tab.reload();
    await record(tab).waitFor();
    await tab.locator('.mc-history time').first().waitFor();
    const times = await tab.locator('.mc-history time').evaluateAll(nodes => nodes.map(n => Date.parse(n.dateTime)));
    assert.ok(times.every(Number.isFinite));
    assert.deepEqual(times,[...times].sort((a,b) => b-a));
    if (live) console.log('PASS T03 QR continuation and reload; T02 profile loaded with', times.length, 'dated history entries in newest-first order');
    if (!live) await screenshot(tab,'integrated-fixture-profile-mobile');
    await second.bringToFront();
    await second.locator('.mc-row').first().waitFor();
    if (!live) await screenshot(second,'integrated-fixture-directory-desktop');
    await second.reload();
    await second.locator('.mc-row').first().waitFor();
    if (live) {
      const numbers = second.locator('.mc-row small');
      assert.deepEqual(await numbers.allTextContents(), ['DEMO-ROB-001','DEMO-ROB-002',
        ...Array.from({length:8}, (_, i) => 'TEST-' + (i + 3))]);
      await second.getByRole('button',{name:'Next'}).click();
      await second.getByText('TEST-11',{exact:true}).waitFor();
      assert.deepEqual(await numbers.allTextContents(), ['TEST-11']);
      assert.ok(await second.getByRole('button',{name:'Next'}).isDisabled());
      console.log('PASS T01 North directory returned the expected 10 + 1 machines');
    }
    await second.goto(origin + '/m/' + qr(12));
    await denied(second).waitFor();

    // Hold delivery inside the browser, after its normal fetch (including test interception).
    let started, release;
    const held = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    await second.exposeFunction('holdDirectoryResponse',async () => { started(); await gate; });
    await second.addInitScript(() => {
      const send = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await send(...args);
        if (response.ok && response.url.endsWith('/rest/v1/rpc/m1_assets')) await window.holdDirectoryResponse();
        return response;
      };
    });
    await second.goto(origin + '/machines');
    try {
      await Promise.race([held, new Promise((_,reject) => {
        const timer = setTimeout(() => reject(new Error('Directory read did not start')),15000);
        timer.unref();
      })]);
      await tab.bringToFront();
      await logout();
      await second.bringToFront();
      await login(second).waitFor();
    } finally { release(); }
    await second.evaluate(() => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))));
    assert.equal(await second.locator('.mc-row').count(),0);
    await second.goBack();
    await login(second).waitFor();
    assert.equal(await second.locator('.mc-details').count(),0);
    if (live) console.log('PASS T06 logout cleared both tabs after delayed read and Back');
    await signIn('machine',record(tab));
    await tab.getByText('Machine admin',{exact:true}).waitFor();
    await tab.goto(origin + '/m/' + qr(2));
    await denied(tab).waitFor();
    await second.bringToFront();
    await denied(second).waitFor();
    await tab.bringToFront();
    await logout();
    console.log('PASS QR, directory, history, scoped denials, two-tab account switch and back navigation',live ? '(hosted)' : '(intercepted HTTP)');
    if (live) {
      await tab.goto(origin + '/machines');
      await signIn('south',tab.getByText('TEST-12',{exact:true}));
      assert.deepEqual(await tab.locator('.mc-row small').allTextContents(), ['TEST-12']);
      assert.ok(await tab.getByRole('button',{name:'Next'}).isDisabled());
      await tab.locator('.mc-row').click();
      await tab.getByText('View only',{exact:true}).waitFor();
      assert.equal(new URL(tab.url()).pathname,'/m/' + qr(12));
      await tab.goto(origin + '/machines');
      await tab.getByLabel('Find a machine').fill('DEMO-ROB');
      await tab.getByRole('button',{name:'Search',exact:true}).click();
      await tab.getByText('No machines match your search.',{exact:true}).waitFor();
      assert.ok(await tab.getByRole('button',{name:'Next'}).isDisabled());
      for (const north of [1,2]) {
        await tab.goto(origin + '/m/' + qr(north));
        await denied(tab).waitFor();
        assert.equal(await tab.locator('.mc-details,.mc-history,.mc-row').count(),0);
      }
      await logout();
      console.log('PASS T05 South directory, South profile, empty North search and both North QR denials');
    }
    if (!live) {
      await tab.goto(origin + '/m/' + qr(1));
      await signIn('viewer',record(tab));
      await tab.clock.setFixedTime(new Date(Date.now() + 7200000));
      await tab.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
      await tab.getByText('Your session expired. Sign in again.',{exact:true}).waitFor();
      assert.equal(await tab.locator('.mc-details').count(),0);
      console.log('PASS restoration after expiry and rejected renewal (intercepted HTTP)');
    }
  }
} finally {
  try {
    if (live && tab && !tab.isClosed()) {
      await tab.bringToFront();
      const signOut = tab.getByRole('button',{name:'Sign out'});
      const signedOut = tab.getByRole('heading',{name:'Sign in',exact:true});
      await signOut.or(signedOut).first().waitFor({timeout:15000});
      if (await signOut.isVisible()) {
        await signOut.click();
        await signedOut.waitFor();
      }
      assert.equal(await tab.getByText('Local access is locked. Remote sign-out could not be confirmed.').count(),0,
        'Remote session cleanup needs operator verification');
    }
  } finally {
    try { await browser?.close(); }
    finally { await server.close(); }
  }
}
