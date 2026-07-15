import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { findClientDist, getServerHost } from './runtime.js';

describe('findClientDist', () => {
  it('serves a built client whenever its index exists', () => {
    const projectRoot = join('workspace', 'link-saver');
    const exists = vi.fn((path: string) => path === join(projectRoot, 'dist/client/index.html'));

    expect(findClientDist(projectRoot, exists)).toBe(join(projectRoot, 'dist/client'));
  });

  it('keeps the API-only development server when no client build exists', () => {
    expect(findClientDist('workspace', () => false)).toBeUndefined();
  });
});

describe('getServerHost', () => {
  it('keeps the unauthenticated app on the loopback interface', () => {
    expect(getServerHost()).toBe('127.0.0.1');
  });
});
