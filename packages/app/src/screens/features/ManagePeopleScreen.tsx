import { useCallback, useMemo, useState } from 'react';
import {
  Users, Plus, Pencil, Trash2, Search, Phone, Mail, Home,
  Ban, CheckCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageLayout } from '@app/components/PageLayout';
import { Badge } from '@shared/components/ui/badge';
import { SmartFormDrawer } from '@shared/components/ui/smart-form-drawer';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Input } from '@shared/components/ui/input';
import { PhoneField } from '@shared/components/PhoneField';
import { SelectField } from '@shared/components/SelectField';
import { residents, users, units as unitsApi } from '@shared/services';
import type { Resident } from '@shared/api/residents';
import type { UserStatus } from '@shared/api/users';
import { useAsync } from '@shared/lib/useAsync';
import { useScope } from '@shared/lib/useScope';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

const ROLE_RESIDENT = 'owner';
const ROLE_SECURITY = 'security';

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function ManagePeopleScreen() {
  const { t } = useTranslation();
  const scope = useScope();
  const [tab, setTab] = useState<'all' | 'resident' | 'security'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

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
    [search, tab, effectiveCommunityId, page, reloadKey],
  );

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const toggleLogin = async (r: Resident) => {
    if (!r.userId || togglingId) return;
    const currentStatus = statusMap[r.userId] ?? (r.loginStatus as UserStatus) ?? 'Active';
    const next: UserStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';
    setTogglingId(r.userId);
    try {
      await users.update(r.userId, { status: next });
      setStatusMap((prev) => ({ ...prev, [r.userId!]: next }));
      toast.success(next === 'Suspended' ? 'Login suspended' : 'Login reactivated');
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
      toast.success('Person removed successfully');
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <PageLayout
      title={t('managePeople.title', 'Manage People')}
      subtitle={t('managePeople.subtitle', 'Society residents, tenants & staff')}
      right={
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Add Person"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/15 active:scale-95 transition-all"
        >
          <Plus className="h-5 w-5" />
        </button>
      }
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        {/* Role Filter Tabs */}
        <div className="flex rounded-full bg-muted p-1">
          {[
            { id: 'all', label: 'All People' },
            { id: 'resident', label: 'Residents' },
            { id: 'security', label: 'Security Staff' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setTab(item.id as any); setPage(1); }}
              className={cn(
                'flex-1 rounded-full py-1.5 text-xs font-bold transition-all',
                tab === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or phone…"
            className="h-10 w-full rounded-2xl bg-card border border-border/60 pl-9 pr-9 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>

        {/* People List */}
        {query.loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t('common.loading', 'Loading people…')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">No people found</p>
            <p className="text-xs text-muted-foreground/80">Tap the "+" button above to add a resident or staff member.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
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

                    <div className="flex items-center gap-1">
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

      {/* Add / Edit Person Dialog */}
      <PersonDialog
        open={creating || !!editing}
        person={editing}
        scopedCommunityId={scope.scopedCommunityId}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); reload(); }}
      />

      {/* Confirm Delete Dialog */}
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
    </PageLayout>
  );
}

function PersonDialog({
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
  const isEdit = !!person;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [residentType, setResidentType] = useState('owner');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveCommunityId = person?.communityId ?? scopedCommunityId ?? undefined;

  // Load units for community
  const unitsQuery = useAsync(
    (signal) => (effectiveCommunityId ? unitsApi.list({ pageSize: 200 }, { communityId: effectiveCommunityId }, { signal }).catch(() => null) : Promise.resolve(null)),
    [effectiveCommunityId],
  );

  const unitOptions = useMemo(() => {
    return (unitsQuery.data?.items ?? []).map((u) => ({
      value: u.id,
      label: u.floor ? `Flat ${u.unitNumber} (Floor ${u.floor})` : `Flat ${u.unitNumber}`,
    }));
  }, [unitsQuery.data]);

  const submit = async () => {
    if (busy) return;
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!phone.trim()) { toast.error('Phone number is required'); return; }

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

        toast.success('Person updated successfully');
      } else {
        if (!effectiveCommunityId) {
          toast.error('Community is required');
          return;
        }
        const created = await residents.create({
          communityId: effectiveCommunityId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          residentType: residentType === 'security' ? 'Security' : 'Owner',
        });

        // If unit was selected, associate unit
        if (unitId && created?.id && residentType !== 'security') {
          await residents.associateHousehold(created.id, { unitId, relationship: 'owner' }).catch(() => undefined);
        }

        toast.success('Person added successfully');
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
      title={isEdit ? 'Edit Person' : 'Add Person'}
      subtitle={isEdit ? person?.name : 'Add a resident, tenant, or security staff member.'}
      fieldsCount={5}
      onSave={submit}
      isSaving={busy}
      saveLabel={isEdit ? 'Update' : 'Add Person'}
      closeButton="cross"
    >
      <div className="flex flex-col gap-4 text-xs">
        <div>
          <label className="mb-1.5 block font-bold text-foreground">Full Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Kumar"
            className="h-10 text-xs sm:text-sm rounded-xl"
          />
        </div>

        <div>
          <PhoneField
            label="Mobile Phone *"
            value={phone}
            onChange={setPhone}
            enableContactPicker
            onContactPicked={(c) => {
              if (c.name && !name.trim()) {
                setName(c.name);
              }
            }}
          />
        </div>

        <div>
          <label className="mb-1.5 block font-bold text-foreground">Email (Optional)</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ramesh@example.com"
            className="h-10 text-xs sm:text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block font-bold text-foreground">Role Type *</label>
          <SelectField
            value={residentType}
            options={[
              { value: 'owner', label: 'Resident / Flat Owner' },
              { value: 'tenant', label: 'Tenant' },
              { value: 'security', label: 'Security Guard / Staff' },
            ]}
            onChange={(v) => setResidentType(v)}
          />
        </div>

        {residentType !== 'security' && unitOptions.length > 0 ? (
          <div>
            <label className="mb-1.5 block font-bold text-foreground">Assign Flat / Unit (Optional)</label>
            <SelectField
              value={unitId ?? ''}
              options={[{ value: '', label: 'Select Flat…' }, ...unitOptions]}
              onChange={(v) => setUnitId(v || null)}
            />
          </div>
        ) : null}
      </div>
    </SmartFormDrawer>
  );
}

export default ManagePeopleScreen;
