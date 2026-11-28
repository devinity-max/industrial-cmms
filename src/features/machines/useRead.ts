import { useEffect, useState } from 'react';
import type { Result } from '../../contracts';

export function useRead<T>(request: () => Promise<Result<T>>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  useEffect(() => {
    let active = true;
    void request().then(value => { if (active) setResult(value); }).catch(() => {
      if (active) setResult({ ok: false, error: { code: 'TEMPORARY_FAILURE', message: 'Connection unavailable.', requestId: '' } });
    });
    return () => { active = false; };
  }, [request, attempt]);
  return { result, retry: () => { setResult(null); setAttempt(n => n + 1); } };
}
