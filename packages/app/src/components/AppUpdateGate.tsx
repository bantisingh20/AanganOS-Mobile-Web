import { useCallback, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '@shared/services';
import type { AppVersionInfo } from '@shared/api/config';
import { isNativeApp } from '@shared/lib/hooks/useMediaQuery';
import { safeStorage } from '@shared/lib/storage';
import { freshBootstrap } from '@shared/lib/hooks/useBootstrap';

const DISMISSED_KEY = 'aangan.update.dismissedVersionCode';
// Version check: every cold start, then at most every 6 h on resume (it used to run on every resume).
const RECHECK_MS = 6 * 60 * 60 * 1000;
let lastCheckAt = 0;

type Prompt = { kind: 'required' | 'optional'; info: AppVersionInfo } | null;

function readDismissed(): number {
  return Number(safeStorage.get(DISMISSED_KEY) ?? 0) || 0;
}

/**
 * Checks the installed build against GET /api/v1/app-version on start and whenever the app returns
 * to the foreground (Configuration keys app.android.* in admin → Config):
 *  - installed < minVersionCode    → full-screen "Update required" (can't be dismissed)
 *  - installed < latestVersionCode → "Update available" sheet, dismissible once per version
 * Never blocks the app if the check fails (offline, old API): it just stays quiet.
 */
export function AppUpdateGate() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<Prompt>(null);

  const check = useCallback(async () => {
    if (!isNativeApp()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (lastCheckAt && Date.now() - lastCheckAt < RECHECK_MS) return;
    lastCheckAt = Date.now();
    try {
      // Signed in: the startup bootstrap already carries the version info (no separate request).
      const boot = await freshBootstrap();
      const [{ build }, info] = await Promise.all([CapApp.getInfo(), boot?.appVersion ?? appConfig.appVersion('android')]);
      const installed = Number(build) || 0;
      if (!installed || !info) return;
      if (info.minVersionCode > installed) setPrompt({ kind: 'required', info });
      else if (info.latestVersionCode > installed && info.latestVersionCode > readDismissed()) setPrompt({ kind: 'optional', info });
      else setPrompt(null);
    } catch {
      // Version check must never break the app.
    }
  }, []);

  useEffect(() => {
    void check();
    if (!isNativeApp()) return;
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void check(); });
    return () => { void sub.then((h) => h.remove()); };
  }, [check]);

  if (!prompt) return null;
  const { info, kind } = prompt;
  const required = kind === 'required';

  const openUpdate = () => {
    // External URLs open in the system browser / Play Store from the Capacitor WebView.
    if (info.updateUrl) window.location.href = info.updateUrl;
  };
  const dismiss = () => {
    safeStorage.set(DISMISSED_KEY, String(info.latestVersionCode));
    setPrompt(null);
  };

  return (
    <div className={required ? 'fixed inset-0 z-[100] flex items-center justify-center bg-background p-6' : 'fixed inset-0 z-[100] flex items-end bg-black/50'}>
      <div className={required ? 'flex w-full max-w-sm flex-col items-center gap-4 text-center' : 'safe-bottom relative w-full rounded-t-2xl bg-card p-5 shadow-lg'}>
        {!required ? (
          <button type="button" onClick={dismiss} aria-label={t('common.close', 'Close')} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        ) : null}
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Download className="h-7 w-7" />
        </span>
        <div className={required ? '' : 'mt-3'}>
          <h2 className="text-lg font-extrabold">
            {required ? t('update.requiredTitle', 'Update required') : t('update.availableTitle', 'Update available')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {info.updateMessage || (required
              ? t('update.requiredBody', 'This version is no longer supported. Please install the latest version to continue.')
              : t('update.availableBody', 'A new version of AanganOS is available with fixes and improvements.'))}
            {info.latestVersionName ? ` (v${info.latestVersionName})` : ''}
          </p>
        </div>
        <div className={required ? 'w-full' : 'mt-4 flex gap-2'}>
          {!required ? (
            <button type="button" onClick={dismiss} className="h-11 flex-1 rounded-xl border border-border text-sm font-semibold">{t('update.later', 'Later')}</button>
          ) : null}
          <button type="button" onClick={openUpdate} disabled={!info.updateUrl}
            className="h-11 w-full flex-1 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50">
            {t('update.updateNow', 'Update now')}
          </button>
        </div>
      </div>
    </div>
  );
}
