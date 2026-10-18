import { isNativeApp } from './app';

/** The Android app's LifeLinkFiles plugin (mobile/android FilesPlugin), from app build 3. */
interface FilesPlugin {
  save(file: { data: string; name: string; type: string }): Promise<void>;
}

interface CapacitorGlobal {
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: Record<string, unknown>;
}

const appFiles = (): FilesPlugin | undefined => {
  const capacitor = (window as { Capacitor?: CapacitorGlobal }).Capacitor;
  return capacitor?.isPluginAvailable?.('LifeLinkFiles') ? (capacitor.Plugins?.LifeLinkFiles as FilesPlugin | undefined) : undefined;
};

/** Older Android app builds cannot save a file the page made. */
export class AppUpdateNeeded extends Error {
  constructor() {
    super('Saving files needs the newest LifeLink app. Download it, install it over this one, and try again.');
    this.name = 'AppUpdateNeeded';
  }
}

const base64Of = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  // "data:<type>;base64,<data>"
  reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
  reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
  reader.readAsDataURL(blob);
});

/**
 * Saves a file the page made: a certificate, a report, backup codes. A browser
 * downloads it. The Android app's WebView cannot download such files, so the
 * app saves it to Downloads › LifeLink and opens it.
 */
export const saveFile = async (blob: Blob, fileName: string): Promise<void> => {
  const files = appFiles();
  if (files) {
    const type = blob.type.split(';')[0]!.trim() || 'application/octet-stream';
    try {
      await files.save({ data: await base64Of(blob), name: fileName, type });
    } catch (err: any) {
      throw new Error(err?.message || 'The app could not save the file. Check that your phone has free space, then try again.');
    }
    return;
  }
  if (isNativeApp()) throw new AppUpdateNeeded();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
