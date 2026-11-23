import { useState } from 'react';
import { Repeat, Camera, X, AlertCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents, gate, masterData } from '@shared/services';
import { compressImageToDataUrl } from '@shared/lib/image';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { cn } from '@shared/lib/utils';
import type { RecurringVisitor } from '@shared/api/gate';
import { PageLayout } from '@app/components/PageLayout';
import { SmartFormDrawer } from '@shared/components/ui/smart-form-drawer';
import { TextField } from '@shared/components/TextField';
import { PhoneField } from '@shared/components/PhoneField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { Field } from '@shared/components/Field';
import { Button } from '@shared/components/ui/button';
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

function formatDays(mask: number): string {
  if (mask === 127) return 'All Days';
  if (mask === 62) return 'Mon – Fri';
  if (mask === 65) return 'Sat, Sun';
  const active = DAYS.filter((d) => (mask & d.bit) !== 0).map((d) => d.label);
  return active.length > 0 ? active.join(', ') : 'No schedule';
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; }
}
function todayPlus(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}
function dayStartIso(dateStr: string): string { return new Date(`${dateStr}T00:00:00`).toISOString(); }
function isExpiringSoon(endIso: string, days = 10): boolean {
  const end = new Date(endIso); if (Number.isNaN(end.getTime())) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setDate(limit.getDate() + days);
  return end >= today && end <= limit;
}

export function RecurringVisitorsScreen() {
  const { t } = useTranslation();
  const perm = usePermission('recurring-visitors');
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const resident = me.data?.resident ?? null;
  const units = me.data?.units ?? [];

  const [tab, setTab] = useState<'active' | 'expired'>('active');
  const [adding, setAdding] = useState(false);
  const [extendTarget, setExtendTarget] = useState<RecurringVisitor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useAsync(
    (signal) => gate.listRecurringVisitors({ pageSize: 50, sort: 'name:asc' }, { active: tab === 'active' }, { signal }),
    [tab],
  );
  const items = list.data?.items ?? [];

  const revoke = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try { await gate.revokeRecurringVisitor(id); list.reload(); } catch { void 0; } finally { setBusyId(null); }
  };

  return (
    <PageLayout
      title={t('recurring.title')}
      subtitle={t('recurring.subtitle')}
      right={
        perm.canAdd && units.length > 0 ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={t('recurring.add')}
            className="flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/30 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">{t('recurring.add')}</span>
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 px-4 py-4 max-w-4xl mx-auto w-full">
        {/* Device-Adaptive Segmented Tab Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="inline-flex rounded-xl bg-muted/80 p-1 w-full sm:w-auto">
            {(['active', 'expired'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTab(f)}
                className={cn(
                  'flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                  tab === f
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(f === 'active' ? 'recurring.tabActive' : 'recurring.tabExpired')}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground font-medium px-1">
            {items.length} {t(tab === 'active' ? 'recurring.tabActive' : 'recurring.tabExpired').toLowerCase()}
          </div>
        </div>

        {/* Content Area */}
        {me.loading || list.loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Repeat className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">{t(tab === 'active' ? 'recurring.empty' : 'recurring.emptyExpired')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {items.map((r) => {
              const soon = tab === 'active' && isExpiringSoon(r.endDate);
              const daysText = formatDays(r.daysOfWeek);
              return (
                <article
                  key={r.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400">
                      <Repeat className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-bold text-foreground">{r.name}</h3>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize',
                            tab === 'active'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : r.status === 'revoked'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {r.status === 'revoked' ? t('recurring.revoked') : tab === 'active' ? t('recurring.active') : t('recurring.expired')}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="capitalize font-medium">{r.category}</span>
                        {r.phone ? (
                          <>
                            <span>·</span>
                            <span className="font-mono">{r.phone}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Schedule & Validity Info */}
                  <div className="rounded-xl bg-muted/40 p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('recurring.days')}:</span>
                      <span className="font-semibold text-foreground">{daysText}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('recurring.validFrom')}:</span>
                      <span className="font-medium">{formatDate(r.startDate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('recurring.expiresOn')}:</span>
                      <span className="font-medium">{formatDate(r.endDate)}</span>
                    </div>
                  </div>

                  {soon ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>{t('recurring.expiringSoon')}</span>
                    </div>
                  ) : null}

                  {/* Card Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {(tab === 'expired' || soon) ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setExtendTarget(r)}
                        className="flex-1 h-9.5 sm:h-10 rounded-xl text-xs sm:text-sm font-bold border-primary text-primary hover:bg-primary/5 active:scale-95 transition-all"
                      >
                        {t('recurring.extend')}
                      </Button>
                    ) : null}
                    {tab === 'active' ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyId === r.id}
                        onClick={() => revoke(r.id)}
                        className="flex-1 h-9.5 sm:h-10 rounded-xl text-xs sm:text-sm font-bold border-destructive/40 text-destructive hover:bg-destructive/5 active:scale-95 transition-all"
                      >
                        {t('recurring.revokeAction')}
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Recurring Visitor Side-Drawer */}
      {adding && resident ? (
        <AddRecurringDrawer
          open={adding}
          units={units.map((u) => ({ unitId: u.unitId, unitNumber: u.unitNumber, communityId: u.communityId ?? undefined }))}
          residentId={resident.id}
          communityId={resident.communityId ? resident.communityId : null}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); setTab('active'); list.reload(); }}
        />
      ) : null}

      {/* Extend Visitor Side-Drawer */}
      <ExtendRecurringDrawer
        target={extendTarget}
        onClose={() => setExtendTarget(null)}
        onSaved={() => { setExtendTarget(null); setTab('active'); list.reload(); }}
      />
    </PageLayout>
  );
}

