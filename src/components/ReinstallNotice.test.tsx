import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReinstallNotice from './ReinstallNotice';

const release = (updatedAt: string) =>
  vi.fn(async () => new Response(JSON.stringify({ assets: [{ name: 'LifeLink.apk', updated_at: updatedAt }] }), { status: 200 }));

const showFor = async (ua: string, fetch = release('2026-10-17T10:00:00Z')) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  vi.stubGlobal('fetch', fetch);
  await act(async () => { render(<ReinstallNotice />); });
  return fetch;
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the reinstall notice for old app builds', () => {
  it('shows in app build 1 once the new build is published, and can wait a few days', async () => {
    await showFor('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile LifeLinkApp');
    expect(screen.getByRole('dialog').textContent).toMatch(/reinstall the LifeLink app/i);
    fireEvent.click(screen.getByRole('button', { name: /later/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(Number(localStorage.getItem('lifelink.reinstallSnoozedUntil'))).toBeGreaterThan(Date.now());
  });

  it('waits while the download link still serves the old build', async () => {
    await showFor('Mozilla/5.0 (Linux; Android 14) LifeLinkApp', release('2026-10-01T10:00:00Z'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never shows in a browser or in newer app builds', async () => {
    for (const ua of ['Mozilla/5.0 (Windows NT 10.0) Chrome/130.0', 'Mozilla/5.0 (Linux; Android 14) LifeLinkApp/2', 'Mozilla/5.0 LifeLinkApp/3']) {
      const fetch = await showFor(ua);
      expect(fetch).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
      cleanup();
    }
  });
});
