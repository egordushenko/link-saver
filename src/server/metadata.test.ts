import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { fetchPageMetadata, MetadataFetchError, requestPinned } from './metadata.js';

const publicLookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

function mockRequest(response: Response) {
  return vi.fn().mockResolvedValue(response);
}

describe('fetchPageMetadata', () => {
  it('connects to the pinned IP while preserving the original Host header', async () => {
    let host = '';
    const server = createServer((request, response) => {
      host = request.headers.host ?? '';
      response.setHeader('content-type', 'text/html');
      response.end('<title>Pinned transport</title>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const response = await requestPinned(new URL(`http://metadata.example:${port}/page`), {
        address: { address: '127.0.0.1', family: 4 },
        signal: AbortSignal.timeout(1_000),
      });

      expect(await response.text()).toContain('Pinned transport');
      expect(host).toBe(`metadata.example:${port}`);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (
        error ? reject(error) : resolve()
      )));
    }
  });

  it('extracts and normalizes the document title', async () => {
    const requestImpl = mockRequest(
      new Response('<html><title>  A useful &amp; resilient\n page </title></html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );

    const result = await fetchPageMetadata(new URL('https://example.com/article'), {
      requestImpl,
      lookup: publicLookup,
    });

    expect(result).toEqual({
      finalUrl: 'https://example.com/article',
      title: 'A useful & resilient page',
    });
    expect(requestImpl).toHaveBeenCalledWith(
      new URL('https://example.com/article'),
      expect.objectContaining({
        address: { address: '93.184.216.34', family: 4 },
      }),
    );
  });

  it('uses the final hostname when the page has no title', async () => {
    const requestImpl = mockRequest(
      new Response('<html><body>No title</body></html>', {
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(
      fetchPageMetadata(new URL('https://www.example.com'), { requestImpl, lookup: publicLookup }),
    ).resolves.toMatchObject({ title: 'www.example.com' });
  });

  it('revalidates every redirect before requesting it', async () => {
    const requestImpl = mockRequest(
      new Response(null, { status: 302, headers: { location: 'http://internal.example/admin' } }),
    );
    const lookup = vi
      .fn()
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);

    await expect(
      fetchPageMetadata(new URL('https://example.com'), { requestImpl, lookup }),
    ).rejects.toThrow('private or reserved');
    expect(requestImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-HTML response', async () => {
    const requestImpl = mockRequest(
      new Response('{"title":"not html"}', { headers: { 'content-type': 'application/json' } }),
    );

    await expect(
      fetchPageMetadata(new URL('https://example.com/data'), { requestImpl, lookup: publicLookup }),
    ).rejects.toThrowError(new MetadataFetchError('The URL did not return an HTML page.'));
  });

  it('rejects a response larger than the configured limit', async () => {
    const requestImpl = mockRequest(
      new Response('<title>Too large</title>', { headers: { 'content-type': 'text/html' } }),
    );

    await expect(
      fetchPageMetadata(new URL('https://example.com'), {
        requestImpl,
        lookup: publicLookup,
        maxBytes: 8,
      }),
    ).rejects.toThrow('too large');
  });

  it('rejects redirect chains over the configured limit', async () => {
    const requestImpl = mockRequest(
      new Response(null, { status: 302, headers: { location: '/another-hop' } }),
    );

    await expect(
      fetchPageMetadata(new URL('https://example.com'), {
        requestImpl,
        lookup: publicLookup,
        maxRedirects: 1,
      }),
    ).rejects.toThrow('too many redirects');
  });

  it.each([
    {
      headers: new Headers({ location: '/next' }),
      status: 302,
      expected: 'too many redirects',
      maxRedirects: 0,
    },
    {
      headers: new Headers({ 'content-type': 'text/plain' }),
      status: 200,
      expected: 'HTML page',
      maxRedirects: 1,
    },
    {
      headers: new Headers({ 'content-type': 'text/html' }),
      status: 503,
      expected: 'HTTP 503',
      maxRedirects: 1,
    },
  ])('cancels unused response bodies for HTTP $status', async ({
    expected,
    headers,
    maxRedirects,
    status,
  }) => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const requestImpl = mockRequest(new Response(body, { headers, status }));

    await expect(fetchPageMetadata(new URL('https://example.com'), {
      lookup: publicLookup,
      maxRedirects,
      requestImpl,
    })).rejects.toThrow(expected);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
