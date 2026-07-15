import { resolve } from 'node:path';

import { createApp } from './app.js';
import { createLinkRepository } from './link-repository.js';
import { fetchPageMetadata } from './metadata.js';

const port = Number(process.env.PORT ?? 3000);
const databasePath = process.env.DATABASE_PATH ?? resolve('data/links.db');
const clientDist = process.env.NODE_ENV === 'production' ? resolve('dist/client') : undefined;
const repository = createLinkRepository(databasePath);
const app = createApp({ clientDist, fetchMetadata: fetchPageMetadata, repository });

const server = app.listen(port, () => {
  console.log(`Link Saver API listening on http://localhost:${port}`);
});

function shutdown(): void {
  server.close(() => {
    repository.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

