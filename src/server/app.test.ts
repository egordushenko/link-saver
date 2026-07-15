import request from 'supertest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp, type FetchMetadata } from './app.js';
import { createLinkRepository, type LinkRepository } from './link-repository.js';

describe('link API', () => {
  let repository: LinkRepository;
  let fetchMetadata: ReturnType<typeof vi.fn<FetchMetadata>>;

  beforeEach(() => {
    repository = createLinkRepository(':memory:', {
      idFactory: () => 'link-1',
      now: () => new Date('2026-07-15T10:00:00.000Z'),
    });
    fetchMetadata = vi.fn<FetchMetadata>().mockResolvedValue({
      finalUrl: 'https://example.com/article',
      title: 'Example article',
    });
  });

  afterEach(() => repository.close());

  it('lists an empty collection', async () => {
    const response = await request(createApp({ fetchMetadata, repository })).get('/api/links');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ links: [] });
  });

  it('rejects requests addressed through a foreign Host header', async () => {
    const response = await request(createApp({ fetchMetadata, repository }))
      .get('/api/links')
      .set('host', 'attacker.example:3000');

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'HOST_NOT_ALLOWED',
      message: 'This local service only accepts loopback hostnames.',
    });
  });

  it('creates a link with fetched metadata and returns it in the list', async () => {
    const app = createApp({ fetchMetadata, repository });

    const created = await request(app)
      .post('/api/links')
      .send({ url: ' HTTPS://Example.COM:443/article#section ' });

    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      link: {
        id: 'link-1',
        isFavorite: false,
        normalizedUrl: 'https://example.com/article',
        savedAt: '2026-07-15T10:00:00.000Z',
        title: 'Example article',
        url: 'https://example.com/article',
      },
    });
    await expect(request(app).get('/api/links')).resolves.toMatchObject({
      body: { links: [created.body.link] },
    });
  });

  it('rejects invalid and duplicate URLs with stable errors', async () => {
    const app = createApp({ fetchMetadata, repository });
    const invalid = await request(app).post('/api/links').send({ url: 'example.com' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_URL');

    await request(app).post('/api/links').send({ url: 'https://example.com/article' });
    const duplicate = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com/article#again' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_URL');
    expect(fetchMetadata).toHaveBeenCalledTimes(1);
  });

  it('maps malformed JSON to a client error', async () => {
    const response = await request(createApp({ fetchMetadata, repository }))
      .post('/api/links')
      .set('content-type', 'application/json')
      .send('{"url":');

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'INVALID_JSON',
      message: 'The request body must be valid JSON.',
    });
  });

  it('maps oversized JSON bodies to a stable 413 error', async () => {
    const response = await request(createApp({ fetchMetadata, repository }))
      .post('/api/links')
      .send({ url: `https://example.com/${'a'.repeat(11_000)}` });

    expect(response.status).toBe(413);
    expect(response.body.error).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request body is too large.',
    });
  });

  it('maps metadata failures to a safe 422 response', async () => {
    fetchMetadata.mockRejectedValue(new Error('socket details that must not leak'));

    const response = await request(createApp({ fetchMetadata, repository }))
      .post('/api/links')
      .send({ url: 'https://example.com' });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        code: 'PAGE_UNAVAILABLE',
        message: "We couldn't read an HTML title from that URL.",
      },
    });
  });

  it('updates favourites and filters the list', async () => {
    const app = createApp({ fetchMetadata, repository });
    await request(app).post('/api/links').send({ url: 'https://example.com/article' });

    const updated = await request(app)
      .patch('/api/links/link-1/favorite')
      .send({ isFavorite: true });
    expect(updated.status).toBe(200);
    expect(updated.body.link.isFavorite).toBe(true);

    const favorites = await request(app).get('/api/links?favorite=true');
    expect(favorites.body.links).toHaveLength(1);
  });

  it('validates favourite input and missing IDs', async () => {
    const app = createApp({ fetchMetadata, repository });

    const invalid = await request(app)
      .patch('/api/links/link-1/favorite')
      .send({ isFavorite: 'yes' });
    expect(invalid.status).toBe(400);

    const missing = await request(app)
      .patch('/api/links/missing/favorite')
      .send({ isFavorite: true });
    expect(missing.status).toBe(404);
  });

  it('deletes links and returns 404 when the ID is missing', async () => {
    const app = createApp({ fetchMetadata, repository });
    await request(app).post('/api/links').send({ url: 'https://example.com/article' });

    expect((await request(app).delete('/api/links/link-1')).status).toBe(204);
    const missing = await request(app).delete('/api/links/link-1');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('LINK_NOT_FOUND');
  });

  it('does not disclose unexpected server errors', async () => {
    const brokenRepository = { ...repository, list: () => { throw new Error('database path'); } };

    const response = await request(
      createApp({ fetchMetadata, repository: brokenRepository }),
    ).get('/api/links');

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on the server.',
    });
  });

  it('serves the client shell for non-API routes in production', async () => {
    const clientDist = await mkdtemp(join(tmpdir(), 'link-saver-client-'));
    await writeFile(join(clientDist, 'index.html'), '<main>Link Saver shell</main>');

    const response = await request(createApp({ clientDist, fetchMetadata, repository })).get(
      '/saved-view',
    );

    expect(response.status).toBe(200);
    expect(response.text).toContain('Link Saver shell');
    await rm(clientDist, { recursive: true });
  });
});
