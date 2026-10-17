import { useEffect, useState } from 'react';
import { ANDROID_APP_URL, isNativeApp, nativeAppBuild } from '../lib/app';

// App builds before 2 were signed with a debug key that is public in the repo's
// history, so anyone could make a fake "update" for them. Build 2 onwards is signed
// with LifeLink's private release key. Android treats that as a different app, so
// phones with an old build uninstall it and install the new one once.
const RELEASE_API = 'https://api.github.com/repos/Amit-Singh-2006/Blood-Donation/releases/tags/android-latest';
const RELEASE_KEY_SINCE = Date.parse('2026-10-17T00:00:00Z');
const SNOOZE_KEY = 'lifelink.reinstallSnoozedUntil';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

/** Asks people still on an old app build to reinstall, once the new build is published. */
export default function ReinstallNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isNativeApp() || nativeAppBuild() >= 2) return;
    try {
      if (Number(localStorage.getItem(SNOOZE_KEY)) > Date.now()) return;
    } catch { /* storage unavailable: still ask */ }
    // Only after the download link serves the new build, so nobody reinstalls the old one
    const ctrl = new AbortController();
    fetch(RELEASE_API, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((release) => {
        const apk = release?.assets?.find((a: { name?: string }) => a.name === 'LifeLink.apk');
        if (apk && Date.parse(apk.updated_at) >= RELEASE_KEY_SINCE) setShow(true);
      })
      .catch(() => { /* offline or rate-limited: ask next time */ });
    return () => ctrl.abort();
  }, []);

  if (!show) return null;

  const later = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* storage unavailable */ }
    setShow(false);
  };

  return (
    <div role="dialog" aria-labelledby="reinstall-title" className="fixed inset-x-0 bottom-0 z-100 p-4">
      <div className="max-w-lg mx-auto bg-white border border-red-100 shadow-2xl rounded-2xl p-5 space-y-3">
        <p id="reinstall-title" className="font-black text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ee2b2b]">system_update</span>
          Please reinstall the LifeLink app
        </p>
        <p className="text-sm text-slate-600">
          This older version of the app could be replaced by a fake update. The new version is signed with LifeLink's private key, so only LifeLink can update it.
        </p>
        <ol className="text-sm text-slate-700 list-decimal ml-5 space-y-1">
          <li>Tap <b>Download the new app</b> below.</li>
          <li>Uninstall this app (hold its icon, then tap Uninstall).</li>
          <li>Open the downloaded LifeLink.apk to install it, then sign in again.</li>
        </ol>
        <div className="flex gap-2">
          <a href={ANDROID_APP_URL} className="flex-1 text-center px-4 py-2.5 rounded-xl bg-[#ee2b2b] text-white text-sm font-black hover:bg-red-700">
            Download the new app
          </a>
          <button type="button" onClick={later} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
