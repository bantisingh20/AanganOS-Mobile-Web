import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Plus, Car, User } from 'lucide-react';
import { securityOps, masterData, residents } from '@shared/services';
import type { WatchlistEntry } from '@shared/api/securityOps';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';
import { BottomSheet } from '@shared/components/ui/bottom-sheet';
import { TextField } from '@shared/components/TextField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { PrimaryButton } from '@shared/components/PrimaryButton';

const SEVERITY_META: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  critical: 'bg-destructive/10 text-destructive',
  medium: 'bg-amber-500/10 text-amber-600',
  low: 'bg-sky-500/10 text-sky-600',
};

function humanize(code: string): string {
  return code.split(/[_\s]+/).map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');
}

export function WatchlistScreen() {
  const { t } = useTranslation();
  const perm = usePermission('watchlist');
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const communityId = me.data?.units?.[0]?.communityId ?? me.data?.resident?.communityId ?? null;

  const query = useAsync((signal) => securityOps.listWatchlist({ pageSize: 50, sort: 'createdAtUtc:desc' }, { status: 'active' }, { signal }), []);
  const items = query.data?.items ?? [];

  const [sheet, setSheet] = useState(false);
  const [subjectType, setSubjectType] = useState('');
  const [subjectIdentifier, setSubjectIdentifier] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('');

  const subjectTypes = useAsync((signal) => masterData.list('Watchlist_Subject_Type', communityId, { signal }).catch(() => []), [communityId]);
  const severities = useAsync((signal) => masterData.list('Watchlist_Severity', communityId, { signal }).catch(() => []), [communityId]);
  const subjectOptions: SelectOption[] = (subjectTypes.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const severityOptions: SelectOption[] = (severities.data ?? []).map((c) => ({ value: c.code, label: c.label }));

  const add = useAsyncAction(async () => {
    if (!communityId || !subjectType || !subjectIdentifier.trim() || !reason.trim() || !severity) return;
    await securityOps.addWatchlistEntry({
      communityId,
      subjectType,
      subjectIdentifier: subjectIdentifier.trim(),
      reason: reason.trim(),
      severity,
    });
    setSheet(false);
    setSubjectType(''); setSubjectIdentifier(''); setReason(''); setSeverity('');
    query.reload();
  });

  const clear = useAsyncAction(async (id: string) => {
    await securityOps.clearWatchlistEntry(id);
    query.reload();
  });

  const canAddNow = Boolean(communityId && subjectType && subjectIdentifier.trim() && reason.trim() && severity);

  return (
    <PageLayout
      title={t('watchlist.title')}
      subtitle={t('watchlist.subtitle')}
      right={perm.canAdd ? (
        <button type="button" onClick={() => setSheet(true)} aria-label={t('watchlist.add')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15">
          <Plus className="h-5 w-5" />
        </button>
      ) : undefined}
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        {query.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('watchlist.empty')}</p>
          </div>
        ) : (
          items.map((w: WatchlistEntry) => (
            <article key={w.id} className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                {w.subjectType.toLowerCase().includes('vehicle') ? <Car className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-[15px] font-extrabold">{w.subjectIdentifier}</h2>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', SEVERITY_META[w.severity] ?? 'bg-muted text-muted-foreground')}>{humanize(w.severity)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{humanize(w.subjectType)}</p>
                <p className="mt-1 text-sm">{w.reason}</p>
                {perm.canAdd ? (
                  <button type="button" onClick={() => clear.run(w.id)} disabled={clear.running} className="mt-2 rounded-full border border-border px-3 py-1 text-xs font-bold disabled:opacity-50">
                    {t('watchlist.clear')}
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>

      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t('watchlist.addTitle')}
        footer={<PrimaryButton label={t('watchlist.add')} arrow={false} loading={add.running} disabled={!canAddNow} onClick={() => add.run()} />}
      >
        <div className="flex flex-col gap-3">
          <SelectField label={t('watchlist.subjectType')} required value={subjectType} options={subjectOptions} placeholder={t('watchlist.selectSubjectType')} onChange={setSubjectType} />
          <TextField label={t('watchlist.subjectIdentifier')} requiredMark value={subjectIdentifier} onChange={(e) => setSubjectIdentifier(e.target.value)} placeholder={t('watchlist.subjectIdentifierPlaceholder')} />
          <SelectField label={t('watchlist.severity')} required value={severity} options={severityOptions} placeholder={t('watchlist.selectSeverity')} onChange={setSeverity} />
          <TextField label={t('watchlist.reason')} requiredMark value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('watchlist.reasonPlaceholder')} />
          {add.error ? <p className="text-sm text-destructive">{add.error.message}</p> : null}
        </div>
      </BottomSheet>
    </PageLayout>
  );
}
