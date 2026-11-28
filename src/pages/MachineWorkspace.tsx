import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { AuthState, CmmsAdapter, MaintenanceAdapter, Result } from '../contracts';
import { resolveRoute } from '../features/machines/routes';
import { Directory, MachineProfile } from './MachinePages';
import './machines.css';

const unavailable: Result<AuthState> = { ok: false, error: {
  code: 'TEMPORARY_FAILURE', message: 'Unable to verify your session.', requestId: '',
} };
type Props = { adapter: CmmsAdapter & MaintenanceAdapter };

export function MachineWorkspace({ adapter }: Props) {
  const [snapshot, setSnapshot] = useState<Result<AuthState> | null>(null);
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const sequence = useRef(0);
  const boundary = useRef(0);
  const signingOut = useRef(false);
  const lastUser = useRef<string | null>(null);
  const accept = useCallback((value: Result<AuthState> | null) => {
    const next = value?.ok && value.data.status === 'authenticated' ? value.data.session.userId : null;
    if (lastUser.current !== next) boundary.current++;
    lastUser.current = next;
    setSnapshot(value);
  }, []);
  const verify = useCallback(async () => {
    const turn = ++sequence.current;
    accept(null);
    const result = await adapter.getAuthState().catch(() => unavailable);
    if (turn === sequence.current && !signingOut.current && !document.hidden) accept(result);
  }, [adapter, accept]);

  useEffect(() => {
    const unsubscribe = adapter.onAuthStateChange(value => {
      if (signingOut.current || document.hidden) return;
      sequence.current++;
      accept(value);
    });
    const lock = () => { sequence.current++; flushSync(() => accept(null)); };
    const visibility = () => { if (document.hidden) lock(); else void verify(); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) void verify(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', lock);
    window.addEventListener('pageshow', restore);
    return () => {
      sequence.current++;
      unsubscribe();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', lock);
      window.removeEventListener('pageshow', restore);
    };
  }, [adapter, accept, verify]);

  async function logout() {
    signingOut.current = true;
    sequence.current++;
    accept(null);
    setLoggingOut(true);
    setNotice('');
    const result = await adapter.signOut().catch(() => unavailable);
    if (!result.ok) setNotice('Local access is locked. Remote sign-out could not be confirmed.');
    signingOut.current = false;
    setLoggingOut(false);
    accept({ ok: true, data: { status: 'signed_out' } });
  }

  const route = resolveRoute(window.location.pathname);
  const authenticated = snapshot?.ok && snapshot.data.status === 'authenticated';
  return <div className="mc"><div className="mc-bar"><div className="mc-brand">
    <span className="mc-mark" aria-hidden="true"><i/><i/><i/></span>Industrial CMMS</div>
    {authenticated && <><a href="/machines">Directory</a><button onClick={() => void logout()}>Sign out</button></>}
  </div><main className={authenticated ? 'mc-content' : 'mc-access'}>
    {notice && <p role="alert">{notice}</p>}
    {loggingOut || !snapshot ? <p role="status">{loggingOut ? 'Signing out…' : 'Verifying session…'}</p>
      : !snapshot.ok ? <div className="mc-panel"><h1>Session unavailable</h1><p role="alert">Access could not be verified.</p>
      <button onClick={() => void verify()}>Retry verification</button> <button onClick={() => void logout()}>Sign out</button></div>
      : snapshot.data.status !== 'authenticated' ? <Login adapter={adapter} verify={verify}
        expired={snapshot.data.status === 'expired'} deepLink={route.kind === 'machine'} />
      : <div key={boundary.current}>{route.kind === 'directory' ? <Directory adapter={adapter}/>
        : route.kind === 'machine' ? <MachineProfile key={route.token} adapter={adapter} token={route.token} userId={snapshot.data.session.userId}/>
        : <><h1>Page unavailable</h1><a href="/machines">Open machine directory</a></>}</div>}
  </main></div>;
}

function Login({ adapter, verify, expired, deepLink }: Props & { verify: () => Promise<void>; expired: boolean; deepLink: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <div className="mc-panel mc-login"><h1>Sign in</h1>
    <p>{expired ? 'Your session expired. Sign in again.' : deepLink ? 'Sign in to open this machine record.' : 'Access your machine directory and maintenance history.'}</p>
    <form onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setMessage('');
      const data = new FormData(event.currentTarget);
      const result = await adapter.signIn({ identifier: String(data.get('email')).trim(), password: String(data.get('password')) }).catch(() => unavailable);
      if (!mounted.current) return;
      setBusy(false);
      if (result.ok) await verify();
      else if (['TEMPORARY_FAILURE','CONFLICT'].includes(result.error.code)) {
        setMessage('Sign-in could not be verified. Retry session verification or sign in again.');
      }
      else setMessage('Sign-in was unsuccessful. Check your credentials and account access.');
    }}>
      <label>Email address<input name="email" type="email" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {message && <p role="alert">{message}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {message && <button type="button" onClick={() => void verify()}>Verify session</button>}
    </form></div>;
}
