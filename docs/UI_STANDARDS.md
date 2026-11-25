# AanganOS Admin UI & Design System Standards

This document establishes the official enterprise design language and UI standards for all admin and management pages across AanganOS (Units, Communities, Organizations, etc.).

---

## 1. Core Principles

1. **High Information Density & Compact Sizing**:
   - Avoid oversized typography and massive whitespace. Enterprise workflows require quick scanning and compact data density.
2. **Rectangular Buttons with Minor Curve**:
   - Strictly use **`rounded-[4px]`** for all buttons, inputs, and dropdown triggers (and **`rounded-[3px]`** for small row icon buttons).
   - Use `rounded-md` (6px) or `rounded-lg` (8px) **only** for outer table/page container boxes.
   - **Never** use exaggerated curves (`rounded-2xl`, `rounded-3xl`, `rounded-full` for cards/inputs/buttons).
3. **No Disconnected Floating White Cards**:
   - Avoid stark white elevated cards with heavy shadows (`shadow-xl`) that feel detached from the canvas.
   - Use subtle borders (`border border-border/80`) and contextual background tones (`bg-card`, `bg-card/60`, `bg-muted/30`).
4. **Dual Responsive Architecture (Desktop Table + Mobile Cards)**:
   - On Desktop/Tablet (`>= md`): Dense, scrollable enterprise `<Table>`.
   - On Mobile / Small Screen (`< md`): Clean, stacked card list (`md:hidden divide-y divide-border/60`).
5. **Concise, Lean Code**:
   - Keep page files under 250–350 lines. Avoid redundant nested HTML wrappers and duplication.

---

## 2. Typography Standard

| Element | Tailwind Classes | Description |
|---|---|---|
| **Page Title** | `text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5` | Crisp 14px header with inline 14px icon (`h-3.5 w-3.5 text-primary`) |
| **Page Subtitle** | `text-[11px] text-muted-foreground leading-tight` | Secondary helper text |
| **Table Headers** | `text-[10.5px] font-semibold text-muted-foreground` | Uppercase or small title styling with tight padding |
| **Table Cells** | `text-xs text-foreground` | 12px clean data presentation |
| **IDs / Hash / Meta** | `font-mono text-[9px] text-muted-foreground` | Monospaced technical IDs |
| **Field Labels** | `mb-1 block text-xs font-medium text-foreground` | Symmetrical form labels |
| **Badges / Chips** | `text-[10px] px-1.5 py-0 rounded-[3px]` | Ultra-compact status chips |

---

## 3. Element Sizing & Component Specifications

### A. Top Page Bar (Header & Actions)
- Container: `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5`
- Primary & Secondary Action Buttons:
  - Shape: Rectangular with minor curve: **`rounded-[4px]`**
  - Height: `h-7 px-2.5 text-[11px] font-medium`
  - Icons: `h-3 w-3`
  - Outline button: `border-border/80`

### B. Filter & Search Bar
- Container: `flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card/60 p-1.5 text-xs`
- Search Input: `h-7.5 w-full rounded-[4px] pl-7 pr-2 text-[11px] bg-background` with `h-3 w-3` search icon
- Dropdown Selectors (`EntitySelect`, Radix `Select`):
  - Height: `h-7.5 text-[11px] rounded-[4px]`
  - EntitySelect class: `[&>button]:h-7.5 [&>button]:rounded-[4px] [&>button]:text-[11px] [&>button]:px-2`
  - Radix SelectTrigger: `h-7.5 w-28 rounded-[4px] text-[11px] bg-background px-2`
- Total Count Indicator: `text-[11px] text-muted-foreground`
- Refresh Button: `h-7.5 w-7.5 p-0 rounded-[4px] border-border/80` with `h-3 w-3` icon

### C. Data Container (Table & Mobile Cards)
- Outer Box: `rounded-md border border-border/80 bg-card overflow-hidden`
- **Desktop Table** (`hidden md:block overflow-x-auto`):
  - `TH`: `py-1.5 px-2 text-[10.5px] font-semibold`
  - `TD`: `py-1 px-2 text-xs`
  - Avatar / Icon block: `h-5.5 w-5.5 rounded-[3px] bg-primary/10 text-primary` with `h-3 w-3` icon
  - Row Action Buttons: `h-6 w-6 rounded-[3px] border border-border/80 text-muted-foreground` with `h-3 w-3` icons
- **Mobile Cards** (`md:hidden divide-y divide-border/60`):
  - Card Item: `p-2.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors`
  - Symmetrical rows: Title + ID on left, Status badge on right; chips/meta below; Edit/Delete buttons bottom right
- **Integrated Pagination Footer**:
  - Container: `border-t border-border px-2.5 py-1 bg-muted/20`
  - Page Size Dropdown: **shadcn `Select`** trigger at **`h-6 w-[88px] rounded-[4px] text-[11px]`**, with content popover at **`min-w-[88px] w-[88px]`** and items at `py-1 pl-2 pr-5 text-[11px]`.
  - Pagination Buttons (Prev, Next, Numbers): Rectangular **`rounded-[4px]`**, sized at **`h-6.5 w-6.5 text-[11px]`**.

