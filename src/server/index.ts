import { resolve } from 'node:path';

import { createApp } from './app.js';
import { createLinkRepository } from './link-repository.js';
import { fetchPageMetadata } from './metadata.js';
import { findClientDist, getServerHost } from './runtime.js';

const port = Number(process.env.PORT ?? 3000);
const databasePath = process.env.DATABASE_PATH ?? resolve('data/links.db');
const clientDist = findClientDist(process.cwd());
const host = getServerHost();
const repository = createLinkRepository(databasePath);
const app = createApp({ clientDist, fetchMetadata: fetchPageMetadata, repository });

const server = app.listen(port, host, () => {
  console.log(`Link Saver API listening on http://${host}:${port}`);
});

function shutdown(): void {
  server.close(() => {
    repository.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
