import { type KeyboardEvent, useEffect, useRef } from 'react';

import type { Link } from '../../shared/link.js';

type DeleteDialogProps = {
  isDeleting: boolean;
  link: Link;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteDialog({ isDeleting, link, onCancel, onConfirm }: DeleteDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null);

  useEffect(() => {
    const trigger = returnFocus.current;
    cancelButton.current?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isDeleting) {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== 'Tab') return;
    if (event.shiftKey && document.activeElement === cancelButton.current) {
      event.preventDefault();
      confirmButton.current?.focus();
    } else if (!event.shiftKey && document.activeElement === confirmButton.current) {
      event.preventDefault();
      cancelButton.current?.focus();
    }
  }

  return (
    <div className="dialog-backdrop">
      <div
        aria-describedby="delete-dialog-description"
        aria-labelledby="delete-dialog-title"
        aria-modal="true"
        className="dialog-card"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <div className="dialog-icon" aria-hidden="true">×</div>
        <p className="eyebrow">Confirm removal</p>
        <h2 id="delete-dialog-title">Delete saved link?</h2>
        <p id="delete-dialog-description">
          <strong>{link.title}</strong> will be removed from this collection.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            disabled={isDeleting}
            onClick={onCancel}
            ref={cancelButton}
          >
            Keep it
          </button>
          <button
            className="button button-danger"
            disabled={isDeleting}
            onClick={onConfirm}
            ref={confirmButton}
          >
            {isDeleting ? 'Deleting…' : 'Delete link'}
          </button>
        </div>
      </div>
    </div>
  );
}
