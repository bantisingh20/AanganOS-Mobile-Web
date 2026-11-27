import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, UploadCloud, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { SelectField, type SelectOption } from '@shared/components/form/SelectField';
import { FormBanner } from '@shared/components/form/FormBanner';
import { PageShell } from '@shared/components/layout';
import { SurfaceProvider, useResolvedSurface } from '@shared/lib/surface';
import { tickets, masterData, files } from '@shared/services';
import type { MasterDataEntry } from '@shared/api/masterData';
import { toFormError } from '@shared/api/errors';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useScope } from '@shared/lib/hooks/useScope';
import { useAuth } from '@shared/store/AuthContext';
import { cn } from '@shared/lib/utils';
import { Field } from '@shared/components/form/Field';
import { useBackNavigation } from '@shared/lib/routing';
import { tryToast } from '@shared/lib/withToast';
import { TextField } from '@shared/components/form/TextField';


export interface SubmitTicketPageProps {
  mode?: 'admin' | 'mobile';
  title?: string;
  listPath?: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

const FALLBACK_PRIORITIES: SelectOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}{required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

export function SubmitTicketPage(props: SubmitTicketPageProps) {
  const surface = useResolvedSurface(props.mode);
  return <SurfaceProvider value={surface}><SubmitTicket {...props} /></SurfaceProvider>;
}

function SubmitTicket({ title, listPath = '/helpdesk', onSuccess, onBack }: SubmitTicketPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scope = useScope();
  const { user } = useAuth();
  const isApp = useResolvedSurface() === 'app';

  const resolvedListPath = listPath;
  const pageTitle = title ?? t('tickets.createTitle', 'Submit Ticket');
  const handleBack = useBackNavigation(listPath, onBack);

  // Resolved community context from user session
  const communityId = user?.communityId ?? scope.scopedCommunityId ?? null;

  /* ── Form state ── */
  const [ticketTitle, setTicketTitle] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [priority, setPriority] = useState('normal');
  const [description, setDescription] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* ── Master data ── */
  const catsQ = useAsync((s: any) => masterData.list('Ticket_Category', communityId, { signal: s }).catch(() => [] as MasterDataEntry[]), [communityId]);
  const catOpts = useMemo<SelectOption[]>(() => (catsQ.data ?? []).map(c => ({ value: c.code, label: c.label })), [catsQ.data]);

  const subcatsQ = useAsync((s: any) => masterData.list('Ticket_Subcategory', communityId, { signal: s }).catch(() => [] as MasterDataEntry[]), [communityId]);
  const subcatOpts = useMemo<SelectOption[]>(() => (subcatsQ.data ?? []).map(c => ({ value: c.code, label: c.label })), [subcatsQ.data]);

  const priQ = useAsync((s: any) => masterData.list('Ticket_Priority', communityId, { signal: s }).catch(() => [] as MasterDataEntry[]), [communityId]);
  const priOpts = useMemo<SelectOption[]>(() => {
    const list = (priQ.data ?? []).map(p => ({ value: p.code, label: p.label }));
    return list.length > 0 ? list : FALLBACK_PRIORITIES;
  }, [priQ.data]);

  /* ── File upload ── */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files;
    if (!fl?.length) return;
    const commId = communityId || user?.communityId || scope.scopedCommunityId || '';
    if (!commId) {
      toast.error('Community context is required for file upload');
      return;
    }
    setUploading(true);
    try {
      await tryToast(async () => {
        for (let i = 0; i < fl.length; i++) {
          const f = fl[i]!;
          const res = await files.upload(f, {
            owningResourceType: 'Ticket',
            communityId: commId,
          });
          setAttachedFiles(p => [...p, { id: res.reference, name: f.name }]);
        }
      }, 'File(s) uploaded');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  /* ── Submit: backend automatically resolves host unit and community from session ── */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!ticketTitle.trim()) { setErrorMsg('Enter a title'); toast.error('Title is required'); return; }
    if (!category) { setErrorMsg('Select a category'); toast.error('Category is required'); return; }
    if (!description.trim()) { setErrorMsg('Enter a description'); toast.error('Description is required'); return; }

    setBusy(true);
    try {
      await tickets.create({
        title: ticketTitle.trim(),
        description: description.trim(),
        category,
        ...(subcategory ? { subcategory } : {}),
        ...(priority ? { priority } : {}),
        ...(attachedFiles.length > 0 ? { attachmentFileIds: attachedFiles.map(f => f.id) } : {}),
      });
      toast.success(t('tickets.created', 'Ticket submitted!'));
      if (onSuccess) onSuccess();
      else navigate(resolvedListPath, { replace: true });
    } catch (err) {
      const fe = toFormError(err);
      setErrorMsg(fe.message);
      toast.error(fe.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title={pageTitle} showBack onBack={onBack} backTo={listPath}>
      <Card className={cn('mx-auto w-full max-w-3xl',
        isApp ? 'rounded-none border-none bg-transparent p-1 shadow-none' : 'rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6')}>

        <form onSubmit={submit} className="space-y-5">
          {errorMsg && <FormBanner message={errorMsg} />}

          {/* Title */}
          <div>
            <TextField value={ticketTitle} onChange={e => setTicketTitle(e.target.value)} maxLength={120} label={t('raiseTicket.title')} required
              placeholder={t('raiseTicket.titlePlaceholder', 'Brief summary of the issue (e.g. Water leakage in bathroom)')} className="h-10 rounded-xl text-sm bg-card" />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <SelectField value={category || null} options={catOpts} size="sm" label={t('raiseTicket.category')} required
                  placeholder={t('raiseTicket.selectCategory', 'Select category')} onChange={v => { setCategory(v); setSubcategory(''); }} />
            </div>
            <div>          
              <SelectField value={priority} options={priOpts} size="sm" label={t('raiseTicket.priority')} required
                placeholder={t('raiseTicket.selectPriority', 'Select priority')} onChange={setPriority} />
            </div>
          </div>

          {/* Subcategory */}
          {subcatOpts.length > 0 && (
            <div>
              <SelectField value={subcategory || null} options={subcatOpts} size="sm" label={t('raiseTicket.subcategory')} required
                  placeholder={t('raiseTicket.selectSubcategory', 'Select subcategory (optional)')} onChange={setSubcategory} />
            </div>
          )}

          {/* Description */}
          <div>
            <Field label={t('raiseTicket.description')} required>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('raiseTicket.descriptionPlaceholder')} rows={4} className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </Field>
             
          </div>

          {/* Attachments */}
          <div>
            <FieldLabel>{t('raiseTicket.attachPhotos')}</FieldLabel>
            <label className={cn('flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/20 p-5 text-center cursor-pointer transition-all hover:bg-muted/40',
              uploading && 'pointer-events-none opacity-60')}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{t('raiseTicket.attachPhotos')}</p>
                <p className="text-[11px] text-muted-foreground">{t('raiseTicket.addPhoto')}</p>
              </div>
              <input type="file" multiple accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
            </label>
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {attachedFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-xs">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button type="button" onClick={() => setAttachedFiles(p => p.filter(x => x.id !== f.id))}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border/70 pt-4">
            <Button type="button" variant="outline" onClick={handleBack} disabled={busy}
              className="h-9 rounded-lg px-4 text-xs font-semibold">
              {t('common.cancel')}
            </Button>
            <Button type="submit"
              disabled={busy || !ticketTitle.trim() || !category || !description.trim() || uploading}
              className={cn('h-9 gap-2 rounded-lg px-5 text-xs font-bold text-white shadow-xs active:scale-95',
                isApp ? 'bg-primary' : 'bg-emerald-600 hover:bg-emerald-700')}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 stroke-[2.5]" />}
              {busy ? 'Submitting…' : t('tickets.createBtn', 'Submit Ticket')}
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  );
}

export default SubmitTicketPage;
