# Code health: repeated code, crash risks, and release process

Audit of `AanganOS-Mobile-Web` (shared / app / admin) and `AanganOS-Backend`, 27 Nov 2026.
✅ = fixed in this change · ⏳ = still to do.

> **Update (27 Nov 2026, later):**
> - **Section 2 (repeated code): done.** Every item now lives in one shared place:
>   - `lib/format`, `lib/entityFetchers`, `lib/statusTone`, `lib/hooks/useListState`
>   - `components/ui/refresh-button`, `lib/withToast`, `lib/routing#useBackNavigation`
>   - `lib/roles#isAdminRole`, `lib/storage#safeStorage`
>   - `features/auth/useLoginForm` + `passwordRules`
>   - `PageLayout` is deleted; all app screens use `PageShell`.
> - **Section 3:**
>   - 3 (OTP bypass): fixed. The fixed OTP now needs Development **and** `UseDefaultOtp`.
>   - 4 (saved passwords): fixed. No passwords are stored. Sessions persist until logout or another login, and a temporary refresh failure no longer logs the user out.
>   - 5 (signing): wired. `android/keystore.properties` is used when present (a key still has to be created).
>   - 6 (cleartext): fixed. Plain HTTP is allowed only for localhost, 127.0.0.1 and 10.0.2.2, and mixed content is off.
>   - 8 (storage): fixed.
>   - 9 (object URLs): fixed.
>   - 10 (prod build without an https API URL): now fails.
>   - 1 and 2: skipped by decision.
>   - 7 (`useAsync` abort): intentionally kept off; see the comment in `useAsync.ts`.
>   - 11–14: still open.

---

## 1. Fixed in this change

| # | Problem | What changed |
|---|---------|--------------|
| ✅ | **No error boundary.** Any render error unmounted React, so the Android app showed a blank white screen. | `shared/src/components/layout/ErrorBoundary.tsx` wraps both apps in `main.tsx`. Users now get "Something went wrong" with **Reload** / **Go home**. |
| ✅ | **Back-button listener leak.** The listener was re-added on every navigation and the old one sometimes wasn't removed, so one press could go back several pages. | `app/src/lib/useBackButton.ts` registers once and reads the path from a ref. |
| ✅ | **Unhandled promise** in `EntitySelect` (dropdown loading). | Added `.catch`. |
| ✅ | **Debug logs left in.** `HomeScreen` logged the whole `user` object (personal data) and `PageLayout` logged on every render. | Removed. |
| ✅ | **App version never changed** (`versionCode 1` forever), and there was **no way to tell users to update**. | See section 4. |

---

## 2. Repeated code: fix by moving into one shared helper ⏳

Ranked by copies × risk of the copies drifting apart.

| Rank | Repeated code | Copies | Move to |
|---|---|---|---|
| 1 | Org/community dropdown fetchers (`fetchOrg`, `makeCommunityFetch`, `resolveOrgLabel`, `resolveCommunityLabel`) | ~30 functions in 11 files | `shared/src/lib/entityFetchers.ts`, or `<OrgSelect>` / `<CommunitySelect>` components |
| 2 | List-page state (search, page, pageSize, reloadKey) and the Refresh button | ~18 pages | `useListState()` hook + `<RefreshButton>` |
| 3 | `try { … } catch (err) { toast.error(toFormError(err).message) }` with a busy flag | 47 places in 35 files | `useAction(fn, { success })` next to `useAsync` |
| 4 | Date formatting, which **disagrees** between files (`'—'` vs `''` vs raw ISO for empty values) | 16 | `shared/src/lib/format.ts` → `formatDate`, `formatDateTime` |
| 5 | **"Is admin?" rules that disagree.** `roles.ts` counts manager/staff/committee as admin; `usePermission`/`appTiles` don't. A user can see a tile and then be refused on the page. | 3 definitions | One predicate in `usePermission.ts`, used everywhere |
| 6 | `humanize()` | 6 identical copies | `format.ts` |
| 7 | Status → colour maps (`statusTone`, `kycTone`, `billTone`, `STATUS_META` …) | 11 | `shared/src/lib/statusTone.ts` |
| 8 | ₹ money formatting | ~27 places, 8 files | Move the existing `formatAmount` to `format.ts` |
| 9 | Initials | 4 | `format.ts` / an Avatar component |
| 10 | App screens use the app-only `PageLayout`, a second copy of the shared `PageShell` | 15 screens | Move them to `PageShell`, then delete `PageLayout` |
| 11 | Login submit logic duplicated in app and admin; password rules disagree (min 6 vs 8); two country lists for phone numbers | 2–4 each | `useLoginForm()`, one `PASSWORD_RULES`, `PhoneField` reads `lib/countries.ts` |
| 12 | Hard-coded English ("Refresh" ×15, "Back" ×6, toasts, `window.confirm`) | many | i18n keys (`common.refresh`, `common.back` …) |

