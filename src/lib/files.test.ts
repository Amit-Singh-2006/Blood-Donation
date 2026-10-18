import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppUpdateNeeded, saveFile } from './files';

const asApp = (build: string | null) => {
  const ua = build === null ? 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0' : `Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile ${build}`;
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
};

/** Capacitor's bridge as the app injects it, with or without the LifeLinkFiles plugin. */
const withPlugin = (save?: (file: { data: string; name: string; type: string }) => Promise<void>) => {
  (window as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    isPluginAvailable: (name: string) => name === 'LifeLinkFiles' && !!save,
    Plugins: save ? { LifeLinkFiles: { save } } : {},
  };
};

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe('saving a file the page made', () => {
  it('downloads it in a browser', async () => {
    asApp(null);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:https://example/1'), revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('LifeLink-certificate-LC-ABCD-2345.pdf');
      expect(this.href).toBe('blob:https://example/1');
    });
    await saveFile(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), 'LifeLink-certificate-LC-ABCD-2345.pdf');
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('hands it to the Android app, which saves it to Downloads', async () => {
    asApp('LifeLinkApp/3');
    const save = vi.fn(async () => { });
    withPlugin(save);
    await saveFile(new Blob(['one\ntwo'], { type: 'text/plain;charset=utf-8' }), 'lifelink-backup-codes.txt');
    expect(save).toHaveBeenCalledWith({ data: btoa('one\ntwo'), name: 'lifelink-backup-codes.txt', type: 'text/plain' });
  });

  it('passes on why the app could not save it', async () => {
    asApp('LifeLinkApp/3');
    withPlugin(async () => { throw new Error('This file is too large to save.'); });
    await expect(saveFile(new Blob(['x'], { type: 'text/csv' }), 'list.csv')).rejects.toThrow('This file is too large to save.');
  });

  it('asks people on an older app build to update', async () => {
    asApp('LifeLinkApp/2');
    withPlugin();
    await expect(saveFile(new Blob(['x'], { type: 'application/pdf' }), 'a.pdf')).rejects.toBeInstanceOf(AppUpdateNeeded);
  });
});
