import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CERTIFICATE_CODE, certificateDay, certificateFileName, hospitalPlace, normaliseCode, requestCertificate } from './certificate';

describe('certificates', () => {
  it('accepts the same codes as the API', () => {
    const api = fs.readFileSync(path.join(__dirname, '../../server/src/controllers/certificateController.ts'), 'utf8');
    expect(api).toContain(`export const CERTIFICATE_CODE = ${CERTIFICATE_CODE.toString()};`);
    expect(CERTIFICATE_CODE.test('LC-ABCD-2345')).toBe(true);
    expect(CERTIFICATE_CODE.test('LC-ABC0-2345')).toBe(false); // no 0, O, 1, I or L
  });

  it('reads codes typed from paper', () => {
    expect(normaliseCode('lc abcd 2345')).toBe('LC-ABCD-2345');
    expect(normaliseCode('ABCD2345')).toBe('LC-ABCD-2345');
    expect(normaliseCode(' LC-ABCD-2345 ')).toBe('LC-ABCD-2345');
    expect(normaliseCode('hello')).toBe('HELLO');
  });

  it('prints dates and places the same way everywhere', () => {
    expect(certificateDay('2026-10-17')).toBe('17 October 2026');
    expect(certificateDay('2026-10-17T22:00:00.000Z')).toBe('17 October 2026');
    expect(hospitalPlace({ hospital_name: 'Civil Hospital', hospital_city: 'Pune' })).toBe('Civil Hospital, Pune');
    expect(hospitalPlace({ hospital_name: 'Civil Hospital', hospital_city: null })).toBe('Civil Hospital');
    expect(certificateFileName({ code: 'LC-ABCD-2345' })).toBe('LifeLink-certificate-LC-ABCD-2345.pdf');
  });

  it('asks the API for the certificate of one donation', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ code: 'LC-ABCD-2345' }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect((await requestCertificate({ match_id: 10011 })).code).toBe('LC-ABCD-2345');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/donor\/certificates$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ match_id: 10011 });
    expect(init.credentials).toBe('include');
  });
});
