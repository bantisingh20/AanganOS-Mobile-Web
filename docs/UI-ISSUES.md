# UI issues: resident app and admin

Captured on a Xiaomi Redmi Note 9 (Android 12, 1080×2340) with the production API, 26 Nov 2026.
Status (27 Nov 2026): **Helpdesk and Maintenance billing moved onto shared responsive blocks**
(`packages/shared/src/components/layout`: PageShell, FilterBar, DataList, ResponsiveTabs;
`useIsCompact()` + `<SurfaceProvider>`). That addresses 1.1–1.4 and 1.8. 1.5 and 1.6 are now
permission-based (`usePermission()` resolves the route's DB menu row), so a Society Admin sees the same controls in app and admin.
1.7: the priority dot now has its label next to it. Still to check on device: everything below.

Legend: **[A]** app only · **[S]** shared component (fix once, affects app and admin) · **?** needs a product decision

---

## 1. Helpdesk: ticket list

Component: `packages/shared/src/features/helpdesk/TicketsListPage.tsx` [S]

| # | Issue | Fix idea |
|---|-------|----------|
| 1.1 | Filter panel uses a wrapping desktop layout. The search box takes only ~60% of the width and leaves empty space on the right. | Full-width search on mobile. |
| 1.2 | "All communities" takes half the row, and "Total: 1 · refresh · + New" floats to its right, not lined up with it. | Move Total, refresh and New into their own row, or into the header. |
| 1.3 | The Category and Status dropdowns don't fill their row and leave empty space on the right. | Two-column grid (`grid-cols-2`) on mobile. |
| 1.4 | Controls don't match. The search box is about 60px tall and pill-shaped; the dropdowns are 90–96px tall with rounded corners. **Root cause:** `h-7.5` / `w-7.5` are not Tailwind 3 sizes and aren't defined in our config, so the browser ignores them (82 + 21 uses across `shared`, `app` and `admin`). | One control-height token in the Tailwind preset, used by every input. |
| 1.5 | ? The "All communities" filter appears for a resident, who belongs to only one community. | Hide it in the resident app. |
| 1.6 | ? The ticket card has an editable status dropdown ("Waiting"). Should a resident be able to change status? | For residents, show a read-only status badge. |
| 1.7 | The grey dot before the ticket title has no label or legend. | Remove it, or turn it into a priority/status chip with text. |
| 1.8 | The "10 / page" size picker and numbered pagination feel like desktop on a phone. | Mobile: "Load more" or infinite scroll. Admin: keep the pager. |

---

<!-- more screens below as they are captured -->
