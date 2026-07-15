import type { Link } from '../../shared/link.js';

type DeleteDialogProps = {
  isDeleting: boolean;
  link: Link;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteDialog({ isDeleting, link, onCancel, onConfirm }: DeleteDialogProps) {
  return (
    <div className="dialog-backdrop">
      <div
        aria-labelledby="delete-dialog-title"
        aria-modal="true"
        className="dialog-card"
        role="dialog"
      >
        <div className="dialog-icon" aria-hidden="true">×</div>
        <p className="eyebrow">Confirm removal</p>
        <h2 id="delete-dialog-title">Delete saved link?</h2>
        <p>
          <strong>{link.title}</strong> will be removed from this collection.
        </p>
        <div className="dialog-actions">
          <button className="button button-secondary" disabled={isDeleting} onClick={onCancel}>
            Keep it
          </button>
          <button className="button button-danger" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? 'Deleting…' : 'Delete link'}
          </button>
        </div>
      </div>
    </div>
  );
}

