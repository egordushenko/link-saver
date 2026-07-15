import { describe, expect, it, vi } from 'vitest';

import { fetchPageMetadata, MetadataFetchError } from './metadata.js';

const publicLookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

function mockFetch(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

describe('fetchPageMetadata', () => {
  it('extracts and normalizes the document title', async () => {
    const fetchImpl = mockFetch(
      new Response('<html><title>  A useful &amp; resilient\n page </title></html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );

    const result = await fetchPageMetadata(new URL('https://example.com/article'), {
      fetchImpl,
      lookup: publicLookup,
    });

    expect(result).toEqual({
      finalUrl: 'https://example.com/article',
      title: 'A useful & resilient page',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL('https://example.com/article'),
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('uses the final hostname when the page has no title', async () => {
    const fetchImpl = mockFetch(
      new Response('<html><body>No title</body></html>', {
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(
      fetchPageMetadata(new URL('https://www.example.com'), { fetchImpl, lookup: publicLookup }),
    ).resolves.toMatchObject({ title: 'www.example.com' });
  });

  it('revalidates every redirect before requesting it', async () => {
    const fetchImpl = mockFetch(
      new Response(null, { status: 302, headers: { location: 'http://internal.example/admin' } }),
    );
    const lookup = vi
      .fn()
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);

    await expect(
      fetchPageMetadata(new URL('https://example.com'), { fetchImpl, lookup }),
    ).rejects.toThrow('private or reserved');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-HTML response', async () => {
    const fetchImpl = mockFetch(
      new Response('{"title":"not html"}', { headers: { 'content-type': 'application/json' } }),
    );

    await expect(
      fetchPageMetadata(new URL('https://example.com/data'), { fetchImpl, lookup: publicLookup }),
    ).rejects.toThrowError(new MetadataFetchError('The URL did not return an HTML page.'));
  });

  it('rejects a response larger than the configured limit', async () => {
    const fetchImpl = mockFetch(
      new Response('<title>Too large</title>', { headers: { 'content-type': 'text/html' } }),
    );

    await expect(
      fetchPageMetadata(new URL('https://example.com'), {
        fetchImpl,
        lookup: publicLookup,
        maxBytes: 8,
      }),
    ).rejects.toThrow('too large');
  });

  it('rejects redirect chains over the configured limit', async () => {
    const fetchImpl = mockFetch(
      new Response(null, { status: 302, headers: { location: '/another-hop' } }),
    );

    await expect(
      fetchPageMetadata(new URL('https://example.com'), {
        fetchImpl,
        lookup: publicLookup,
        maxRedirects: 1,
      }),
    ).rejects.toThrow('too many redirects');
  });
});

