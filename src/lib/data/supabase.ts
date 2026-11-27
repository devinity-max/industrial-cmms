import { createClient } from './sdk.mjs';
import type { ApiErrorCode, AssetDetail, AssetSummary, AuthState, CmmsAdapter, CursorPage, HistoryItem, Result } from '../../contracts';

type Rpc<Args, Returns> = { Args: Args; Returns: Returns };
type Database = { public: {
  Tables: Record<never, never>;
  Views: Record<never, never>;
  Functions: {
    m1_user: Rpc<Record<never, never>, string>;
    m1_asset: Rpc<{ token: string }, AssetDetail>;
    m1_assets: Rpc<{ page_size: number; filter: string; bookmark: string | null }, CursorPage<AssetSummary>>;
    m1_history: Rpc<{ asset: string; bookmark: string | null }, CursorPage<HistoryItem>>;
  };
} };

function ok<T>(data: T): Result<T> { return { ok: true, data }; }
function failure(code: ApiErrorCode): Result<never> {
  const messages = {
    UNAUTHENTICATED: 'Sign in to continue.', NOT_FOUND_OR_DENIED: 'Record unavailable.',
    VALIDATION: 'Invalid request.', TEMPORARY_FAILURE: 'Unable to verify. Try again.',
    CONFLICT: 'Record has changed.',
  };
  return { ok: false, error: { code, message: messages[code], requestId: crypto.randomUUID() } };
}

const signedOut = (): Result<AuthState> => ok({ status: 'signed_out' });
type Listener = (state: Result<AuthState>) => void;