---

## 3. Crash and security risks still open ⏳

**Critical (backend / data):**
1. **The Development config points at the production database with the `sa` login.** Running the API locally (Visual Studio / `dotnet run`) runs `EnsureCreated`, schema auto-sync and all pending SQL scripts against production. It also starts the email and push workers, which can send real messages. → Point Development at a local DB, use a least-privilege login, and make auto-migration an explicit opt-in.
2. **Live secrets in plain text** in `appsettings.Development.json`: DB password, SMTP password, OneSignal key, JWT key. The file isn't in git (good), but it is on disk beside build outputs. → Rotate them; use user-secrets or environment variables.
3. **OTP bypass.** In Development, or with `UseDefaultOtp: true`, a fixed OTP logs in to any account. Combined with item 1, that is real accounts. → Refuse to start if the bypass is on outside Development.
4. **Saved passwords** in the app are kept in `localStorage`, only base64-encoded. → Use secure storage (Android Keystore) or keep only a refresh token.

**Android release:**

5. Release APKs are signed with the **debug key**, and minification is off. → Create a release keystore (`keystore.properties`, kept out of git) and turn on R8. ⚠️ Changing the signing key means users must uninstall once, so do it **once, soon**, before more people install.
6. Cleartext HTTP and mixed content are allowed in production. → Allow cleartext only for `localhost` (dev) in `network_security_config.xml`; set `allowMixedContent: false`.

**Frontend robustness:**

7. `useAsync` no longer cancels requests when you leave a screen, because the abort is commented out. → Restore it.
8. `localStorage` is read without try/catch in `CommonEntitySelector`, `i18n/index.ts` and `tokenStore.ts`; it can throw in private mode or when storage is full. → Wrap it in a small `safeStorage` helper.
9. Image object URLs are never released in `MyVisitorsScreen`. → `URL.revokeObjectURL` on unmount.
10. A production build without `.env.production` silently calls `http://localhost:5272`. → Fail the build if `VITE_API_BASE_URL` is missing.

**Backend ops:**

11. CORS allows only localhost unless env vars are set on the server. Document this or add `appsettings.Production.json`.
12. Demo endpoints (`/pipeline-demo/*`) are live in production. Limit them to Development.
13. IIS stdout logging is on with no limit, so logs grow forever.
14. Several API instances can run the same migration at once. Add `sp_getapplock`.

---

## 4. Releasing a new Android version (new process)

**One-time setup is done:**
- `packages/app/package.json` → `"version"` is the single version number (now `1.0.0`).
- Gradle derives `versionName` (e.g. 1.0.3) and `versionCode` (major×10000 + minor×100 + patch = 10003) from it.
- The public API `GET /api/v1/app-version?platform=android` reads five settings from **admin → Config** (seeded by migration `00000007_app_version_config.sql`).
- The app checks on start and whenever it comes back to the foreground (`app/src/components/AppUpdateGate.tsx`):
  - installed `versionCode` < `app.android.minVersionCode` → full-screen **Update required** (cannot be skipped)
  - installed `versionCode` < `app.android.latestVersionCode` → **Update available** sheet with *Later*, shown once per version
  - if the check fails (offline, old API) → nothing; the app is never blocked by the check itself

**Every release:**
1. Run `build-release-apk.bat`. It bumps the patch version automatically and writes `release-build\AanganOS-<version>.apk` (plus the usual `AanganOS-Release.apk`). At the end it prints the exact Config values to set.
2. Upload the APK somewhere users can download it, or publish it to Play Store.
3. In **admin → Config**, set:
   - `app.android.latestVersionCode` and `app.android.latestVersionName` (printed by the script)
   - `app.android.updateUrl`: the download link
   - optional `app.android.updateMessage`
4. Only for breaking changes (e.g. an API change old builds can't handle), also raise `app.android.minVersionCode`, which forces everyone to update.

For a bigger release, edit the version by hand first (e.g. `"version": "1.1.0"`); the script still bumps the patch on top of it.

---

## 5. Rules to stop this coming back

- **No new local helpers** for dates, money, status colours, org/community dropdowns, or "is admin". Import from `shared/src/lib`. If it doesn't exist yet, add it there.
- **Permissions come from the route** (`usePermission()`), never from hard-coded keys or role regexes in pages.
- **New pages use `PageShell` + `FilterBar` + `DataList`**; dialogs use the shared `Dialog` (bottom sheet on phones).
- **Every async call in an event handler** goes through `useAsync` / `useAction`, or has a `catch`.
- **No `console.log`** in committed code. Use `console.warn` / `console.error` only for real problems.
- **Never run the backend locally against the production database.**
