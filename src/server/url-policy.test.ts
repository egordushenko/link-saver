import { describe, expect, it, vi } from 'vitest';

import {
  assertPublicDestination,
  isDisallowedAddress,
  normalizeHttpUrl,
} from './url-policy.js';

describe('normalizeHttpUrl', () => {
  it('trims a URL and removes its fragment', () => {
    expect(normalizeHttpUrl('  HTTPS://Example.COM:443/articles?q=1#intro  ').toString()).toBe(
      'https://example.com/articles?q=1',
    );
  });

  it.each(['', 'example.com', 'ftp://example.com', 'https://user:pass@example.com'])(
    'rejects unsupported input %j',
    (input) => {
      expect(() => normalizeHttpUrl(input)).toThrowError();
    },
  );
});

describe('isDisallowedAddress', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '224.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '64:ff9b::7f00:1',
    '2002:7f00:1::',
  ])('blocks %s', (address) => {
    expect(isDisallowedAddress(address)).toBe(true);
  });

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])(
    'allows public address %s',
    (address) => {
      expect(isDisallowedAddress(address)).toBe(false);
    },
  );
});

describe('assertPublicDestination', () => {
  it('rejects a hostname when any resolved address is private', async () => {
    const lookup = vi.fn().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);

    await expect(assertPublicDestination(new URL('https://example.com'), lookup)).rejects.toThrow(
      'private or reserved',
    );
  });

  it('accepts a hostname only when all resolved addresses are public', async () => {
    const lookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

    await expect(
      assertPublicDestination(new URL('https://example.com'), lookup),
    ).resolves.toBeUndefined();
  });
});
