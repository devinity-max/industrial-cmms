/* global URL */
// Loopback browser test only. The installed SDK makes its normal HTTP calls;
// every request to the project origin is intercepted before network access.
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';

export async function interceptProject(context, project, qr) {
  const identities = new Map();
  const asset = n => ({
    id:'20000000-0000-4000-8000-' + String(n).padStart(12,'0'),
    qrToken:qr(n), machineNumber:'DEMO-ROB-00' + n, name:'Synthetic robot ' + n,
    department:'Synthetic maintenance', displayStatus:'unknown',
  });
  await context.route(project + '/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (value,status = 200) => route.fulfill({json:value,status});
    const body = request.postDataJSON() ?? {};
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        return json({ code:'refresh_token_not_found',message:'Expired synthetic session' },400);
      }
      const machine = body.email === 'm1-machine@example.invalid';
      const id = machine ? '00000000-0000-4000-8000-000000000002' : '00000000-0000-4000-8000-000000000001';
      const exp = Math.floor(Date.now()/1000) + 3600;
      const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
      const token = encode({alg:'HS256'}) + '.' + encode({sub:id,exp}) + '.test';
      identities.set('Bearer ' + token,{id,machine});
      return json({ access_token:token, refresh_token:randomUUID(), expires_in:3600, token_type:'bearer', user:{id} });
    }
    if (url.pathname === '/auth/v1/logout') return json({});
    const identity = identities.get(request.headers().authorization);
    if (!identity) return json({code:'42501'},401);
    switch (url.pathname) {
      case '/rest/v1/rpc/m1_user': return json(identity.id);
      case '/rest/v1/rpc/m1_assets': return json({items:identity.machine ? [asset(1)] : [asset(1),asset(2)],nextCursor:null});
      case '/rest/v1/rpc/m1_asset': {
        const row = [asset(1),asset(2)].find(a => a.qrToken === body.token);
        return row && (!identity.machine || row.qrToken === qr(1))
          ? json({...row,capabilities:{canManageAsset:identity.machine}}) : json({code:'42501'},403);
      }
      case '/rest/v1/rpc/m1_history': return json({ items:[2,1].map(day => ({
        id:qr(day), assetId:body.asset, kind:'registered', summary:'Synthetic entry ' + day,
        occurredAt:'2026-11-0' + day + 'T00:00:00Z', actorDisplay:'Synthetic setup', version:1,
      })), nextCursor:null });
      default: return route.abort();
    }
  });
}
