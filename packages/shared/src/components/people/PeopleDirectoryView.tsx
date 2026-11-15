import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, Plus, Pencil, Trash2, Search, Phone, Mail, Home,
  Ban, CheckCircle, RefreshCw, Table as TableIcon, LayoutGrid
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@shared/components/ui/badge';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { SmartFormDrawer } from '@shared/components/ui/smart-form-drawer';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { SelectField } from '@shared/components/SelectField';
import { PhoneField } from '@shared/components/PhoneField';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { Pagination } from '@shared/components/ui/pagination';
import { AdaptiveShell } from '@shared/components/layout/AdaptiveShell';
import { residents, users, communities, units } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import type { UserStatus } from '@shared/api/users';
import { useAsync } from '@shared/lib/useAsync';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

const ROLE_RESIDENT = 'owner';
const ROLE_SECURITY = 'security';

const communityNameCache = new Map<string, { name: string; organizationId?: string }>();

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function makeCommunityFetch(organizationId?: string) {
  return async (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> => {
    const trimmed = search.trim();
    const d = await communities.list(
      { search: trimmed || undefined, page, pageSize },
      organizationId ? { organizationId } : {},
      { signal },
    );
    d.items.forEach((item) => communityNameCache.set(item.id, { name: item.name, organizationId }));
    return { items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount };
  };
}

async function resolveCommunityLabel(id: string, signal: AbortSignal): Promise<string | null> {
  const cached = communityNameCache.get(id);
  if (cached?.name) return cached.name;
  try {
    const c = await communities.get(id, { signal });
    communityNameCache.set(id, { name: c.name, organizationId: c.organizationId });
    return c.name;
  } catch {
    return null;
  }
}

export interface PeopleDirectoryViewProps {
  /**
   * If true, shows standalone back button for sub-screen flow.
   */
  standalone?: boolean;
}

export function PeopleDirectoryView({ standalone = false }: PeopleDirectoryViewProps) {
  const { t } = useTranslation();
  const scope = useScope();
  const isSmall = useIsSmallScreen();

  const [tab, setTab] = useState<'all' | 'resident' | 'security'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [desktopView, setDesktopView] = useState<'table' | 'cards'>('table');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Resident | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Resident | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, UserStatus>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const effectiveCommunityId = scope.scopedCommunityId ?? undefined;

  const query = useAsync(
    (signal) => residents.list(
      { search: search.trim() || undefined, page, pageSize },
      {
        ...(tab !== 'all' ? { residentType: tab === 'resident' ? ROLE_RESIDENT : ROLE_SECURITY } : {}),
        ...(effectiveCommunityId ? { communityId: effectiveCommunityId } : {}),
      },
      { signal },
    ).catch(() => null),
    [search, tab, effectiveCommunityId, page, pageSize, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const totalCount = query.data?.totalCount ?? 0;
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const toggleLogin = async (r: Resident) => {
    if (!r.userId || togglingId) return;
    const currentStatus = statusMap[r.userId] ?? (r.loginStatus as UserStatus) ?? 'Active';
    const next: UserStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';
    setTogglingId(r.userId);
    try {
      await users.update(r.userId, { status: next });
      setStatusMap((prev) => ({ ...prev, [r.userId!]: next }));
      toast.success(next === 'Suspended' ? t('users.loginSuspended', 'Login suspended') : t('users.loginReactivated', 'Login reactivated'));
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setTogglingId(null);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      if (confirmDelete.userId) await users.remove(confirmDelete.userId).catch(() => undefined);
      await residents.remove(confirmDelete.id);
      toast.success(t('users.deleted', 'Person removed successfully'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const AddButton = (
    <Button
      type="button"
      onClick={() => setCreating(true)}
      className="flex items-center gap-1.5 h-9 rounded-xl bg-primary px-3 text-xs font-bold text-white hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
    >
      <Plus className="h-4 w-4" />
      <span>{t('users.addPerson', 'Add Person')}</span>
    </Button>
  );

  return (
    <AdaptiveShell
      title={t('managePeople.title', 'Manage People')}
      subtitle={t('managePeople.subtitle', 'Society residents, tenants & staff')}
      showBack={standalone}
      rightAction={AddButton}
    >
      <div className="flex flex-col gap-4">
        {/* Top Control Bar: Tabs + Search + View Switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Filter Pill Tabs */}
          <div className="flex rounded-full bg-muted p-1 sm:max-w-md">
            {[
              { id: 'all', label: t('users.allPeople', 'All People') },
              { id: 'resident', label: t('users.residents', 'Residents') },
              { id: 'security', label: t('users.securityStaff', 'Security Staff') },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setTab(item.id as any); setPage(1); }}
                className={cn(
                  'flex-1 rounded-full py-1.5 px-3 text-xs font-bold transition-all',
                  tab === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Search Bar + Desktop View Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t('users.searchPlaceholder', 'Search by name or phone…')}
                className="h-9.5 w-full rounded-2xl bg-card border border-border/70 pl-9 pr-8 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              ) : null}
            </div>

            {/* Desktop Table/Grid Switcher */}
            {!isSmall ? (
              <div className="flex items-center rounded-xl border border-border/70 bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setDesktopView('table')}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                    desktopView === 'table' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                  title="Table View"
                >
                  <TableIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDesktopView('cards')}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                    desktopView === 'cards' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                  title="Card View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={reload}
              className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', query.loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Content View: Data Table on Desktop (if desktopView === 'table') OR Mobile Cards */}
        {query.loading && items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t('common.loading', 'Loading people…')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-bold text-muted-foreground">{t('users.noPeopleFound', 'No people found')}</p>
            <p className="text-xs text-muted-foreground/80">{t('users.addTip', 'Tap "+ Add Person" above to add a resident or staff member.')}</p>
          </div>
        ) : !isSmall && desktopView === 'table' ? (
          /* =========================================================================
             1. DESKTOP DATA TABLE
             ========================================================================= */
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
            <Table>
              <THead>
                <TR className="border-b border-border/60 bg-muted/40">
                  <TH className="py-3 px-4 text-xs font-bold uppercase tracking-wider">{t('users.person', 'Person')}</TH>
                  <TH className="py-3 px-4 text-xs font-bold uppercase tracking-wider">{t('users.role', 'Role')}</TH>
                  <TH className="py-3 px-4 text-xs font-bold uppercase tracking-wider">{t('users.community', 'Wing / Tower')}</TH>
                  <TH className="py-3 px-4 text-xs font-bold uppercase tracking-wider">{t('users.contact', 'Contact')}</TH>
                  <TH className="py-3 px-4 text-xs font-bold uppercase tracking-wider">{t('users.loginStatus', 'Login')}</TH>
                  <TH className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider">{t('common.actions', 'Actions')}</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((r) => {
                  const loginStatus = r.userId ? (statusMap[r.userId] ?? r.loginStatus ?? 'Active') : null;
                  const isSecurity = r.residentType?.toLowerCase() === 'security';

                  return (
                    <TR key={r.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <TD className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs',
                              isSecurity ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary',
                            )}
                          >
                            {initials(r.name)}
                          </span>
                          <span className="font-bold text-sm text-foreground">{r.name}</span>
                        </div>
                      </TD>

                      <TD className="py-3 px-4">
                        <Badge tone={isSecurity ? 'warning' : 'info'}>
                          {isSecurity ? 'Security' : r.residentType || 'Resident'}
                        </Badge>
                      </TD>

                      <TD className="py-3 px-4 text-xs text-muted-foreground">
                        {r.communityName || '—'}
                      </TD>

                      <TD className="py-3 px-4 text-xs">
                        <div className="flex flex-col gap-0.5">
                          {r.phone ? (
                            <a href={`tel:${r.phone}`} className="flex items-center gap-1 font-semibold text-foreground hover:text-primary">
                              <Phone className="h-3 w-3 text-primary" /> {r.phone}
                            </a>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                          {r.email ? (
                            <span className="flex items-center gap-1 text-muted-foreground truncate">
                              <Mail className="h-3 w-3 text-muted-foreground/60" /> {r.email}
                            </span>
                          ) : null}
                        </div>
                      </TD>

                      <TD className="py-3 px-4">
                        {loginStatus ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full',
                              loginStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600',
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', loginStatus === 'Active' ? 'bg-emerald-500' : 'bg-rose-500')} />
                            {loginStatus}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/70">No login</span>
                        )}
                      </TD>

                      <TD className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.userId ? (
                            <button
                              type="button"
                              disabled={togglingId === r.userId}
                              onClick={() => toggleLogin(r)}
                              className={cn(
                                'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all active:scale-95',
                                loginStatus === 'Suspended'
                                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40'
                                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/40',
                              )}
                              title={loginStatus === 'Suspended' ? 'Reactivate Login' : 'Suspend Login'}
                            >
                              {loginStatus === 'Suspended' ? <CheckCircle className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                              <span>{loginStatus === 'Suspended' ? 'Reactivate' : 'Suspend'}</span>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => setEditing(r)}
                            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-border text-primary hover:bg-primary/10 active:scale-95 transition-all"
                            title="Edit Person"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDelete(r)}
                            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 active:scale-95 transition-all dark:border-rose-800 dark:hover:bg-rose-950/40"
                            title="Delete Person"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <div className="p-3 border-t border-border/60">
              <Pagination page={page} pageSize={pageSize} total={totalCount} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          </div>
        ) : (
          /* =========================================================================
             2. MOBILE & CARD VIEW (Touch-friendly cards)
             ========================================================================= */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => {
              const loginStatus = r.userId ? (statusMap[r.userId] ?? r.loginStatus ?? 'Active') : null;
              const isSecurity = r.residentType?.toLowerCase() === 'security';

              return (
                <article
                  key={r.id}
                  className="flex flex-col gap-2.5 rounded-2xl bg-card p-4 shadow-sm border border-border/60 hover:border-primary/40 transition-all"
                >
                  {/* Top: Avatar + Name + Badges */}
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-sm',
                        isSecurity ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary',
                      )}
                    >
                      {initials(r.name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate text-[15px] font-extrabold text-foreground">{r.name}</span>
                        <Badge tone={isSecurity ? 'warning' : 'info'}>
                          {isSecurity ? 'Security' : r.residentType || 'Resident'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {r.communityName ? (
                          <span className="inline-flex items-center gap-1">
                            <Home className="h-3 w-3 text-primary" /> {r.communityName}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {loginStatus ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                          loginStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', loginStatus === 'Active' ? 'bg-emerald-500' : 'bg-rose-500')} />
                        {loginStatus}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/80 shrink-0">No login</span>
                    )}
                  </div>

                  {/* Contact Row */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/40">
                    {r.phone ? (
                      <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-foreground hover:text-primary transition-colors">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold">{r.phone}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground/60">No phone</span>
                    )}

                    {r.email ? (
                      <span className="flex items-center gap-1 truncate text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="truncate">{r.email}</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      {r.userId ? (
                        <button
                          type="button"
                          disabled={togglingId === r.userId}
                          onClick={() => toggleLogin(r)}
                          className={cn(
                            'flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition-all active:scale-95 disabled:opacity-50',
                            loginStatus === 'Suspended'
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40'
                              : 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/40',
                          )}
                        >
                          {loginStatus === 'Suspended' ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5" /> Reactivate Login
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" /> Suspend Login
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        aria-label="Edit"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-primary hover:bg-primary/10 active:scale-95 transition-all"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(r)}
                        aria-label="Delete"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 active:scale-95 transition-all dark:border-rose-800 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Person Drawer (> 3 fields -> Drawer with Top-Right Save/Cancel) */}
      <PersonDrawer
        open={creating || !!editing}
        person={editing}
        scopedCommunityId={scope.scopedCommunityId}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); reload(); }}
      />

      {/* Confirm Delete Dialog (<= 3 fields -> Dialog) */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={t('users.deleteTitle', 'Delete Person')}
        description={t('users.deleteDesc', 'Are you sure you want to remove {{name}}? Their account access will also be revoked.', { name: confirmDelete?.name ?? '' })}
        confirmLabel={t('orgs.delete', 'Delete')}
        tone="danger"
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </AdaptiveShell>
  );
}

function PersonDrawer({
  open,
  person,
  scopedCommunityId,
  onClose,
  onSaved,
}: {
  open: boolean;
  person: Resident | null;
  scopedCommunityId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!person;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [residentType, setResidentType] = useState('owner');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveCommunityId = person?.communityId ?? communityId ?? scopedCommunityId ?? undefined;

  useEffect(() => {
    if (!open) return;
    setName(person?.name ?? '');
    setPhone(person?.phone ?? '');
    setEmail(person?.email ?? '');
    setResidentType(person?.residentType?.toLowerCase() === 'security' ? 'security' : (person?.residentType ?? 'owner'));
    setCommunityId(person?.communityId ?? scopedCommunityId ?? null);
    setUnitId(null);
  }, [open, person, scopedCommunityId]);

  // Load units for effective community
  const unitsQuery = useAsync(
    (signal) => (effectiveCommunityId ? units.list({ pageSize: 200 }, { communityId: effectiveCommunityId }, { signal }).catch(() => null) : Promise.resolve(null)),
    [effectiveCommunityId],
  );

  const unitOptions = useMemo(() => {
    return (unitsQuery.data?.items ?? []).map((u) => ({
      value: u.id,
      label: u.floor ? `Flat ${u.unitNumber} (Floor ${u.floor})` : `Flat ${u.unitNumber}`,
    }));
  }, [unitsQuery.data]);

  const communityFetch = useMemo(
    () => makeCommunityFetch(undefined),
    [],
  );

  const submit = async () => {
    if (busy) return;
    if (!name.trim()) { toast.error(t('users.needName', 'Name is required')); return; }
    if (!phone.trim()) { toast.error(t('users.needPhone', 'Phone number is required')); return; }

    setBusy(true);
    try {
      if (isEdit && person) {
        await residents.update(person.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          residentType,
        });

        if (unitId && residentType !== 'security') {
          await residents.associateHousehold(person.id, { unitId, relationship: 'owner' }).catch(() => undefined);
        }

        toast.success(t('users.updated', 'Person updated successfully'));
      } else {
        if (!effectiveCommunityId) {
          toast.error(t('users.selectCommunityFirst', 'Community / Wing is required'));
          return;
        }
        const created = await residents.create({
          communityId: effectiveCommunityId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          residentType: residentType === 'security' ? 'Security' : 'Owner',
        });

        if (unitId && created?.id && residentType !== 'security') {
          await residents.associateHousehold(created.id, { unitId, relationship: 'owner' }).catch(() => undefined);
        }

        toast.success(t('users.created', 'Person added successfully'));
      }
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SmartFormDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? t('users.editTitle', 'Edit Person') : t('users.addTitle', 'Add Person')}
      subtitle={isEdit ? person?.name : t('users.addDesc', 'Add a resident, tenant, or security staff member.')}
      fieldsCount={6}
      onSave={submit}
      isSaving={busy}
      saveLabel={isEdit ? t('users.saveChanges', 'Save Changes') : t('users.createPerson', 'Add Person')}
      cancelLabel={t('orgs.cancel', 'Cancel')}
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* Role Type Selection */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground">{t('users.roleType', 'Role Type *')}</label>
          <SelectField
            value={residentType}
            options={[
              { value: 'owner', label: t('users.roleOwner', 'Resident / Flat Owner') },
              { value: 'tenant', label: t('users.roleTenant', 'Tenant') },
              { value: 'security', label: t('users.roleSecurity', 'Security Guard / Staff') },
            ]}
            onChange={(v) => { setResidentType(v); setUnitId(null); }}
          />
        </div>

        {/* Multi-society Organization / Community picker if not pre-scoped */}
        {!scopedCommunityId ? (
          <div>
            <label className="mb-1.5 block font-bold text-foreground">{t('users.wingTower', 'Society Wing / Tower *')}</label>
            <EntitySelect
              value={communityId}
              onChange={(v) => { setCommunityId(v); setUnitId(null); }}
              fetchPage={communityFetch}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('users.selectWingTower', 'Select Wing / Tower…')}
            />
          </div>
        ) : null}

        {/* Name */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground">{t('users.fullName', 'Full Name *')}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Kumar"
            className="h-10 text-xs sm:text-sm"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground">{t('users.mobilePhone', 'Mobile Phone *')}</label>
          <PhoneField
            value={phone}
            onChange={setPhone}
            placeholder="+91 98765 43210"
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-1.5 block font-bold text-foreground">{t('users.email', 'Email (Optional)')}</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ramesh@example.com"
            className="h-10 text-xs sm:text-sm"
          />
        </div>

        {/* Flat / Unit Selection */}
        {residentType !== 'security' && unitOptions.length > 0 ? (
          <div>
            <label className="mb-1.5 block font-bold text-foreground">{t('users.assignUnit', 'Assign Flat / Unit (Optional)')}</label>
            <SelectField
              value={unitId ?? ''}
              options={[{ value: '', label: t('users.selectUnit', 'Select Flat…') }, ...unitOptions]}
              onChange={(v) => setUnitId(v || null)}
            />
          </div>
        ) : null}
      </div>
    </SmartFormDrawer>
  );
}

export default PeopleDirectoryView;
