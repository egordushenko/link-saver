import type { Link } from '../../shared/link.js';

type LinkItemProps = {
  link: Link;
  onDelete: (link: Link) => void;
};

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function LinkItem({ link, onDelete }: LinkItemProps) {
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

