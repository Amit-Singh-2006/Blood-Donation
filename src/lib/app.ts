/** The newest Android app build, published by .github/workflows/android.yml. */
export const ANDROID_APP_URL = 'https://github.com/Amit-Singh-2006/Blood-Donation/releases/download/android-latest/LifeLink.apk';

/** True inside the LifeLink Android app, which shows this same website. */
export const isNativeApp = (): boolean =>
  !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