export function createCmmsAdapter(url: string, key: string): CmmsAdapter & { dispose(): void } {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !/^sb_publishable_[\w-]+$/.test(key)) {
    throw new Error('Invalid hosted development configuration.');
  }
  const prefix = 'cmms:' + url;
  const epochKey = prefix + ':epoch';
  const currentEpoch = () => localStorage.getItem(epochKey) ?? 'initial';
  const listeners = new Set<Listener>();
  let generation = 0;
  let disposed = false;

  function connect(epoch: string) {
    const storageKey = prefix + ':' + epoch + ':session';
    const client = createClient<Database>(url, key, {
      auth: { storageKey, detectSessionInUrl: false, storage: {
        getItem: name => epoch === currentEpoch() ? localStorage.getItem(name) : null,
        setItem: (name, value) => { if (epoch === currentEpoch()) localStorage.setItem(name, value); },
        removeItem: name => localStorage.removeItem(name),
      } },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
    const subscription = client.auth.onAuthStateChange((event) => {
      // Leave the GoTrue notification callback before invoking another auth method.
      if (event === 'SIGNED_OUT' && epoch === currentEpoch()) {
        generation++;
        emit(ok({ status: 'expired' }));
      }
      setTimeout(() => { if (isCurrent(epoch)) void notifyVerified(); }, 0);
    }).data.subscription;
    return { epoch, client, storageKey, subscription };
  }
  let connection = connect(currentEpoch());
  function isCurrent(epoch: string) {
    return !disposed && epoch === currentEpoch() && epoch === connection.epoch;
  }
  function emit(value: Result<AuthState>) { for (const listener of listeners) listener(value); }
  function disconnect() {
    connection.subscription.unsubscribe();
    void connection.client.auth.dispose();
  }
  function sync() {
    if (!disposed && connection.epoch !== currentEpoch()) {
      disconnect();
      generation++;
      connection = connect(currentEpoch());
      emit(signedOut());
    }
  }
  function rotate() {
    const previous = connection.storageKey;
    localStorage.setItem(epochKey, crypto.randomUUID());
    localStorage.removeItem(previous);
    localStorage.removeItem(previous + ':used');
    localStorage.removeItem(previous + ':pending');
    sync();
  }
  function storageChanged(event: StorageEvent) {
    if (event.key === epochKey || event.key === null) sync();
  }
  window.addEventListener('storage', storageChanged);

  async function revoke(token: string): Promise<Result<void>> {
    try {
      const response = await fetch(url + '/auth/v1/logout?scope=local', {
        method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + token },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      return response.ok ? ok(undefined) : failure('TEMPORARY_FAILURE');
    } catch { return failure('TEMPORARY_FAILURE'); }
  }

  type Reply<T> = { data: T | null; error: { code: string } | null; status: number };
  async function read<T>(request: (client: typeof connection.client) => PromiseLike<Reply<T>>): Promise<Result<T>> {
    sync();
    const { epoch, client } = connection;
    const revision = generation;
    try {
      if (!isCurrent(epoch)) return failure('UNAUTHENTICATED');
      const { data, error, status } = await request(client);
      if (!isCurrent(epoch) || revision !== generation) return failure('UNAUTHENTICATED');
      if (!error && data !== null) return ok(data);
      if (status === 401) return failure('UNAUTHENTICATED');
      if (error?.code === '42501') return failure('NOT_FOUND_OR_DENIED');
      if (error?.code === '22023' || error?.code === '22P02') return failure('VALIDATION');
      return failure('TEMPORARY_FAILURE');
    } catch { return failure('TEMPORARY_FAILURE'); }
  }
  async function getAuthState(): Promise<Result<AuthState>> {
    sync();
    const { client, epoch, storageKey } = connection;
    try {
      const { data, error } = await client.auth.getSession();
      if (!isCurrent(epoch)) return signedOut();
      if (error && (!error.status || error.status >= 500 || error.status === 429)) return failure('TEMPORARY_FAILURE');
      if (error || !data.session) {
        return ok({ status: localStorage.getItem(storageKey + ':used') ? 'expired' : 'signed_out' });
      }
      const user = await read(c => c.rpc('m1_user', {}));
      if (!user.ok) return user;
      return ok({ status: 'authenticated', session: { userId: user.data } });
    } catch { return failure('TEMPORARY_FAILURE'); }
  }
  let notification = 0;
  async function notifyVerified(target?: Listener) {
    const ticket = target ? notification : ++notification;
    const epoch = connection.epoch;
    const revision = generation;
    const state = await getAuthState();
    if (ticket !== notification || !isCurrent(epoch) || revision !== generation) return;
    if (!target) emit(state);
    else if (listeners.has(target)) target(state);
  }

  return {
    getAuthState,
    onAuthStateChange(listener) {
      listeners.add(listener);
      void notifyVerified(listener);
      return () => { listeners.delete(listener); };
    },
    async signIn({ identifier, password }) {
      sync();
      if (localStorage.getItem(connection.storageKey)) return failure('CONFLICT');
      rotate();
      const { client, epoch, storageKey } = connection;
      localStorage.setItem(storageKey + ':pending', '1');
      try {
        const { data, error } = await client.auth.signInWithPassword({ email: identifier, password });
        if (!isCurrent(epoch)) {
          if (data.session) await revoke(data.session.access_token);
          return failure('UNAUTHENTICATED');
        }
        if (error) return failure(error.code === 'invalid_credentials' ? 'UNAUTHENTICATED' : 'TEMPORARY_FAILURE');
        localStorage.setItem(storageKey + ':used', '1');
        const state = await getAuthState();
        if (!state.ok) return state;
        return state.data.status === 'authenticated' ? ok(state.data.session) : failure('UNAUTHENTICATED');
      } catch { return failure('TEMPORARY_FAILURE'); }
      finally { localStorage.removeItem(storageKey + ':pending'); }
    },
    async signOut() {
      sync();
      // Capture only for the revocation request. Fence pending SDK writes before awaiting I/O.
      const stored = localStorage.getItem(connection.storageKey);
      const pending = localStorage.getItem(connection.storageKey + ':pending');
      rotate();
      if (!stored) return pending ? failure('TEMPORARY_FAILURE') : ok(undefined);
      try {
        const token: unknown = JSON.parse(stored).access_token;
        if (typeof token !== 'string') return failure('TEMPORARY_FAILURE');
        return await revoke(token);
      } catch { return failure('TEMPORARY_FAILURE'); }
    },
    listAssets: ({ cursor, filter, pageSize }) => read(c => c.rpc('m1_assets', {
      page_size: pageSize ?? 25, filter: filter ?? '', bookmark: cursor ?? null,
    })),
    getAssetByQr: token => read(c => c.rpc('m1_asset', { token })),
    listHistory: ({ assetId, cursor }) => read(c => c.rpc('m1_history', { asset: assetId, bookmark: cursor ?? null })),
    dispose() {
      disposed = true;
      disconnect();
      listeners.clear();
      window.removeEventListener('storage', storageChanged);
    },
  };
}
