import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function findClientDist(
  projectRoot: string,
  pathExists: (path: string) => boolean = existsSync,
): string | undefined {
  const clientDist = join(projectRoot, 'dist', 'client');
  return pathExists(join(clientDist, 'index.html')) ? clientDist : undefined;
}

export function getServerHost(): string {
  return '127.0.0.1';
}
