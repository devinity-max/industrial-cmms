const machinePath = /^\/m\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?$/i;

export function resolveRoute(path: string) {
  if (path === '/' || path === '/machines') return { kind: 'directory' } as const;
  const token = machinePath.exec(path)?.[1];
  return token ? { kind: 'machine', token } as const : { kind: 'missing' } as const;
}
