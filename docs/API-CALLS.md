# API calls: what each screen calls, what's wasted, and the fix

Static trace of `packages/shared`, `packages/admin` and `packages/app` (27 Nov 2026). Counts are per real user session.
In **dev builds** every number doubles: React StrictMode runs effects twice and `useAsync` doesn't cancel.

---

## 0. The one problem that matters most

**A session check calls `GET /notifications/unread-count` every 3 seconds, and throws the answer away.**
`shared/src/store/AuthContext.tsx:63` → `setInterval(verifySession, 3000)`, plus once more on every window `focus` and `visibilitychange`.

| | Calls per hour (1 open tab / app in foreground) |
|---|---|
| This heartbeat | **~1,200**, more than every other call in both apps combined |
| Everything else, normal use | roughly 50–150 |

It also keeps firing while offline. If the server is down, each failure also triggers a native `/health` probe, which doubles the calls. And when the 24 h access token expires, every tick starts a token refresh.
**Fix:** delete the 3 s timer. Ended sessions are already caught by any normal 401 (see `api/client.ts`). Keep **one** unread-count poll every 60 s while the screen is visible and online, and use it for both the badge and the session check.

---

## 1. Admin website

### After login
| Call | When | Note |
|---|---|---|
| `POST /auth/login` | once | Already returns name, roles, permissions, org and community |
| `GET /menu` | once (cached) | OK |
| `GET /notifications/unread-count` | **×2 at the same moment** (heartbeat + AdminShell badge), then every 3 s **and** every 120 s | Three sources for one number |
| `GET /announcements?pageSize=4`, `GET /notifications?pageSize=6` | Dashboard mount | The 6 notifications are loaded again when the bell opens |

