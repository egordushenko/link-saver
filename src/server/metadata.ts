import { load } from 'cheerio';
import { request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import { Readable } from 'node:stream';

import {
  assertPublicDestination,
  normalizeHttpUrl,
  type LookupAddress,
  type LookupAll,
} from './url-policy.js';

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 1_000_000;
const DEFAULT_MAX_REDIRECTS = 3;

export class MetadataFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetadataFetchError';
  }
}

type MetadataOptions = {
  lookup?: LookupAll;
  maxBytes?: number;
  maxRedirects?: number;
  requestImpl?: PinnedRequest;
  timeoutMs?: number;
};

type PinnedRequestOptions = {
  address: LookupAddress;
  signal: AbortSignal;
};

export type PinnedRequest = (url: URL, options: PinnedRequestOptions) => Promise<Response>;

export type PageMetadata = {
  finalUrl: string;
  title: string;
};

function toWebHeaders(headers: Record<string, string | string[] | undefined>): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item);
    } else if (value !== undefined) {
      result.set(name, value);
    }
  }
  return result;
}

export const requestPinned: PinnedRequest = (url, { address, signal }) => new Promise((resolve, reject) => {
  const request = url.protocol === 'https:' ? requestHttps : requestHttp;
  const outgoing = request(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'LinkSaver/1.0 (+https://github.com/egordushenko/link-saver)',
    },
    lookup: (_hostname, lookupOptions, callback) => {
      if (lookupOptions.all) {
        callback(null, [{ address: address.address, family: address.family }]);
      } else {
        callback(null, address.address, address.family as 4 | 6);
      }
    },
    signal,
  }, (incoming) => {
    const status = incoming.statusCode ?? 500;
    const hasBody = ![204, 205, 304].includes(status);
    const body = hasBody
      ? Readable.toWeb(incoming) as ReadableStream<Uint8Array>
      : null;
    resolve(new Response(body, {
      headers: toWebHeaders(incoming.headers),
      status,
      statusText: incoming.statusMessage,
    }));
  });
  outgoing.once('error', reject);
  outgoing.end();
});

async function cancelResponseBody(response: Response): Promise<void> {
  if (!response.body || response.body.locked) return;
  try {
    await response.body.cancel();
  } catch {
    // The connection may already be closed; there is nothing else to retain.
  }
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await cancelResponseBody(response);
    throw new MetadataFetchError('The HTML response was too large to read safely.');
  }

  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new MetadataFetchError('The HTML response was too large to read safely.');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function extractTitle(html: string, fallbackHostname: string): string {
  const title = load(html)('title').first().text().replace(/\s+/g, ' ').trim();
  return (title || fallbackHostname).slice(0, 300);
}

export async function fetchPageMetadata(
  initialUrl: URL,
  options: MetadataOptions = {},
): Promise<PageMetadata> {
  const requestImpl = options.requestImpl ?? requestPinned;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const addresses = await assertPublicDestination(currentUrl, options.lookup);
    const address = addresses[0];
    if (!address) {
      throw new MetadataFetchError('The page could not be fetched.');
    }

    let response: Response;
    try {
      response = await requestImpl(currentUrl, {
        address,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)
        ? 'The page took too long to respond.'
        : 'The page could not be fetched.';
      throw new MetadataFetchError(message);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        await cancelResponseBody(response);
        throw new MetadataFetchError('The page returned an invalid redirect.');
      }
      if (redirectCount === maxRedirects) {
        await cancelResponseBody(response);
        throw new MetadataFetchError('The page returned too many redirects.');
      }
      await cancelResponseBody(response);
      currentUrl = normalizeHttpUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      await cancelResponseBody(response);
      throw new MetadataFetchError(`The page returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      await cancelResponseBody(response);
      throw new MetadataFetchError('The URL did not return an HTML page.');
    }

    const html = await readBoundedText(response, maxBytes);
    return {
      finalUrl: currentUrl.toString(),
      title: extractTitle(html, currentUrl.hostname),
    };
  }

  throw new MetadataFetchError('The page returned too many redirects.');
}
