import { useState } from 'react';
import { Repeat, Camera, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents, gate, masterData, files } from '@shared/services';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { cn } from '@shared/lib/utils';
import type { RecurringVisitor } from '@shared/api/gate';
import { PageLayout } from '@app/components/PageLayout';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { TextField } from '@shared/components/TextField';
import { PhoneField } from '@shared/components/PhoneField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { Field } from '@shared/components/Field';
import { Button } from '@shared/components/ui/button';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { FormBanner } from '@shared/components/FormBanner';
import type { FormErrorView } from '@shared/api/errors';

const DAYS: { key: string; bit: number }[] = [
  { key: 'sun', bit: 1 }, { key: 'mon', bit: 2 }, { key: 'tue', bit: 4 }, { key: 'wed', bit: 8 },
  { key: 'thu', bit: 16 }, { key: 'fri', bit: 32 }, { key: 'sat', bit: 64 },
];

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
          <button type="button" onClick={() => setAdding(true)} aria-label={t('recurring.add')} className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold hover:bg-white/15">+</button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex rounded-full bg-muted p-1">
          {(['active', 'expired'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setTab(f)} className={cn('flex-1 rounded-full py-1.5 text-sm font-bold transition-colors', tab === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t(f === 'active' ? 'recurring.tabActive' : 'recurring.tabExpired')}
            </button>
          ))}
        </div>

        {me.loading || list.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Repeat className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t(tab === 'active' ? 'recurring.empty' : 'recurring.emptyExpired')}</p>
          </div>
        ) : (
          items.map((r) => {
            const soon = tab === 'active' && isExpiringSoon(r.endDate);
            return (
              <article key={r.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/10"><Repeat className="h-5 w-5 text-pink-500" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-extrabold">{r.name}</div>
                    <div className="truncate text-xs capitalize text-muted-foreground">{r.category}{r.phone ? ` · ${r.phone}` : ''}</div>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize', tab === 'active' ? 'bg-primary/10 text-primary' : r.status === 'revoked' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
                    {r.status === 'revoked' ? t('recurring.revoked') : tab === 'active' ? t('recurring.active') : t('recurring.expired')}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                  <div><div className="text-muted-foreground">{t('recurring.validFrom')}</div><div className="font-bold">{formatDate(r.startDate)}</div></div>
                  <div className="text-right"><div className="text-muted-foreground">{t('recurring.expiresOn')}</div><div className="font-bold">{formatDate(r.endDate)}</div></div>
                </div>
                {soon ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600"><AlertCircle className="h-3.5 w-3.5" /> {t('recurring.expiringSoon')}</div>
                ) : null}
                <div className="flex gap-2">
                  {(tab === 'expired' || soon) ? (
                    <button type="button" onClick={() => setExtendTarget(r)} className="flex-1 rounded-xl border-2 border-primary py-2 text-sm font-bold text-primary">{t('recurring.extend')}</button>
                  ) : null}
                  {tab === 'active' ? (
                    <button type="button" disabled={busyId === r.id} onClick={() => revoke(r.id)} className="flex-1 rounded-xl border-2 border-destructive/30 py-2 text-sm font-bold text-destructive disabled:opacity-50">{t('recurring.revokeAction')}</button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      {adding && resident ? (
        <AddRecurringDialog
          units={units.map((u) => ({ unitId: u.unitId, unitNumber: u.unitNumber, communityId: u.communityId ?? undefined }))}
          residentId={resident.id}
          communityId={resident.communityId ? resident.communityId : null}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); setTab('active'); list.reload(); }}
        />
      ) : null}

      {extendTarget ? (
        <ExtendRecurringDialog target={extendTarget} onClose={() => setExtendTarget(null)} onSaved={() => { setExtendTarget(null); setTab('active'); list.reload(); }} />
      ) : null}
    </PageLayout>
  );
}

function AddRecurringDialog({
  units, residentId, communityId, onClose, onSaved,
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
  const [dayMask, setDayMask] = useState(0);
  const [startDate, setStartDate] = useState(todayPlus(0));
  const [endDate, setEndDate] = useState(todayPlus(30));
  const [photoFileId, setPhotoFileId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<FormErrorView | null>(null);

  const selectedUnit = units.find((u) => u.unitId === (unitId ?? soleUnitId)) ?? null;
  const resolvedCommunity = selectedUnit?.communityId ?? communityId ?? undefined;

  const cats = useAsync((signal) => masterData.list('Visitor_Category', resolvedCommunity ?? null, { signal }).catch(() => []), [resolvedCommunity]);
  const catOptions: SelectOption[] = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const unitOptions: SelectOption[] = units.map((u) => ({ value: u.unitId, label: u.unitNumber }));

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !resolvedCommunity) return;
    setUploading(true);
    try { const up = await files.upload(file, { owningResourceType: 'RecurringVisitor', communityId: resolvedCommunity }); setPhotoFileId(up.reference); setPhotoPreview(URL.createObjectURL(file)); } catch { void 0; } finally { setUploading(false); }
  };

  const save = useAsyncAction(async () => {
    const effUnit = unitId ?? soleUnitId;
    if (!effUnit) throw new Error(t('recurring.warnName'));
    if (!name.trim()) throw new Error(t('recurring.warnName'));
    if (!category) throw new Error(t('recurring.warnCategory'));
    if (dayMask <= 0) throw new Error(t('recurring.warnDays'));
    if (!startDate || !endDate) throw new Error(t('recurring.warnDates'));
    await gate.createRecurringVisitor({
      hostUnitId: effUnit, hostResidentId: residentId, name: name.trim(), category,
      daysOfWeek: dayMask, startDate: dayStartIso(startDate), endDate: dayStartIso(endDate),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(photoFileId ? { photoFileId } : {}),
    });
    onSaved();
  });

  return (
    <Dialog open onClose={onClose} className="max-h-[90vh] overflow-y-auto">
      <DialogHeader title={t('recurring.add')} />
      <div className="flex flex-col gap-3">
        {error ? <FormBanner message={error.message} /> : null}
        {save.error ? <FormBanner message={save.error.message} /> : null}

        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted/40">
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => { setPhotoFileId(null); setPhotoPreview(null); }} className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"><X className="h-3.5 w-3.5" /></button>
              </>
            ) : (<Camera className="h-7 w-7 text-muted-foreground" />)}
          </div>
          <label className="cursor-pointer text-xs font-bold text-primary">
            {uploading ? '…' : t('recurring.photo')}
            <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          </label>
        </div>

        {units.length > 1 ? <SelectField label={t('recurring.name')} value={unitId} options={unitOptions} onChange={setUnitId} /> : null}
        <TextField label={t('recurring.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('recurring.namePlaceholder')} />
        <PhoneField label={t('recurring.phone')} value={phone} onChange={setPhone} />
        <SelectField label={t('recurring.category')} value={category} options={catOptions} placeholder={t('recurring.selectCategory')} onChange={setCategory} />

        <Field label={t('recurring.days')}>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const on = (dayMask & d.bit) !== 0;
              return (
                <button key={d.bit} type="button" onClick={() => setDayMask((m) => on ? m & ~d.bit : m | d.bit)} className={cn('h-9 min-w-[44px] rounded-lg border text-xs font-bold', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')}>
                  {t(`recurring.${d.key}`)}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('recurring.startDate')}>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </Field>
          <Field label={t('recurring.endDate')}>
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={save.running} className="h-10 rounded-xl">{t('common.cancel')}</Button>
        <PrimaryButton className="h-10 w-auto px-5" arrow={false} label={t('recurring.add')} loading={save.running} disabled={uploading} onClick={() => { setError(null); void save.run(); }} />
      </DialogFooter>
    </Dialog>
  );
}

function ExtendRecurringDialog({ target, onClose, onSaved }: { target: RecurringVisitor; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [endDate, setEndDate] = useState(todayPlus(30));
  const save = useAsyncAction(async () => {
    await gate.extendRecurringVisitor(target.id, dayStartIso(endDate));
    onSaved();
  });
  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title={t('recurring.extendTitle')} />
      <div className="flex flex-col gap-3">
        {save.error ? <FormBanner message={save.error.message} /> : null}
        <p className="text-sm text-muted-foreground">{target.name} · {t('recurring.expiresOn')} {formatDate(target.endDate)}</p>
        <Field label={t('recurring.newEndDate')}>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={save.running} className="h-10 rounded-xl">{t('common.cancel')}</Button>
        <PrimaryButton className="h-10 w-auto px-5" arrow={false} label={t('recurring.save')} loading={save.running} onClick={() => void save.run()} />
      </DialogFooter>
    </Dialog>
  );
}
