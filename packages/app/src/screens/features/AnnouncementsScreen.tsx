import { useState } from 'react';
import { Megaphone, Calendar, Wrench, AlertTriangle, Plus, Pencil, Trash2, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { announcements, masterData } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { useAuth } from '@shared/store/AuthContext';
import type { Announcement } from '@shared/api/announcements';
import { PageLayout } from '@app/components/PageLayout';
import { Dialog, DialogHeader, DialogFooter } from '@shared/components/ui/dialog';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { TextField } from '@shared/components/TextField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { Field } from '@shared/components/Field';
import { Button } from '@shared/components/ui/button';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { FormBanner } from '@shared/components/FormBanner';
import { toFormError, type FormErrorView } from '@shared/api/errors';

const CATEGORY_META: Record<string, { icon: LucideIcon; tint: string }> = {
  maintenance: { icon: Wrench, tint: '#05b872' },
  event: { icon: Calendar, tint: '#0ea5e9' },
  emergency: { icon: AlertTriangle, tint: '#dc2626' },
  general: { icon: Megaphone, tint: '#0ea5e9' },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export function AnnouncementsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const perm = usePermission('announcements');
  const communityId = user?.communityId ?? null;

  const query = useAsync((signal) => announcements.list({ pageSize: 50, sort: 'publishedAtUtc:desc' }, {}, { signal }), []);
  const items = query.data?.items ?? [];

  const [editing, setEditing] = useState<Announcement | null>(null);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const removeNow = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await announcements.remove(toDelete.id);
      setToDelete(null);
      query.reload();
    } catch {
      void 0;
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageLayout
      title={t('announcements.title')}
      right={
        perm.canAdd ? (
          <button type="button" onClick={() => setAdding(true)} aria-label={t('announcements.add')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15">
            <Plus className="h-5 w-5" />
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        {query.loading ? (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : query.error ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-destructive">{query.error.message}</p>
            <button type="button" onClick={query.reload} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">{t('common.retry')}</button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('announcements.empty')}</p>
          </div>
        ) : (
          items.map((a) => {
            const meta = CATEGORY_META[a.category] ?? CATEGORY_META.general!;
            return (
              <article key={a.id} className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.tint}1f` }}>
                    <meta.icon className="h-5 w-5" style={{ color: meta.tint }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-[15px] font-extrabold leading-tight">{a.title}</h2>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatDate(a.publishedAtUtc)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                  </div>
                </div>
                {perm.canEdit || perm.canDelete ? (
                  <div className="flex justify-end gap-2 border-t border-border pt-2">
                    {perm.canEdit ? (
                      <button type="button" onClick={() => setEditing(a)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-accent">
                        <Pencil className="h-3.5 w-3.5" /> {t('announcements.edit')}
                      </button>
                    ) : null}
                    {perm.canDelete ? (
                      <button type="button" onClick={() => setToDelete(a)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" /> {t('announcements.delete')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {adding ? (
        <AnnouncementDialog communityId={communityId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); query.reload(); }} />
      ) : null}
      {editing ? (
        <AnnouncementDialog communityId={communityId} announcement={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); query.reload(); }} />
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        tone="danger"
        title={t('announcements.delete')}
        description={toDelete ? t('announcements.deleteConfirm', { title: toDelete.title }) : ''}
        confirmLabel={t('announcements.delete')}
        cancelLabel={t('common.cancel')}
        busy={deleting}
        onConfirm={removeNow}
        onClose={() => setToDelete(null)}
      />
    </PageLayout>
  );
}

function AnnouncementDialog({
  communityId, announcement, onClose, onSaved,
}: {
  communityId: string | null;
  announcement?: Announcement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!announcement;
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [body, setBody] = useState(announcement?.body ?? '');
  const [category, setCategory] = useState<string | null>(announcement?.category ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormErrorView | null>(null);

  const cats = useAsync((signal) => masterData.list('Announcement_Category', communityId, { signal }).catch(() => []), [communityId]);
  const categoryOptions: SelectOption[] = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const fallbackOptions: SelectOption[] = [
    { value: 'general', label: 'General' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'event', label: 'Event' },
    { value: 'emergency', label: 'Emergency' },
  ];
  const options = categoryOptions.length > 0 ? categoryOptions : fallbackOptions;

  const valid = title.trim().length > 0 && body.trim().length > 0 && !!category;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isEdit && announcement) {
        await announcements.update(announcement.id, { title: title.trim(), body: body.trim(), category: category! });
      } else {
        if (!communityId) {
          setError({ message: t('announcements.needCommunity'), fieldErrors: {} });
          setBusy(false);
          return;
        }
        await announcements.create({ communityId, title: title.trim(), body: body.trim(), category: category! });
      }
      onSaved();
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title={isEdit ? t('announcements.editTitle') : t('announcements.addTitle')} />
      <div className="flex flex-col gap-3">
        {error ? <FormBanner message={error.message} /> : null}
        <TextField label={t('announcements.titleLabel')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('announcements.titlePlaceholder')} />
        <SelectField label={t('announcements.category')} value={category} options={options} placeholder={t('announcements.selectCategory')} onChange={setCategory} />
        <Field label={t('announcements.bodyLabel')}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('announcements.bodyPlaceholder')}
            rows={4}
            className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy} className="h-10 rounded-xl">{t('common.cancel')}</Button>
        <PrimaryButton className="h-10 w-auto px-5" arrow={false} label={isEdit ? t('announcements.saveChanges') : t('announcements.publish')} loading={busy} disabled={!valid} onClick={save} />
      </DialogFooter>
    </Dialog>
  );
}
