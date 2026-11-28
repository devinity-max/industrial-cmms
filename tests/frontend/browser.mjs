/* global URL, document, window, sessionStorage, Event, console */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { env, argv } from 'node:process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'vite';

// Optional existing browser tooling supplied by the developer; no package installation.
const { chromium } = createRequire(import.meta.url)(env.CMMS_PLAYWRIGHT || 'playwright');
const bundle = await build({ configFile:false, envDir:false, mode:'test', define:{ 'process.env.NODE_ENV':JSON.stringify('production') }, build:{
  write:false, lib:{ entry:'src/features/machines/__tests__/browser-entry.tsx', formats:['es'], fileName:'fixture' },
}});
const files = new Map((Array.isArray(bundle) ? bundle[0] : bundle).output.map(file => ['/' + file.fileName,file]));
const js = [...files.keys()].find(name => name.endsWith('.js'));
const css = [...files.keys()].find(name => name.endsWith('.css'));
const server = createServer((req,res) => {
  const file = files.get(req.url);
  if (file) {
    res.setHeader('Content-Type',file.type === 'chunk' ? 'text/javascript' : 'text/css');
    res.end(file.code ?? file.source);
  } else {
    res.setHeader('Content-Type','text/html');
    res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+css+'"><div id="root"></div><script type="module" src="'+js+'"></script>');
  }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({channel:'msedge'});
  for (const width of [1280,390]) {
    const page = await browser.newPage({ viewport:{width,height:850} });
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', err => { errors.push(err.message); console.error(err.message); });
    const token = '30000000-0000-4000-8000-000000000001';
    await page.goto(origin + '/m/' + token + '?return=https://example.invalid');
    const visible = text => page.getByText(text,{exact:true}).first().waitFor();
    await visible('Sign in to open this machine record.');
    await page.getByLabel('Email address').fill('viewer@example.invalid');
    await page.getByLabel('Password').fill('synthetic-fixture-input');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await visible('Assembly cell');
    await visible('View only');
    await visible('Machine registered');
    assert.deepEqual(await page.locator('.mc-history strong').allTextContents(),['Profile reviewed','Machine registered']);
    assert.equal(new URL(page.url()).origin,origin);
    if (argv[2]) {
      await mkdir(argv[2],{recursive:true});
      await page.screenshot({path:join(argv[2],width + '-profile.png')});
    }
    await page.getByRole('link',{name:'Directory',exact:true}).click();
    await visible('Assembly cell');
    await page.getByRole('button',{name:'Next'}).click();
    await visible('Test station');
    await page.getByRole('button',{name:'Previous'}).click();
    await visible('Assembly cell');
    const search = async term => {
      await page.getByLabel('Find a machine').fill(term);
      await page.getByRole('button',{name:'Search'}).click();
    };
    await search('cell');
    await visible('Assembly cell');
    if (argv[2]) await page.screenshot({path:join(argv[2],width + '-directory.png')});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await search('unmatched');
    await visible('No machines match your search.');
    await search('temporary');
    await visible('Unable to load these records.');
    await search('delayed');
    await visible('Loading records…');
    await search('Assembly cell');
    await visible('Assembly cell');
    await page.evaluate(async () => {
      window.dispatchEvent(new Event('fixture-release'));
      await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    });
    assert.equal(await page.locator('.mc-row').count(),1);
    await page.getByRole('link',{name:/Assembly cell/}).click();
    await visible('View only');
    assert.ok(page.url().endsWith('/m/'+token));
    await page.evaluate(() => {sessionStorage.setItem('fixture','expired');window.dispatchEvent(new Event('fixture-auth'));});
    await visible('Your session expired. Sign in again.');
    assert.equal(await page.getByText('Assembly cell',{exact:true}).count(),0);
    await page.evaluate(() => sessionStorage.setItem('fixture','in'));
    await page.goto(origin + '/m/30000000-0000-4000-8000-999999999999');
    await visible('This machine record is unavailable for your account.');
    await page.getByRole('button',{name:'Sign out'}).click();
    await visible('Sign in to open this machine record.');
    await page.evaluate(() => sessionStorage.setItem('history-denied','1'));
    await page.evaluate(() => sessionStorage.setItem('fixture','in'));
    await page.goto(origin + '/m/' + token);
    await visible('This machine record is unavailable for your account.');
    assert.equal(await page.getByRole('heading',{name:'Assembly cell'}).count(),0);
    assert.deepEqual(errors,[]);
    await page.close();
    console.log('PASS Edge fixture flow at width',width);
  }
} finally {
  await browser?.close();
  server.close();
}
