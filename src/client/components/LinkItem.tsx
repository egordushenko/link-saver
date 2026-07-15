import type { Link } from '../../shared/link.js';

type LinkItemProps = {
  isUpdatingFavorite: boolean;
  link: Link;
  onDelete: (link: Link) => void;
  onToggleFavorite: (link: Link) => void;
};

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function LinkItem({
  isUpdatingFavorite,
  link,
  onDelete,
  onToggleFavorite,
}: LinkItemProps) {
  const hostname = new URL(link.url).hostname.replace(/^www\./, '');
  const initial = hostname.charAt(0).toUpperCase();

  return (
    <li className="link-item">
      <div className="site-mark" aria-hidden="true">{initial}</div>
      <div className="link-copy">
        <a className="link-title" href={link.url} rel="noreferrer" target="_blank">
          {link.title}
          <span className="external-arrow" aria-hidden="true">↗</span>
        </a>
        <div className="link-meta">
          <span>{hostname}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={link.savedAt}>{dateFormatter.format(new Date(link.savedAt))}</time>
        </div>
      </div>
      <div className="link-actions">
        <button
          aria-label={`${link.isFavorite ? 'Remove' : 'Add'} ${link.title} ${link.isFavorite ? 'from' : 'to'} favourites`}
          aria-pressed={link.isFavorite}
          className={`icon-button favorite-button${link.isFavorite ? ' is-favorite' : ''}`}
          disabled={isUpdatingFavorite}
          onClick={() => onToggleFavorite(link)}
          title={link.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
          </svg>
        </button>
        <button
          aria-label={`Delete ${link.title}`}
          className="icon-button delete-button"
          onClick={() => onDelete(link)}
          title="Delete link"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
          </svg>
        </button>
      </div>
    </li>
  );
}
