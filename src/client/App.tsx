import { type FormEvent, useEffect, useState } from 'react';

import type { Link } from '../shared/link.js';
import { createLink, deleteLink, getLinks, setLinkFavorite } from './api.js';
import { DeleteDialog } from './components/DeleteDialog.js';
import { LinkItem } from './components/LinkItem.js';

export function App() {
  const [links, setLinks] = useState<Link[]>([]);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Link | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [favoriteFilter, setFavoriteFilter] = useState(false);
  const [updatingFavoriteId, setUpdatingFavoriteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const favoriteCount = links.filter((link) => link.isFavorite).length;
  const visibleLinks = favoriteFilter ? links.filter((link) => link.isFavorite) : links;

  useEffect(() => {
    let active = true;
    getLinks()
      .then((savedLinks) => {
        if (active) setLinks(savedLinks);
      })
      .catch(() => {
        if (active) setLoadError("We couldn't load your saved links. Refresh to try again.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      const link = await createLink(url);
      setLinks((current) => [link, ...current]);
      setUrl('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The link could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteLink(deleteTarget.id);
      setLinks((current) => current.filter((link) => link.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The link could not be deleted.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function toggleFavorite(link: Link) {
    const nextFavorite = !link.isFavorite;
    setActionError('');
    setUpdatingFavoriteId(link.id);
    setLinks((current) => current.map((item) => (
      item.id === link.id ? { ...item, isFavorite: nextFavorite } : item
    )));
    try {
      const updated = await setLinkFavorite(link.id, nextFavorite);
      setLinks((current) => current.map((item) => (item.id === link.id ? updated : item)));
    } catch (error) {
      setLinks((current) => current.map((item) => (item.id === link.id ? link : item)));
      setActionError(error instanceof Error ? error.message : 'Favourite could not be updated.');
    } finally {
      setUpdatingFavoriteId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M10.5 13.5 13.5 10.5M7.8 15.8l-1.6 1.6a3.7 3.7 0 0 1-5.2-5.2l3.3-3.3a3.7 3.7 0 0 1 5.2 0M16.2 8.2l1.6-1.6a3.7 3.7 0 0 1 5.2 5.2l-3.3 3.3a3.7 3.7 0 0 1-5.2 0" /></svg>
          </span>
          <span>Link Saver</span>
        </div>
        <p className="eyebrow">Your useful corner of the internet</p>
        <h1>Save it now.<br />Find it when it matters.</h1>
        <p className="hero-copy">
          Paste a page below. We’ll fetch its real title and keep it ready for your next visit.
        </p>

        <form className="save-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="url-input">URL to save</label>
          <div className="input-wrap">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10.5 13.5 13.5 10.5M7.8 15.8l-1.6 1.6a3.7 3.7 0 0 1-5.2-5.2l3.3-3.3a3.7 3.7 0 0 1 5.2 0M16.2 8.2l1.6-1.6a3.7 3.7 0 0 1 5.2 5.2l-3.3 3.3a3.7 3.7 0 0 1-5.2 0" /></svg>
            <input
              autoComplete="url"
              id="url-input"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/article"
              required
              type="text"
              value={url}
            />
          </div>
          <button className="button button-primary" disabled={isSaving} type="submit">
            {isSaving ? 'Fetching title…' : 'Save link'}
          </button>
        </form>
        {formError && <p className="form-error" role="alert">{formError}</p>}
      </header>

      <section aria-labelledby="collection-heading" className="collection">
        <div className="collection-heading">
          <div>
            <p className="eyebrow">Collection</p>
            <h2 id="collection-heading">Saved links</h2>
          </div>
          <span className="link-count">{links.length} {links.length === 1 ? 'link' : 'links'}</span>
        </div>

        {!isLoading && !loadError && links.length > 0 && (
          <div className="filters" aria-label="Filter saved links">
            <button
              aria-pressed={!favoriteFilter}
              className={`filter-chip${!favoriteFilter ? ' active' : ''}`}
              onClick={() => setFavoriteFilter(false)}
            >
              All links <span>{links.length}</span>
            </button>
            <button
              aria-pressed={favoriteFilter}
              className={`filter-chip${favoriteFilter ? ' active' : ''}`}
              onClick={() => setFavoriteFilter(true)}
            >
              <span aria-hidden="true">★</span> Favourites {favoriteCount}
            </button>
          </div>
        )}
        {actionError && <p className="action-error" role="alert">{actionError}</p>}

        {isLoading && <div className="status-card">Loading your links…</div>}
        {!isLoading && loadError && <div className="status-card error-card" role="alert">{loadError}</div>}
        {!isLoading && !loadError && links.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">↗</div>
            <h3>Your saved corner is ready.</h3>
            <p>Add your first URL above. Its page title will appear here automatically.</p>
          </div>
        )}
        {!isLoading && !loadError && links.length > 0 && visibleLinks.length === 0 && (
          <div className="empty-state compact-empty">
            <div className="empty-icon star-empty" aria-hidden="true">★</div>
            <h3>Nothing starred here—yet.</h3>
            <p>Mark a useful link as a favourite and it will stay one filter away.</p>
          </div>
        )}
        {!isLoading && !loadError && visibleLinks.length > 0 && (
          <ul className="link-list">
            {visibleLinks.map((link) => (
              <LinkItem
                isUpdatingFavorite={updatingFavoriteId === link.id}
                key={link.id}
                link={link}
                onDelete={setDeleteTarget}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </ul>
        )}
      </section>

      <footer>
        <span>Built for useful detours.</span>
        <span>Titles are fetched automatically.</span>
      </footer>

      {deleteTarget && (
        <DeleteDialog
          isDeleting={isDeleting}
          link={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </main>
  );
}
