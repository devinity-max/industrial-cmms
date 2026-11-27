import { createRoot } from 'react-dom/client';
import type { AuthState, CmmsAdapter, Result } from '../../../contracts';
import { MachineWorkspace } from '../../../pages/MachineWorkspace';
import '../../../styles.css';

if (import.meta.env.MODE !== 'test') throw new Error('Test mode required.');
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const unavailable = (temporary = false): Result<never> => ({ ok: false, error: {
  code: temporary ? 'TEMPORARY_FAILURE' : 'NOT_FOUND_OR_DENIED', message: 'Unavailable', requestId: 'fixture',
} });
const machines = ['Assembly cell','Welding cell','Transfer station','Inspection cell','Handling cell',
  'Finishing cell','Assembly station','Inspection station','Welding station','Transfer cell','Test station'].map((name, i) => ({
  id: 'asset-' + i, qrToken: '30000000-0000-4000-8000-' + String(i + 1).padStart(12,'0'),
  machineNumber: 'DEMO-' + String(i + 1).padStart(3,'0'), name, department: 'Synthetic robotics', displayStatus: 'unknown',
}));
const session = { userId: 'synthetic-viewer' };
function snapshot(): Result<AuthState> {
  return ok(sessionStorage.getItem('fixture') === 'in' ? { status:'authenticated', session }
    : { status: sessionStorage.getItem('fixture') === 'expired' ? 'expired' : 'signed_out' });
}
const change = () => window.dispatchEvent(new Event('fixture-auth'));
const adapter: CmmsAdapter = {
  async getAuthState() { return snapshot(); },
  onAuthStateChange(listener) {
    const publish = () => listener(snapshot());
    publish();
    window.addEventListener('fixture-auth',publish);
    return () => window.removeEventListener('fixture-auth',publish);
  },
  async signIn() { sessionStorage.setItem('fixture','in'); change(); return ok(session); },
  async signOut() { sessionStorage.removeItem('fixture'); change(); return ok(undefined); },
  async listAssets({ filter = '', cursor }) {
    if (filter === 'delayed') await new Promise<void>(resolve => window.addEventListener('fixture-release', () => resolve(), { once:true }));
    if (filter === 'temporary') return unavailable(true);
    const rows = filter === 'delayed' ? machines : machines.filter(m => (m.name + m.machineNumber).toLowerCase().includes(filter.toLowerCase()));
    return ok({ items: cursor ? rows.slice(10) : rows.slice(0,10), nextCursor: !cursor && rows.length > 10 ? 'more' : null });
  },
  async getAssetByQr(token) {
    const row = machines.find(m => m.qrToken === token);
    return row ? ok({ ...row, capabilities: { canManageAsset: false } }) : unavailable();
  },
  async listHistory({ assetId }) {
    if (sessionStorage.getItem('history-denied')) return unavailable();
    return ok({ items: ['Profile reviewed','Machine registered'].map((summary,i) => ({
      id: String(i), assetId, kind:'registration', summary, actorDisplay:'Synthetic team', version:1,
      occurredAt: i ? '2026-11-25T12:00:00Z' : '2026-11-26T12:00:00Z',
    })), nextCursor:null });
  },
};
createRoot(document.getElementById('root')!).render(<MachineWorkspace adapter={adapter}/>);
