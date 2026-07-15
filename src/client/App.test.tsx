// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Link } from '../shared/link.js';
import { App } from './App.js';

const savedLink: Link = {
  id: 'link-1',
  isFavorite: false,
  normalizedUrl: 'https://example.com/article',
  savedAt: '2026-07-15T10:00:00.000Z',
  title: 'Example article',
  url: 'https://example.com/article',
};

const favoriteLink: Link = { ...savedLink, isFavorite: true };
const secondLink: Link = {
  ...savedLink,
  id: 'link-2',
  normalizedUrl: 'https://developer.mozilla.org/',
  title: 'MDN Web Docs',
  url: 'https://developer.mozilla.org/',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App core link flow', () => {
  it('loads saved links and shows the empty state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ links: [] })));

    render(<App />);

    expect(screen.getByText('Loading your links…')).toBeInTheDocument();
    expect(await screen.findByText('Your saved corner is ready.')).toBeInTheDocument();
  });

  it('saves a URL and shows the fetched title', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ links: [] }))
      .mockResolvedValueOnce(jsonResponse({ link: savedLink }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Your saved corner is ready.');

    const input = screen.getByLabelText('URL to save');
    await user.type(input, 'https://example.com/article');
    await user.click(screen.getByRole('button', { name: 'Save link' }));

    expect(await screen.findByRole('link', { name: 'Example article' })).toHaveAttribute(
      'href',
      savedLink.url,
    );
    expect(input).toHaveValue('');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/links',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('keeps the URL and explains a create error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ links: [] }))
        .mockResolvedValueOnce(
          jsonResponse({ error: { code: 'INVALID_URL', message: 'Enter a complete URL.' } }, 400),
        ),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Your saved corner is ready.');

    const input = screen.getByLabelText('URL to save');
    await user.type(input, 'not-a-url');
    await user.click(screen.getByRole('button', { name: 'Save link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a complete URL.');
    expect(input).toHaveValue('not-a-url');
  });

  it('confirms deletion before removing a link', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ links: [savedLink] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('link', { name: 'Example article' });

    await user.click(screen.getByRole('button', { name: 'Delete Example article' }));
    expect(screen.getByRole('dialog', { name: 'Delete saved link?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete link' }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Example article' })).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/links/link-1', { method: 'DELETE' });
  });

  it('marks a link as a favourite', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ links: [savedLink] }))
      .mockResolvedValueOnce(jsonResponse({ link: favoriteLink }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('link', { name: 'Example article' });

    await user.click(screen.getByRole('button', { name: 'Add Example article to favourites' }));

    expect(
      await screen.findByRole('button', { name: 'Remove Example article from favourites' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Favourites 1' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/links/link-1/favorite', {
      body: JSON.stringify({ isFavorite: true }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    });
  });

  it('filters favourites and removes an unstarred link from that view', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ links: [favoriteLink, secondLink] }))
      .mockResolvedValueOnce(jsonResponse({ link: savedLink }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('link', { name: 'MDN Web Docs' });

    await user.click(screen.getByRole('button', { name: 'Favourites 1' }));
    expect(screen.queryByRole('link', { name: 'MDN Web Docs' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Example article from favourites' }));

    expect(await screen.findByText('Nothing starred here—yet.')).toBeInTheDocument();
  });
});