### Every page (shell)
- unread-count every 3 s (heartbeat) + every 120 s (AdminShell) + on each bell open; `GET /notifications?pageSize=50` on every bell open.
- If `GET /menu` ever fails, every page change retries it (the failure isn't cached).
- **Searches aren't debounced**, so every keystroke on a list page sends a request.

### First load of each page
| Page | Calls | Wasted |
|---|---|---|
| Dashboard | 2 | All KPI tiles are hard-coded `null`; the notifications list duplicates the bell |
| Organizations | 2 | — |
| Communities | 1 | — |
| Units | 3 | **`GET /communities/{id}` on every render** while a community is selected (see bug A) |
| People / Residents | 2 | `roles.list(100)` refetched on every reload |
| Admin users | 2 | `roles.list(100)` again |
| Roles | 5 | `roles.list` called twice; `roles.get(id)` called **twice** for data already in the list |
| Announcements | 2 + label lookups | Bug A |
| Help desk list | 4 + label lookups | Bug A |
| New ticket | 3 | Same `Ticket_*` lists fetched again under a different cache key |
| Ticket details | 3 (+1 per attachment) | Could be 1 call |
| Billing | 1–3 per tab | Bug A on the Bills tab |
| Amenities / Visitors | 3 / 3 | Bug A |
| Menu mgmt / Master data | 1 / 3 | `menuItems.list` fetched by 3 pages, never cached |
| Config | 3 | Downloads **500 orgs + 500 communities** just to show names |
| Notifications / Templates / Error logs / Comm test | 1 each | — |

**Bug A: the community dropdown refetches on every render.** Seven places pass `makeCommunityFetch(orgId)` inline (Announcements, Help desk, Bills, Units, Amenities, UserFormDialog, AdminUserFormDialog). That creates a new function each render, so `EntitySelect` clears its items and looks the selected community's name up again with `GET /communities/{id}`. Scoped admins always have a community selected, so this happens on every keystroke and page change.

---

## 2. Android app

### After login
`POST /auth/login` (always sends `platform: 'web'`, never the push player ID) → heartbeat starts → `POST /devices` after up to 6 s of waiting for OneSignal → Home (below).
Push device registration runs **only after login, never on app start**, so a changed push token is never sent again.

### App start / resume
| Call | When |
|---|---|
| `GET /app-version` | start **and every resume** |
| unread-count | start, every 3 s, ×2 on each resume (focus + visibilitychange) |
| `GET /menu` | once per cold start (cached) |

### Home (every time it's shown)
`HomeScreen`: `GET /residents/me` (cached 15 min; uses only name + unit number, both already in the login data) + unread-count **again on every tab switch**.
`DashboardTab`: **7 calls on every mount**, re-run each time the user goes Home → Services → Home:
- `my-tasks/summary`
- `announcements?pageSize=3`
- `tickets?status=new`, `?status=in_progress`, `?status=resolved` (pageSize 1 each, only to read `totalCount`)
- `tickets?sort=…` (latest ticket)
- `maintenance-bills/me?pageSize=3`. This is used to add up dues, so **the total is wrong when more than 3 bills are unpaid**. `/maintenance-bills/me/due` exists for this.

These run even when the user can't see those sections (e.g. security guards), so they're wasted calls and likely 403 errors.
`ProfileTab`: `residents/me` with `forceRefresh` on every visit (bypasses the cache).

### Screens
| Screen | Calls | Wasted |
|---|---|---|
| My Visitors / Approvals | 2 + **1 per visitor photo (up to 50)** | Photos are N+1 |
| Ticket details | 3 + 1 per attachment | N+1 |
| My Household | 2 + **3 per unit** | — |
| My Tasks | 3 | Summary duplicates Dashboard |
| My Maintenance | 1 | Overlaps Dashboard |
| Invite visitor | 3 | Onboarding config refetched every time |
| New ticket / Walk-in / Watchlist | 3–4 | Master-data list fetched twice (before and after community loads) |
| People screens | 3 | roles refetched |
| Others | 1–2 | — |

Other: marking notifications read doesn't update the Home badge. Master-data cache isn't cleared on logout, so a different account sees the first account's lists until restart.

---

## 3. One startup API: yes, recommended

Add **`GET /api/v1/session/bootstrap`** (or extend `GET /auth/me`), called once after login, on cold start and on resume (throttled):

| Returns | Replaces |
|---|---|
| user, roles, permissions, org/community names | `residents/me` on Home and Profile |
| menu tree (with permission resources) | `GET /menu` |
| unread notification count | first unread-count calls |
| task summary, ticket counts + latest ticket, amount due, 3 latest notices | the 7 Dashboard calls |
| app-version info | `GET /app-version` on cold start |
| common master-data lists (ticket, unit, visitor, amenity categories/statuses) | 3–6 `masterData` calls per screen |

**App:** about 12 calls → 1 per cold start / Home load. **Admin:** about 15–20 calls fewer per session.
Detail pages keep their own calls; bootstrap only covers what every session needs.

---

## 4. Fix list, ranked by calls saved

> **Status (27 Nov 2026):** fixes **1–8 are done.**
> - The 3 s heartbeat is gone. One shared count (`lib/hooks/useUnreadCount.ts`) polls every 60 s, only while visible and online, and that call is also the session check.
> - The community fetcher is stable per organization, and names are cached.
> - Search is debounced once, in `FilterBar`.
> - Home tabs stay mounted once opened.
> - Dashboard calls are skipped for hidden sections, and dues are computed from up to 50 bills.
> - Roles, menu items and onboarding config are cached per session and cleared on change, Refresh or account switch. Each role is loaded once instead of twice.
> - The app-version check runs at most every 6 h and never offline.
> - Also: the master-data, roles, menu-items and name caches are cleared on login and logout (from #12).
>
> **Still open:** 10–11, and #12's push-ID-at-login and device re-registration on cold start.
>
> **#9 done: startup bootstrap.** `GET /api/v1/auth/me?include=bootstrap&platform=android&masterData=Ticket_Status,Ticket_Category,Ticket_Priority`
> returns the menu, unread count, task summary, resident profile (only with Resident:View), app-version info and the requested
> master-data lists. Each section is loaded on its own; a failing section comes back `null`. Plain `/auth/me` is unchanged.
> - Frontend: `lib/hooks/useBootstrap.ts` calls it once per login or app start. It fills the menu, unread-count, master-data and
>   profile caches; Home task counts and the update check reuse it while it is less than 1 minute old.
> - If the API is older or the call fails, every screen falls back to its own request.
> - It replaces 6 startup calls: `/menu`, `/notifications/unread-count`, `/residents/me`, `/my-tasks/summary`,
>   `/app-version` and 3× `/master-data/Ticket_*`.
> - Dashboard tickets, bills and notices are **not** bundled: those endpoints carry per-feature permissions (see the security note below).
>
> ⚠️ **Security note found while building this:** `PermissionAuthorizationMiddleware` has its permission check commented out
> ("role-based access is managed in the client layer"), so every `[RequirePermission]` endpoint accepts any signed-in user.
> Re-enabling it needs a per-role test pass; tracked as a separate task.

| # | Fix | Saves | Size |
|---|---|---|---|
| 1 | Remove the 3 s heartbeat; one 60 s unread poll only while visible & online | **~1,150 / hour / user** | small |
| 2 | One shared unread-count store (heartbeat, AdminShell, Home tabs, mark-read) | 30+/hour, 1 per tab switch | small |
| 3 | Memoize the community fetcher (bug A) + cache org/community name lookups | 5–20 per filtered page | small |
| 4 | Debounce list search (300 ms) in `useListState` | 5–10 per search | small |
| 5 | Keep Home tabs mounted / cache Dashboard data, refresh on resume | 7 per return to Home | small |
| 6 | Skip Dashboard calls the user can't see; use `me/due` for dues (also fixes wrong total) | up to 6 per Home load | small |
| 7 | Cache `roles.list`, `menuItems.list`, onboarding config per session; fix Roles page double calls | 2–4 per admin page | small |
| 8 | Throttle `app-version` to every 6 h; pause polling offline / in background | 1 per resume, all offline calls | small |
| 9 | Bootstrap endpoint (section 3) | ~12 per app start, ~15–20 per admin session | medium (backend + both apps) |
| 10 | Ticket counts in one call; Config page names from the API instead of 1,000 rows | 3 per Home load, 2 heavy calls | medium |
| 11 | Photo/attachment thumbnails or signed URLs in list responses | up to 50 per Visitors screen | medium |
| 12 | Send push player ID at login; re-register device on cold start; clear master-data cache on logout | correctness | small |
