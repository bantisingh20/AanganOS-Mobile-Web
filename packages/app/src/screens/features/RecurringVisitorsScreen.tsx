import { useState, useMemo, useRef } from 'react';
import {
  Repeat, Camera, X, AlertCircle, Plus, Search, RefreshCw,
  Image as ImageIcon, Calendar, Phone, Check, Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents, gate, masterData, files } from '@shared/services';
import { compressImageToDataUrl } from '@shared/lib/image';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { useIsSmallScreen } from '@shared/lib/useMediaQuery';
import { cn } from '@shared/lib/utils';
import type { RecurringVisitor } from '@shared/api/gate';
import { PageLayout } from '@app/components/PageLayout';
import { SmartFormDrawer } from '@shared/components/ui/smart-form-drawer';
import { TextField } from '@shared/components/TextField';
import { PhoneField } from '@shared/components/PhoneField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { Field } from '@shared/components/Field';
import { Button } from '@shared/components/ui/button';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { FormBanner } from '@shared/components/FormBanner';
import type { FormErrorView } from '@shared/api/errors';

const DAYS: { key: string; label: string; bit: number }[] = [
  { key: 'sun', label: 'Sun', bit: 1 },
  { key: 'mon', label: 'Mon', bit: 2 },
  { key: 'tue', label: 'Tue', bit: 4 },
  { key: 'wed', label: 'Wed', bit: 8 },
  { key: 'thu', label: 'Thu', bit: 16 },
  { key: 'fri', label: 'Fri', bit: 32 },
  { key: 'sat', label: 'Sat', bit: 64 },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayStartIso(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function isExpiringSoon(endIso: string, days = 10): boolean {
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return end >= today && end <= limit;
}

export function RecurringVisitorsScreen() {
  const { t } = useTranslation();
  const isSmall = useIsSmallScreen();
  const perm = usePermission('recurring-visitors');
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const resident = me.data?.resident ?? null;
  const units = me.data?.units ?? [];

  const [tab, setTab] = useState<'active' | 'expired'>('active');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [extendTarget, setExtendTarget] = useState<RecurringVisitor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useAsync(
    (signal) =>
      gate.listRecurringVisitors({ pageSize: 50, sort: 'name:asc' }, { active: tab === 'active' }, { signal }),
    [tab],
  );
  const items = list.data?.items ?? [];

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.phone && r.phone.toLowerCase().includes(q)),
    );
  }, [items, search]);

  const revoke = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await gate.revokeRecurringVisitor(id);
      list.reload();
    } catch {
      void 0;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageLayout
      title={t('recurring.title')}
      subtitle={t('recurring.subtitle')}
      right={
        perm.canAdd && units.length > 0 ? (
          <Button
            type="button"
            onClick={() => setAdding(true)}
            className="h-10 gap-1.5 rounded-xl bg-primary text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 px-4"
          >
            <Plus className="h-4 w-4" /> Add Recurring Visitor
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Desktop Single-Row Toolbar (Segmented Toggle + Search + Refresh + Add Button) */}
        {!isSmall ? (
          <div className="flex items-center gap-3 border-b border-border/60 pb-3">
            {/* Segmented Toggle Bar */}
            <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/60 shrink-0">
              <button
                type="button"
                onClick={() => setTab('active')}
                className={cn(
                  'px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap',
                  tab === 'active'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('recurring.tabActive', 'Active')}
              </button>
              <button
                type="button"
                onClick={() => setTab('expired')}
                className={cn(
                  'px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap',
                  tab === 'expired'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('recurring.tabExpired', 'Expired / Suspended')}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, category, or phone…"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
            </div>

            {/* Refresh Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => list.reload()}
              className="h-10 w-10 p-0 rounded-xl border-border/60 shrink-0"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4 text-muted-foreground', list.loading && 'animate-spin')} />
            </Button>
          </div>
        ) : (
          /* Mobile View Toolbar */
          <div className="space-y-2.5">
            {/* Search Input + Refresh */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search recurring visitors…"
                  className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => list.reload()}
                className="h-10 w-10 p-0 rounded-xl border-border/80 shrink-0"
                title="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4 text-muted-foreground', list.loading && 'animate-spin')} />
              </Button>
            </div>

            {/* Mobile Segmented Toggle */}
            <div className="flex rounded-xl bg-muted/60 p-1 border border-border/60">
              <button
                type="button"
                onClick={() => setTab('active')}
                className={cn(
                  'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center',
                  tab === 'active'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('recurring.tabActive', 'Active')}
              </button>
              <button
                type="button"
                onClick={() => setTab('expired')}
                className={cn(
                  'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center',
                  tab === 'expired'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('recurring.tabExpired', 'Expired / Suspended')}
              </button>
            </div>
          </div>
        )}

        {/* Content List Section */}
        {me.loading || list.loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin text-primary mb-2" />
            <p className="text-xs font-medium">{t('common.loading')}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <Repeat className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              {tab === 'active' ? 'No active recurring visitors' : 'No expired recurring passes'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {search.trim()
                ? 'No matching recurring visitors found. Try a different name or category.'
                : tab === 'active'
                  ? 'Register maids, drivers, or daily service staff with scheduled access.'
                  : 'Expired or suspended recurring passes will appear here.'}
            </p>
            {perm.canAdd && units.length > 0 && (
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="h-10 gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 px-4"
                >
                  <Plus className="h-4 w-4" /> Add Recurring Visitor
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredItems.map((r) => {
              const soon = tab === 'active' && isExpiringSoon(r.endDate);
              return (
                <article
                  key={r.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs hover:shadow-sm transition-all"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-black">
                        <Repeat className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-extrabold text-foreground">{r.name}</div>
                        <div className="truncate text-xs capitalize text-muted-foreground mt-0.5">
                          {r.category}
                          {r.phone ? ` · ${r.phone}` : ''}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize',
                          tab === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : r.status === 'revoked'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {r.status === 'revoked'
                          ? t('recurring.revoked', 'Suspended')
                          : tab === 'active'
                            ? t('recurring.active', 'Active')
                            : t('recurring.expired', 'Expired')}
                      </span>
                    </div>

                    {/* Schedule Days */}
                    <div className="mt-3 flex items-center gap-1 flex-wrap">
                      {DAYS.map((d) => {
                        const active = (r.daysOfWeek & d.bit) !== 0;
                        return (
                          <span
                            key={d.bit}
                            className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold',
                              active
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted/40 text-muted-foreground/50',
                            )}
                            title={d.label}
                          >
                            {d.label[0]}
                          </span>
                        );
                      })}
                    </div>

                    {/* Dates */}
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                      <div>
                        <div className="text-[11px] text-muted-foreground">{t('recurring.validFrom', 'Valid From')}</div>
                        <div className="font-bold text-foreground mt-0.5">{formatDate(r.startDate)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">{t('recurring.expiresOn', 'Expires On')}</div>
                        <div className="font-bold text-foreground mt-0.5">{formatDate(r.endDate)}</div>
                      </div>
                    </div>

                    {soon ? (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5" /> {t('recurring.expiringSoon', 'Expiring soon')}
                      </div>
                    ) : null}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1 border-t border-border/50">
                    {tab === 'expired' || soon ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExtendTarget(r)}
                        className="flex-1 h-9 rounded-xl border-primary text-primary hover:bg-primary/10 text-xs font-semibold"
                      >
                        {t('recurring.extend', 'Extend Validity')}
                      </Button>
                    ) : null}
                    {tab === 'active' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === r.id}
                        onClick={() => revoke(r.id)}
                        className="flex-1 h-9 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-semibold disabled:opacity-50"
                      >
                        {t('recurring.revokeAction', 'Suspend / Revoke')}
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Recurring Visitor Dialog */}
      {adding && resident ? (
        <AddRecurringDialog
          units={units.map((u) => ({
            unitId: u.unitId,
            unitNumber: u.unitNumber,
            communityId: u.communityId ?? undefined,
          }))}
          residentId={resident.id}
          communityId={resident.communityId ? resident.communityId : null}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setTab('active');
            list.reload();
          }}
        />
      ) : null}

      {/* Extend Recurring Visitor Dialog */}
      {extendTarget ? (
        <ExtendRecurringDialog
          target={extendTarget}
          onClose={() => setExtendTarget(null)}
          onSaved={() => {
            setExtendTarget(null);
            setTab('active');
            list.reload();
          }}
        />
      ) : null}
    </PageLayout>
  );
}

function AddRecurringDialog({
  units,
  residentId,
  communityId,
  onClose,
  onSaved,
}: {
  units: { unitId: string; unitNumber: string; communityId?: string }[];
  residentId: string;
  communityId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const soleUnitId = units.length === 1 ? units[0]!.unitId : null;
  const [unitId, setUnitId] = useState<string | null>(soleUnitId);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [dayMask, setDayMask] = useState(127); // Default all days (127 = 1|2|4|8|16|32|64)
  const [startDate, setStartDate] = useState(todayPlus(0));
  const [endDate, setEndDate] = useState(todayPlus(30));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<FormErrorView | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const selectedUnit = units.find((u) => u.unitId === (unitId ?? soleUnitId)) ?? null;
  const resolvedCommunity = selectedUnit?.communityId ?? communityId ?? undefined;

  const cats = useAsync(
    (signal) => masterData.list('Visitor_Category', resolvedCommunity ?? null, { signal }).catch(() => []),
    [resolvedCommunity],
  );
  const catOptions: SelectOption[] = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const unitOptions: SelectOption[] = units.map((u) => ({ value: u.unitId, label: u.unitNumber }));

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const save = useAsyncAction(async () => {
    const effUnit = unitId ?? soleUnitId;
    if (!effUnit) throw new Error(t('myVisitors.warnSelectUnit', 'Please select a destination flat/unit'));
    if (!name.trim()) throw new Error(t('recurring.warnName', 'Visitor name is required'));
    if (!category) throw new Error(t('recurring.warnCategory', 'Category is required'));
    if (dayMask <= 0) throw new Error(t('recurring.warnDays', 'Please select at least one day'));
    if (!startDate || !endDate) throw new Error(t('recurring.warnDates', 'Start date and end date are required'));

    let photoBase64: string | undefined;
    if (photoFile) {
      try {
        photoBase64 = await compressImageToDataUrl(photoFile, 960, 960, 0.75);
      } catch {
        // Fallback
      }
    }

    await gate.createRecurringVisitor({
      hostUnitId: effUnit,
      hostResidentId: residentId,
      name: name.trim(),
      category,
      daysOfWeek: dayMask,
      startDate: dayStartIso(startDate),
      endDate: dayStartIso(endDate),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(photoBase64 ? { photoBase64 } : {}),
    });
    onSaved();
  });

  return (
    <SmartFormDrawer
      open
      onClose={onClose}
      title="Add Recurring Visitor"
      fieldsCount={7}
      onSave={() => {
        setError(null);
        void save.run();
      }}
      saveLabel={save.running ? 'Adding…' : 'Add Recurring Visitor'}
      isSaving={save.running}
      closeAction="cross"
      className="md:max-w-xl lg:max-w-2xl"
    >
      <div className="space-y-4 py-2">
        {error ? <FormBanner message={error.message} /> : null}
        {save.error ? <FormBanner message={save.error.message} /> : null}

        {/* Photo Upload Section */}
        <div className="flex items-center gap-4 rounded-2xl border border-border/80 bg-muted/20 p-3.5">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card shadow-xs">
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <Camera className="h-6 w-6" />
                <span className="text-[10px] font-semibold mt-1">Photo</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <h4 className="text-xs font-bold text-foreground">Visitor Photo (Optional)</h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all"
              >
                <Camera className="h-3.5 w-3.5 text-primary" /> Camera
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition-all"
              >
                <ImageIcon className="h-3.5 w-3.5 text-primary" /> Gallery
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
            <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          </div>
        </div>

        {/* Destination Unit if resident has multiple units */}
        {units.length > 1 ? (
          <SelectField
            label="Destination Flat / Unit *"
            value={unitId}
            options={unitOptions}
            onChange={setUnitId}
            placeholder="Select flat / unit…"
          />
        ) : null}

        {/* Full Name */}
        <TextField
          label="Visitor Full Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ramesh Kumar (Driver)"
        />

        {/* Phone */}
        <PhoneField label="Phone Number" value={phone} onChange={setPhone} />

        {/* Category */}
        <SelectField
          label="Category *"
          value={category}
          options={catOptions.length > 0 ? catOptions : [
            { value: 'maid', label: 'Maid / Housekeeping' },
            { value: 'driver', label: 'Driver' },
            { value: 'cook', label: 'Cook' },
            { value: 'milkman', label: 'Milkman' },
            { value: 'service', label: 'Service / Maintenance' }
          ]}
          placeholder="Select category…"
          onChange={setCategory}
        />

        {/* Allowed Days */}
        <Field label="Allowed Days of Week *">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDayMask(127)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-lg border transition-all',
                  dayMask === 127
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                Everyday
              </button>
              <button
                type="button"
                onClick={() => setDayMask(62)} // Mon-Fri = 2+4+8+16+32 = 62
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-lg border transition-all',
                  dayMask === 62
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                Weekdays (Mon-Fri)
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {DAYS.map((d) => {
                const on = (dayMask & d.bit) !== 0;
                return (
                  <button
                    key={d.bit}
                    type="button"
                    onClick={() => setDayMask((m) => (on ? m & ~d.bit : m | d.bit))}
                    className={cn(
                      'h-10 min-w-[46px] rounded-xl border text-xs font-bold transition-all',
                      on
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Field>

        {/* Dates Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Start Date *">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Field>
          <Field label="End Date *">
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Field>
        </div>
      </div>
    </SmartFormDrawer>
  );
}

function ExtendRecurringDialog({
  target,
  onClose,
  onSaved,
}: {
  target: RecurringVisitor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [endDate, setEndDate] = useState(todayPlus(30));
  const save = useAsyncAction(async () => {
    await gate.extendRecurringVisitor(target.id, dayStartIso(endDate));
    onSaved();
  });

  return (
    <SmartFormDrawer
      open
      onClose={onClose}
      title={t('recurring.extendTitle', 'Extend Pass Validity')}
      fieldsCount={1}
      onSave={() => void save.run()}
      saveLabel={save.running ? 'Saving…' : t('recurring.save', 'Extend Pass')}
      isSaving={save.running}
      closeAction="cross"
      className="sm:max-w-md"
    >
      <div className="space-y-3 py-2">
        <p className="text-xs text-muted-foreground font-medium">
          {target.name} • Current Expiry: {formatDate(target.endDate)}
        </p>
        {save.error ? <FormBanner message={save.error.message} /> : null}
        <Field label={t('recurring.newEndDate', 'New Expiry Date')}>
          <input
            type="date"
            value={endDate}
            min={todayPlus(1)}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </Field>
      </div>
    </SmartFormDrawer>
  );
}
