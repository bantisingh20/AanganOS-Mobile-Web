import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Camera, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents, tickets, masterData, files } from '@shared/services';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { PageLayout } from '@app/components/PageLayout';
import { TextField } from '@shared/components/TextField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { Field } from '@shared/components/Field';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { FormBanner } from '@shared/components/FormBanner';

const MAX_ATTACHMENTS = 4;

export function RaiseTicketScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const resident = me.data?.resident ?? null;
  const units = me.data?.units ?? [];
  const soleUnitId = units.length === 1 ? units[0]!.unitId : null;

  const [unitId, setUnitId] = useState<string | null>(soleUnitId);
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const effectiveUnitId = unitId ?? soleUnitId;
  const selectedUnit = units.find((u) => u.unitId === effectiveUnitId) ?? null;
  const communityId = selectedUnit?.communityId ?? resident?.communityId ?? units[0]?.communityId ?? null;

  const cats = useAsync((signal) => masterData.list('Ticket_Category', communityId, { signal }).catch(() => []), [communityId]);
  const subcats = useAsync((signal) => masterData.list('Ticket_Subcategory', communityId, { signal }).catch(() => []), [communityId]);
  const prios = useAsync((signal) => masterData.list('Ticket_Priority', communityId, { signal }).catch(() => []), [communityId]);
  const catOptions: SelectOption[] = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const subOptions: SelectOption[] = (subcats.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const prioOptions: SelectOption[] = (prios.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const unitOptions: SelectOption[] = units.map((u) => ({ value: u.unitId, label: `${t('raiseTicket.unit')} ${u.unitNumber}` }));

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || pendingFiles.length >= MAX_ATTACHMENTS) return;
    setPendingFiles((p) => [...p, file]);
    setPreviews((p) => [...p, URL.createObjectURL(file)]);
  };
  const removeAt = (i: number) => {
    setPendingFiles((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = useAsyncAction(async () => {
    if (!effectiveUnitId || !category) throw new Error(t('raiseTicket.selectCategory'));
    const uploadedIds: string[] = [];
    if (communityId) {
      for (const f of pendingFiles) {
        const up = await files.upload(f, { owningResourceType: 'Ticket', communityId });
        uploadedIds.push(up.reference);
      }
    }
    await tickets.create({
      hostUnitId: effectiveUnitId,
      title: title.trim(),
      description: description.trim(),
      category,
      ...(subcategory ? { subcategory } : {}),
      ...(priority ? { priority } : {}),
      ...(uploadedIds.length ? { attachmentFileIds: uploadedIds } : {}),
    });
    setDone(true);
  });

  const valid = !!effectiveUnitId && title.trim().length > 0 && description.trim().length > 0 && !!category;

  if (done) {
    return (
      <PageLayout title={t('raiseTicket.title')}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/10"><CheckCircle2 className="h-16 w-16 text-primary" /></div>
          <h1 className="text-xl font-extrabold">{t('raiseTicket.submitted')}</h1>
          <PrimaryButton label={t('myTickets.title')} onClick={() => navigate('/my-tickets')} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t('raiseTicket.title')} subtitle={t('raiseTicket.subtitle')}>
      <div className="flex flex-col gap-3 px-4 py-4">
        {submit.error ? <FormBanner message={submit.error.message} /> : null}
        {me.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : units.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('myProfile.noUnit')}</p>
        ) : (
          <>
            {units.length > 1 ? (
              <SelectField label={t('raiseTicket.unit')} value={effectiveUnitId} options={unitOptions} placeholder={t('raiseTicket.selectCategory')} onChange={setUnitId} />
            ) : (
              <div className="rounded-2xl bg-card px-4 py-3 shadow-sm">
                <span className="block text-xs text-muted-foreground">{t('raiseTicket.unit')}</span>
                <span className="block text-[15px] font-bold">{units[0]?.unitNumber}</span>
              </div>
            )}

            <SelectField label={t('raiseTicket.category')} value={category} options={catOptions} placeholder={t('raiseTicket.selectCategory')} onChange={setCategory} />
            {subOptions.length > 0 ? (
              <SelectField label={t('raiseTicket.subcategory')} value={subcategory} options={subOptions} placeholder={t('raiseTicket.selectSubcategory')} onChange={setSubcategory} />
            ) : null}
            <SelectField label={t('raiseTicket.priority')} value={priority} options={prioOptions} placeholder={t('raiseTicket.priorityPlaceholder')} onChange={setPriority} />

            <TextField label={t('raiseTicket.ticketTitle')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('raiseTicket.titlePlaceholder')} />
            <Field label={t('raiseTicket.description')}>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('raiseTicket.descriptionPlaceholder')} rows={4} className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </Field>

            <Field label={`${t('raiseTicket.attachPhotos')} (${pendingFiles.length}/${MAX_ATTACHMENTS})`}>
              <div className="flex flex-wrap gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removeAt(i)} className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {pendingFiles.length < MAX_ATTACHMENTS ? (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground active:scale-95 transition-transform">
                    <Camera className="h-6 w-6" />
                    <span className="text-[10px] font-semibold">{t('raiseTicket.addPhoto')}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
                  </label>
                ) : null}
              </div>
            </Field>

            <PrimaryButton label={t('raiseTicket.submit')} loading={submit.running} disabled={!valid} onClick={() => void submit.run()} />
          </>
        )}
      </div>
    </PageLayout>
  );
}
