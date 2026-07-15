import express, { type ErrorRequestHandler } from 'express';
import { join } from 'node:path';

import type { ApiErrorResponse } from '../shared/link.js';
import { HttpError } from './errors.js';
import type { LinkRepository } from './link-repository.js';
import type { PageMetadata } from './metadata.js';
import { normalizeHttpUrl } from './url-policy.js';

export type FetchMetadata = (url: URL) => Promise<PageMetadata>;

type AppDependencies = {
  clientDist?: string;
  fetchMetadata: FetchMetadata;
  repository: LinkRepository;
};

function httpError(status: number, code: string, message: string): never {
  throw new HttpError(status, code, message);
}

function isSqliteConstraint(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && String(error.code).startsWith('SQLITE_CONSTRAINT');
}

function isMalformedJson(error: unknown): boolean {
  return error instanceof SyntaxError
    && 'status' in error
    && error.status === 400;
}

export function createApp({ clientDist, fetchMetadata, repository }: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/links', (_request, response) => {
    const favoriteOnly = _request.query.favorite === 'true';
    response.json({ links: repository.list(favoriteOnly) });
  });

  app.post('/api/links', async (request, response) => {
    if (typeof request.body?.url !== 'string') {
      httpError(400, 'INVALID_URL', 'Enter a URL to save.');
    }

    let url: URL;
    try {
      url = normalizeHttpUrl(request.body.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Enter a valid URL.';
      httpError(400, 'INVALID_URL', message);
    }

    const normalizedUrl = url.toString();
    if (repository.findByNormalizedUrl(normalizedUrl)) {
      httpError(409, 'DUPLICATE_URL', 'That URL is already in your saved links.');
    }

    let metadata: PageMetadata;
    try {
      metadata = await fetchMetadata(url);
    } catch {
      httpError(422, 'PAGE_UNAVAILABLE', "We couldn't read an HTML title from that URL.");
    }

    try {
      const link = repository.create({ normalizedUrl, title: metadata.title, url: normalizedUrl });
      response.status(201).json({ link });
    } catch (error) {
      if (isSqliteConstraint(error)) {
        httpError(409, 'DUPLICATE_URL', 'That URL is already in your saved links.');
      }
      throw error;
    }
  });

  app.patch('/api/links/:id/favorite', (request, response) => {
    if (typeof request.body?.isFavorite !== 'boolean') {
      httpError(400, 'INVALID_FAVORITE', 'isFavorite must be a boolean.');
    }
    const link = repository.setFavorite(request.params.id, request.body.isFavorite);
    if (!link) httpError(404, 'LINK_NOT_FOUND', 'That saved link no longer exists.');
    response.json({ link });
  });

  app.delete('/api/links/:id', (request, response) => {
    if (!repository.delete(request.params.id)) {
      httpError(404, 'LINK_NOT_FOUND', 'That saved link no longer exists.');
    }
    response.sendStatus(204);
  });

  app.use('/api', (_request, _response) => {
    httpError(404, 'NOT_FOUND', 'API route not found.');
  });

  if (clientDist) {
    app.use(express.static(clientDist));
    app.use((request, response, next) => {
      if (request.method !== 'GET' || !request.accepts('html')) return next();
      response.sendFile(join(clientDist, 'index.html'));
    });
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const knownError = error instanceof HttpError
      ? error
      : isMalformedJson(error)
        ? new HttpError(400, 'INVALID_JSON', 'The request body must be valid JSON.')
        : new HttpError(500, 'INTERNAL_ERROR', 'Something went wrong on the server.');
    const body: ApiErrorResponse = {
      error: { code: knownError.code, message: knownError.message },
    };
    response.status(knownError.status).json(body);
  };
  app.use(errorHandler);

  return app;
}
