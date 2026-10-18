import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CertificatePage from './CertificatePage';
import type { Certificate } from '../lib/certificate';

const certificate: Certificate = {
  code: 'LC-ABCD-2345', donor_name: 'Kavya Sood', hospital_name: 'Civil Hospital', hospital_city: 'Pune',
  donated_on: '2026-10-17', issued_at: '2026-10-18T05:00:00Z', verify_url: 'https://lifelink.example/certificate/LC-ABCD-2345',
};

const open = async (entry: string | { pathname: string; state: unknown }) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/certificate" element={<CertificatePage />} />
          <Route path="/certificate/:code" element={<CertificatePage />} />
        </Routes>
      </MemoryRouter>
    );
  });
};

beforeEach(() => {
  // jsdom draws nothing; the QR code just needs a canvas
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(cleanup);

describe('the certificate page', () => {
  it('confirms a real certificate, showing only a first name and initial', async () => {
    const fetch = vi.fn(async (_url: string) => new Response(JSON.stringify({
      valid: true, code: 'LC-ABCD-2345', donor: 'Kavya S.', hospital_name: 'Civil Hospital', hospital_city: 'Pune', donated_on: '2026-10-17',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await open('/certificate/lc-abcd-2345');
    expect(String(fetch.mock.calls[0]?.[0])).toMatch(/\/certificates\/LC-ABCD-2345$/);
    expect(screen.getByRole('heading', { name: 'This is a real LifeLink certificate' })).toBeTruthy();
    expect(screen.getByText('Kavya S.')).toBeTruthy();
    expect(screen.getByText('Civil Hospital, Pune')).toBeTruthy();
    expect(screen.getByText('17 October 2026')).toBeTruthy();
    expect(screen.queryByText('Kavya Sood')).toBeNull();
  });

  it('says plainly when a code is not LifeLink\'s', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ valid: false, message: 'No LifeLink certificate has this code.' }), { status: 404 })));
    await open('/certificate/LC-ZZZZ-ZZZZ');
    expect(screen.getByRole('heading', { name: 'No LifeLink certificate has this code.' })).toBeTruthy();
  });

  it('does not even ask about something that cannot be a code', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await open('/certificate/hello');
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'That is not a LifeLink certificate code.' })).toBeTruthy();
  });

  it('shows the donor their whole certificate, ready to save', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await open({ pathname: '/certificate/LC-ABCD-2345', state: { certificate } });
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Kavya Sood' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /save as pdf/i })).toBeTruthy();
    expect(screen.getByText(/lifelink\.example\/certificate\/LC-ABCD-2345/)).toBeTruthy();
  });
});
