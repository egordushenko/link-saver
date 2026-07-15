import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createLinkRepository } from './link-repository.js';

const tempDirectories: string[] = [];

async function databasePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'link-saver-'));
  tempDirectories.push(directory);
  return join(directory, 'links.db');
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('link repository', () => {
  it('persists links when the database is reopened', async () => {
    const filename = await databasePath();
    const first = createLinkRepository(filename, {
      idFactory: () => 'link-1',
      now: () => new Date('2026-07-15T10:00:00.000Z'),
    });

    first.create({
      normalizedUrl: 'https://example.com/article',
      title: 'Example article',
      url: 'https://example.com/article',
    });
    first.close();

    const reopened = createLinkRepository(filename);
    expect(reopened.list()).toEqual([
      {
        id: 'link-1',
        isFavorite: false,
        normalizedUrl: 'https://example.com/article',
        savedAt: '2026-07-15T10:00:00.000Z',
        title: 'Example article',
        url: 'https://example.com/article',
      },
    ]);
    reopened.close();
  });

  it('updates favourites and filters the list', async () => {
    const repository = createLinkRepository(await databasePath(), { idFactory: () => 'link-1' });
    repository.create({
      normalizedUrl: 'https://example.com/',
      title: 'Example',
      url: 'https://example.com/',
    });

    expect(repository.setFavorite('link-1', true)).toMatchObject({ isFavorite: true });
    expect(repository.list(true)).toHaveLength(1);
    expect(repository.setFavorite('missing', true)).toBeNull();
    repository.close();
  });

  it('deletes an existing link and reports a missing link', async () => {
    const repository = createLinkRepository(await databasePath(), { idFactory: () => 'link-1' });
    repository.create({
      normalizedUrl: 'https://example.com/',
      title: 'Example',
      url: 'https://example.com/',
    });

    expect(repository.delete('link-1')).toBe(true);
    expect(repository.delete('link-1')).toBe(false);
    expect(repository.list()).toEqual([]);
    repository.close();
  });

  it('finds a duplicate by normalized URL', async () => {
    const repository = createLinkRepository(await databasePath(), { idFactory: () => 'link-1' });
    repository.create({
      normalizedUrl: 'https://example.com/',
      title: 'Example',
      url: 'https://example.com/',
    });

    expect(repository.findByNormalizedUrl('https://example.com/')).toMatchObject({ id: 'link-1' });
    expect(repository.findByNormalizedUrl('https://different.example/')).toBeNull();
    repository.close();
  });
});

