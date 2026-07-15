import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import Database from 'better-sqlite3';

import type { Link } from '../shared/link.js';

type LinkRow = {
  id: string;
  is_favorite: number;
  normalized_url: string;
  saved_at: string;
  title: string;
  url: string;
};

type NewLink = Pick<Link, 'normalizedUrl' | 'title' | 'url'>;

type RepositoryOptions = {
  idFactory?: () => string;
  now?: () => Date;
};

export type LinkRepository = {
  close: () => void;
  create: (link: NewLink) => Link;
  delete: (id: string) => boolean;
  findByNormalizedUrl: (normalizedUrl: string) => Link | null;
  list: (favoriteOnly?: boolean) => Link[];
  setFavorite: (id: string, isFavorite: boolean) => Link | null;
};

function mapRow(row: LinkRow): Link {
  return {
    id: row.id,
    isFavorite: row.is_favorite === 1,
    normalizedUrl: row.normalized_url,
    savedAt: row.saved_at,
    title: row.title,
    url: row.url,
  };
}

export function createLinkRepository(
  filename: string,
  options: RepositoryOptions = {},
): LinkRepository {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const database = new Database(filename);
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      normalized_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1))
    );
    CREATE INDEX IF NOT EXISTS links_saved_at_idx ON links(saved_at DESC);
  `);

  const listAll = database.prepare<[], LinkRow>(
    'SELECT * FROM links ORDER BY saved_at DESC, rowid DESC',
  );
  const listFavorites = database.prepare<[], LinkRow>(
    'SELECT * FROM links WHERE is_favorite = 1 ORDER BY saved_at DESC, rowid DESC',
  );
  const findById = database.prepare<[string], LinkRow>('SELECT * FROM links WHERE id = ?');
  const findDuplicate = database.prepare<[string], LinkRow>(
    'SELECT * FROM links WHERE normalized_url = ?',
  );
  const insert = database.prepare(
    `INSERT INTO links (id, url, normalized_url, title, saved_at, is_favorite)
     VALUES (@id, @url, @normalizedUrl, @title, @savedAt, 0)`,
  );
  const updateFavorite = database.prepare(
    'UPDATE links SET is_favorite = @isFavorite WHERE id = @id',
  );
  const deleteById = database.prepare<[string]>('DELETE FROM links WHERE id = ?');

  return {
    close: () => database.close(),
    create: (link) => {
      const created: Link = {
        ...link,
        id: (options.idFactory ?? randomUUID)(),
        isFavorite: false,
        savedAt: (options.now ?? (() => new Date()))().toISOString(),
      };
      insert.run(created);
      return created;
    },
    delete: (id) => deleteById.run(id).changes === 1,
    findByNormalizedUrl: (normalizedUrl) => {
      const row = findDuplicate.get(normalizedUrl);
      return row ? mapRow(row) : null;
    },
    list: (favoriteOnly = false) =>
      (favoriteOnly ? listFavorites.all() : listAll.all()).map(mapRow),
    setFavorite: (id, isFavorite) => {
      const result = updateFavorite.run({ id, isFavorite: isFavorite ? 1 : 0 });
      if (result.changes === 0) return null;
      const row = findById.get(id);
      return row ? mapRow(row) : null;
    },
  };
}