function AddRecurringDrawer({
  open,
  units,
  residentId,
  communityId,
  onClose,
  onSaved,
}: {
  open: boolean;
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
  const [dayMask, setDayMask] = useState(0);
  const [startDate, setStartDate] = useState(todayPlus(0));
  const [endDate, setEndDate] = useState(todayPlus(30));
  const [photoFileId, setPhotoFileId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<FormErrorView | null>(null);

  const selectedUnit = units.find((u) => u.unitId === (unitId ?? soleUnitId)) ?? null;
  const resolvedCommunity = selectedUnit?.communityId ?? communityId ?? undefined;

  const cats = useAsync((signal) => masterData.list('Visitor_Category', resolvedCommunity ?? null, { signal }).catch(() => []), [resolvedCommunity]);
  const catOptions: SelectOption[] = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const unitOptions: SelectOption[] = units.map((u) => ({ value: u.unitId, label: u.unitNumber }));

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const save = useAsyncAction(async () => {
    const effUnit = unitId ?? soleUnitId;
    if (!effUnit) throw new Error(t('recurring.warnName'));
    if (!name.trim()) throw new Error(t('recurring.warnName'));
    if (!category) throw new Error(t('recurring.warnCategory'));
    if (dayMask <= 0) throw new Error(t('recurring.warnDays'));
    if (!startDate || !endDate) throw new Error(t('recurring.warnDates'));

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
      ...(photoFileId ? { photoFileId } : {}),
      ...(photoBase64 ? { photoBase64 } : {}),
    });
    onSaved();
  });

  return (
    <SmartFormDrawer
      open={open}
      onClose={onClose}
      className="w-full sm:max-w-lg md:max-w-xl"
      title={t('recurring.add')}
      subtitle={t('recurring.subtitle')}
      fieldsCount={6}
      onSave={() => { setError(null); void save.run(); }}
      isSaving={save.running}
      saveLabel={t('recurring.add')}
      closeButton="cross"
    >
      <div className="space-y-4 py-1">
        {error ? <FormBanner message={error.message} /> : null}
        {save.error ? <FormBanner message={save.error.message} /> : null}

        {/* Photo Picker */}
        <div className="flex flex-col items-center gap-2 pb-2">
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted/40 shadow-xs">
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoFileId(null); setPhotoPreview(null); }}
                  className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <Camera className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
            {t('recurring.photo')}
            <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          </label>
        </div>

        {/* Form Fields: Device Adaptive Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {units.length > 1 ? (
            <div className="col-span-1 sm:col-span-2">
              <SelectField label={t('recurring.unit', 'Unit')} value={unitId} options={unitOptions} onChange={setUnitId} />
            </div>
          ) : null}

          <div className="col-span-1">
            <TextField label={t('recurring.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('recurring.namePlaceholder')} />
          </div>

          <div className="col-span-1">
            <PhoneField
              label={t('recurring.phone')}
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

          <div className="col-span-1 sm:col-span-2">
            <SelectField label={t('recurring.category')} value={category} options={catOptions} placeholder={t('recurring.selectCategory')} onChange={setCategory} />
          </div>

          <div className="col-span-1 sm:col-span-2">
            <Field label={t('recurring.days')}>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {DAYS.map((d) => {
                  const on = (dayMask & d.bit) !== 0;
                  return (
                    <button
                      key={d.bit}
                      type="button"
                      onClick={() => setDayMask((m) => on ? m & ~d.bit : m | d.bit)}
                      className={cn(
                        'h-9.5 min-w-[42px] px-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95',
                        on
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="col-span-1">
            <Field label={t('recurring.startDate')}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 sm:h-9 w-full rounded-xl border border-input bg-card px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
          </div>

          <div className="col-span-1">
            <Field label={t('recurring.endDate')}>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 sm:h-9 w-full rounded-xl border border-input bg-card px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
          </div>
        </div>
      </div>
    </SmartFormDrawer>
  );
}

function ExtendRecurringDrawer({
  target,
  onClose,
  onSaved,
}: {
  target: RecurringVisitor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [endDate, setEndDate] = useState(todayPlus(30));
  const save = useAsyncAction(async () => {
    if (!target) return;
    await gate.extendRecurringVisitor(target.id, dayStartIso(endDate));
    onSaved();
  });

  return (
    <SmartFormDrawer
      open={!!target}
      onClose={onClose}
      className="w-full sm:max-w-md"
      title={t('recurring.extendTitle')}
      fieldsCount={2}
      onSave={() => void save.run()}
      isSaving={save.running}
      saveLabel={t('recurring.save')}
      closeButton="cross"
    >
      {target ? (
        <div className="space-y-4 py-2">
          {save.error ? <FormBanner message={save.error.message} /> : null}
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs">
            <span className="font-bold text-foreground">{target.name}</span>
            <p className="mt-0.5 text-muted-foreground">
              {t('recurring.expiresOn')} {formatDate(target.endDate)}
            </p>
          </div>
          <Field label={t('recurring.newEndDate')}>
            <input
              type="date"
              value={endDate}
              min={todayPlus(1)}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Field>
        </div>
      ) : null}
    </SmartFormDrawer>
  );
}
