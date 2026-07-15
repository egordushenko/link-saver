import { load } from 'cheerio';

import {
  assertPublicDestination,
  normalizeHttpUrl,
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
  fetchImpl?: typeof fetch;
  lookup?: LookupAll;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
};

export type PageMetadata = {
  finalUrl: string;
  title: string;
};

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
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
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicDestination(currentUrl, options.lookup);

    let response: Response;
    try {
      response = await fetchImpl(currentUrl, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'LinkSaver/1.0 (+https://github.com/egordushenko/link-saver)',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error && error.name === 'TimeoutError'
        ? 'The page took too long to respond.'
        : 'The page could not be fetched.';
      throw new MetadataFetchError(message);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new MetadataFetchError('The page returned an invalid redirect.');
      if (redirectCount === maxRedirects) {
        throw new MetadataFetchError('The page returned too many redirects.');
      }
      currentUrl = normalizeHttpUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      throw new MetadataFetchError(`The page returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
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
