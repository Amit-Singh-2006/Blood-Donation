/** The newest Android app build, published by .github/workflows/android.yml. */
export const ANDROID_APP_URL = 'https://github.com/Amit-Singh-2006/Blood-Donation/releases/download/android-latest/LifeLink.apk';

/**
 * True inside the LifeLink Android app, which shows this same website. The app
 * adds "LifeLinkApp" to its user agent (mobile/capacitor.config.json); older
 * builds are recognised by Capacitor's bridge.
 */
export const isNativeApp = (): boolean =>
  /\bLifeLinkApp\b/.test(navigator.userAgent)
  || !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
