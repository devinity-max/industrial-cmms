import { describe, expect, it } from 'vitest';
import { resolveRoute } from './routes';

describe('machine navigation', () => {
  it('accepts a directory or one UUID locator', () => {
    const token = '30000000-0000-4000-8000-000000000001';
    expect(resolveRoute('/m/' + token)).toEqual({ kind: 'machine', token });
    expect(resolveRoute('/machines').kind).toBe('directory');
  });
  it.each(['//external.invalid','/m/https://external.invalid','/m/%2F%2Fevil','/unknown'])('rejects %s', path => {
    expect(resolveRoute(path).kind).toBe('missing');
  });
});
