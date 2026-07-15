import type { ApiErrorResponse, Link } from '../shared/link.js';

type LinksResponse = { links: Link[] };
type LinkResponse = { link: Link };

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | ApiErrorResponse;
  if (!response.ok) {
    const message = 'error' in (body as object)
      ? (body as ApiErrorResponse).error.message
      : 'The request could not be completed.';
    throw new Error(message);
  }
  return body as T;
}

export async function getLinks(): Promise<Link[]> {
  const response = await fetch('/api/links');
  return (await readJson<LinksResponse>(response)).links;
}

export async function createLink(url: string): Promise<Link> {
  const response = await fetch('/api/links', {
    body: JSON.stringify({ url }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  return (await readJson<LinkResponse>(response)).link;
}

export async function deleteLink(id: string): Promise<void> {
  const response = await fetch(`/api/links/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    await readJson<ApiErrorResponse>(response);
  }
}