### D. Dialogs & Modals (Create / Edit)
- Dialog Container: `<Dialog open={open} onClose={onClose} className="max-w-md rounded-lg p-5">` (8px enterprise radius, never bubbly rounded-2xl)
- Form Fields:
  - Form Gap: `flex flex-col gap-3 pt-1`
  - Text Inputs: `h-9 text-xs rounded-[4px]`
  - Select Dropdowns: `SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background"`
  - EntitySelect: `className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3"`
  - Field Labels: `mb-1 block text-xs font-medium text-foreground`
- Footer Action Buttons:
  - Container: `mt-5 pt-3.5 border-t border-border/70 flex items-center justify-end gap-2.5`
  - Buttons: Rectangular `h-8.5 px-4 rounded-[4px] text-xs font-medium`
  - Cancel: `variant="outline" className="border-border/80"`
  - Submit: `className="h-8.5 px-4 rounded-[4px] text-xs font-medium"`

### E. Admin Header & Sidebar Responsive Standard
- **Sidebar Container & Sizing**:
  - Desktop Expanded: `w-60 shrink-0 border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900`
  - Desktop Collapsed: `w-[68px]` with centered icon rows
  - Mobile Drawer: `w-72 max-w-[82%] bg-white shadow-xl dark:bg-slate-900`
- **Sidebar Header**:
  - Logo: `h-8 w-8 shrink-0 rounded-[4px] object-cover ring-1 ring-emerald-500/20` with explicit `width={32} height={32} style={{ width: 32, height: 32 }}`.
  - Brand Title: `text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100` with emerald `OS`
  - Badge / Subtitle: `text-[8px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400`
- **Mobile Header Logo**:
  - Always specify explicit pixel bounds: `width={26} height={26} style={{ width: 26, height: 26 }}` and `className="h-[26px] w-[26px] shrink-0 rounded-[4px] object-cover ring-1 ring-emerald-500/20"` to guarantee the high-resolution source image never blows up to intrinsic size.
  - Text: `text-sm font-bold tracking-tight` (`Aangan` in slate, `OS` in emerald-600).
- **Sidebar Navigation Rows (`SidebarNav`)**:
  - Group Headers: `px-2.5 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400/90 dark:text-slate-500`
  - Nav Item: `h-8 w-full gap-2.5 px-2.5 text-xs font-medium rounded-[4px] transition-colors`
  - Active Item: `bg-emerald-600 text-white font-semibold shadow-xs rounded-[4px]`
  - Inactive Item: `text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 rounded-[4px]`
  - Icons: `h-4 w-4 shrink-0` (sub-items: `h-3.5 w-3.5`)
  - Submenu Tree: `ml-3.5 mt-0.5 flex flex-col gap-0.5 border-l border-slate-200/80 pl-2 dark:border-slate-800`
  - Collapsed Items: `h-8.5 w-8.5 mx-auto justify-center rounded-[4px]`
- **Sidebar Footer**:
  - Bottom strip with system status / version `v0.1.0` and a compact sidebar collapse toggle button `rounded-[4px]`.
- **Top Header Bar & Dropdowns**:
  - Header Action Buttons (Menu, Collapse, Notifications, Help): `h-8 w-8 rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors` with compact `h-4 w-4` icons.
  - Theme Toggle: `h-8 w-8 rounded-[4px]` with `h-4 w-4` Moon / Sun icon.
  - Language Switcher: `h-8 w-auto gap-1.5 rounded-[4px] border border-border/80 bg-card px-2 text-xs font-medium shadow-xs`.
  - Profile Chip Trigger (`UserPill`):
    - Container: `h-8 flex items-center gap-2 rounded-[4px] border border-border/80 bg-card/60 px-2 hover:bg-accent/50 text-slate-700 dark:text-slate-200 transition-colors shadow-xs`
    - Avatar: `h-6 w-6 shrink-0 rounded-full bg-emerald-600 text-[11px] font-semibold text-white shadow-xs` (strictly circular with `shrink-0` to prevent stretching).
    - Typography: Symmetrical `leading-none` with name (`text-xs font-semibold text-foreground`) and role (`text-[9.5px] text-muted-foreground`).
    - Chevron: `h-3 w-3 shrink-0 text-muted-foreground/70` rotating 180° when open.
  - Dropdown Menus (User, Notifications): `rounded-[6px] border border-border bg-card shadow-lg p-1`
  - Dropdown Menu Items: `rounded-[4px] px-2.5 py-1.5 text-xs font-medium`
  - Desktop (`>= md`): Displays ThemeToggle, LanguageSwitcher (`rounded-[4px]`, compact `h-8.5 text-xs`), and Help icon `(?)`.
  - Small Screens / Mobile (`< md`):
    - Help icon `(?)`: Hidden (`hidden md:flex`).
    - Header Theme & Language: Hidden (`hidden md:flex`).
    - Inside Profile Dropdown (`UserPill`): Mobile section (`md:hidden`) with Theme toggle and Language switcher.

### F. File Line Count Constraint
- Keep all page files and component files **strictly < 400 lines**.
- Extract dialogs, permissions tabs, or helpers into dedicated sub-folders (e.g. `pages/units/`, `pages/orgs/`, `pages/roles/`) whenever files approach this threshold.
