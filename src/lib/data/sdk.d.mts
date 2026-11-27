type Session = { access_token: string; user: { id: string } };
type AuthError = { status?: number; code?: string };
type AuthReply = { data: { session: Session | null }; error: AuthError | null };

export function createClient<D extends { public: { Functions: Record<string, { Args: unknown; Returns: unknown }> } }>(
  url: string, key: string, options: {
    auth: { storageKey: string; detectSessionInUrl: boolean; storage: {
      getItem(name: string): string | null;
      setItem(name: string, value: string): void;
      removeItem(name: string): void;
    } };
    global: { fetch: typeof fetch };
  }
): {
  auth: {
    onAuthStateChange(callback: (event: string, session: Session | null) => void): {
      data: { subscription: { unsubscribe(): void } };
    };
    getSession(): Promise<AuthReply>;
    signInWithPassword(input: { email: string; password: string }): Promise<AuthReply>;
    dispose(): Promise<void>;
  };
  rpc<K extends keyof D['public']['Functions']>(name: K, args: D['public']['Functions'][K]['Args']):
    PromiseLike<{ data: D['public']['Functions'][K]['Returns'] | null; error: { code: string } | null; status: number }>;
};
