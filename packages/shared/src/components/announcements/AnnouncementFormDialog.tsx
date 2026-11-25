import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { announcements, communities, organizations } from '@shared/services';
import type { Announcement } from '@shared/api/announcements';
import { useAuth } from '@shared/store/AuthContext';
import { useScope } from '@shared/lib/useScope';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';

export const ALL_WINGS = '__all_wings__';

const fetchOrg = (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
  organizations.list({ search: search || undefined, page, pageSize }, { signal })
    .then((d) => ({ items: d.items.map((o) => ({ value: o.id, label: o.name })), total: d.totalCount }));

export function AnnouncementFormDialog({
  open,
  announcement,
  categoryOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  announcement?: Announcement | null;
  categoryOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const scope = useScope();
  const isEdit = !!announcement;

  const [orgId, setOrgId] = useState('');
  const [commId, setCommId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(announcement?.title ?? '');
    setBody(announcement?.body ?? '');
    setCategory(announcement?.category ?? 'general');
    setOrgId(announcement?.organizationId ?? scope.organizationId ?? user?.organizationId ?? '');
    setCommId(
      announcement?.communityId && announcement.communityId !== '00000000-0000-0000-0000-000000000000'
        ? announcement.communityId
        : (scope.scopedCommunityId ?? user?.communityId ?? '')
    );
  }, [open, announcement, scope, user]);

  const activeOrgId = orgId || scope.organizationId || user?.organizationId;
  const commsQuery = useAsync(
    (sig) =>
      open && (scope.isPowerUser || scope.isOrgAdmin)
        ? communities.list({ pageSize: 100 }, activeOrgId ? { organizationId: activeOrgId } : {}, { signal: sig }).catch(() => null)
        : Promise.resolve(null),
    [open, scope.isPowerUser, scope.isOrgAdmin, activeOrgId]
  );
  const commOptions = useMemo(
    () => [{ value: ALL_WINGS, label: 'All Wings (Society-wide)' }, ...(commsQuery.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))],
    [commsQuery.data]
  );

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (busy || !title.trim() || !body.trim()) return;
    const finalOrgId = orgId || scope.organizationId || user?.organizationId || undefined;
    const finalCommId = commId && commId !== ALL_WINGS ? commId : undefined;
    if (scope.showOrgFilter && !finalOrgId) {
      toast.error('Please select a society (organization).');
      return;
    }

    setBusy(true);
    try {
      if (isEdit) {
        await announcements.update(announcement.id, { title: title.trim(), body: body.trim(), category });
        toast.success(t('announcements.updated', { defaultValue: 'Announcement updated' }));
      } else {
        await announcements.create({ title: title.trim(), body: body.trim(), category, organizationId: finalOrgId, communityId: finalCommId });
        toast.success(t('announcements.created', { defaultValue: 'Announcement published successfully' }));
      }
      onSaved();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md rounded-lg p-5">
      <DialogHeader
        title={
          isEdit
            ? t('announcements.editTitle', { defaultValue: 'Edit Announcement' })
            : t('announcements.addTitle', { defaultValue: 'New Announcement' })
        }
      />
      <form onSubmit={submit} className="flex flex-col gap-3 pt-1">
        {scope.showOrgFilter && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('announcements.organization', { defaultValue: 'Society (Organization)' })} *
            </label>
            <EntitySelect
              value={orgId || null}
              onChange={(v) => {
                setOrgId(v ?? '');
                setCommId('');
              }}
              fetchPage={fetchOrg}
              resolveLabel={(id, sig) => organizations.get(id, { signal: sig }).then((o) => o.name).catch(() => null)}
              placeholder="Select Society (Organization)"
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3"
            />
          </div>
        )}
        {(scope.isPowerUser || scope.isOrgAdmin) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('announcements.community', { defaultValue: 'Wing / Community' })}
            </label>
            <Select value={commId || ALL_WINGS} onValueChange={(v) => setCommId(v === ALL_WINGS ? '' : v)}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {commOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('announcements.colCategory', { defaultValue: 'Category' })} *
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('announcements.titleField', { defaultValue: 'Title' })} *
            </label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Water tank cleaning"
              maxLength={200}
              disabled={busy}
              className="h-9 text-xs rounded-[4px]"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            {t('announcements.bodyField', { defaultValue: 'Message' })} *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Type announcement details..."
            disabled={busy}
            className="w-full rounded-[4px] border border-input bg-background p-2.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </div>
        <div className="mt-2 pt-3 border-t border-border/70 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80"
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="submit"
            disabled={busy || !title.trim() || !body.trim()}
            className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
          >
            {busy ? t('common.saving') : isEdit ? t('common.save', { defaultValue: 'Save Changes' }) : t('announcements.publish', { defaultValue: 'Publish Notice' })}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
