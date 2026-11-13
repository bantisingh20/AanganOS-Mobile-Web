import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Check, X, UserCheck, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents, gate } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-primary/10 text-primary',
  rejected: 'bg-destructive/10 text-destructive',
};

export function MyVisitorsScreen({ initialTab = 'all' }: { initialTab?: 'all' | 'approvals' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perm = usePermission('approvals');
  const invitePerm = usePermission('my-visitors');
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const residentId = me.data?.resident?.id ?? null;
  const unitId = me.data?.units?.[0]?.unitId ?? null;

  const [tab, setTab] = useState<'all' | 'approvals'>(initialTab);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useAsync(
    (signal) =>
      unitId
        ? gate.listVisitors({ pageSize: 50, sort: 'createdAtUtc:desc' }, { hostUnitId: unitId, ...(tab === 'approvals' ? { status: 'pending' } : {}) }, { signal })
        : Promise.resolve(null),
    [unitId, tab],
  );
  const items = list.data?.items ?? [];

  const decide = async (id: string, approve: boolean) => {
    if (!residentId || busyId) return;
    setBusyId(id);
    try {
      if (approve) await gate.approveVisitor(id, { approvingResidentId: residentId });
      else await gate.rejectVisitor(id, { rejectingResidentId: residentId });
      list.reload();
    } catch {
      void 0;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageLayout
      title={t('myVisitors.title')}
      subtitle={t('myVisitors.subtitle')}
      right={
        invitePerm.canAdd && unitId ? (
          <button type="button" onClick={() => navigate('/invite-visitor')} aria-label={t('myVisitors.invite')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15">
            <Plus className="h-5 w-5" />
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex rounded-full bg-muted p-1">
          {(['all', 'approvals'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setTab(f)} className={cn('flex-1 rounded-full py-1.5 text-sm font-bold transition-colors', tab === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t(f === 'all' ? 'myVisitors.title' : 'myVisitors.approvals')}
            </button>
          ))}
        </div>

        {me.loading || list.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t(tab === 'approvals' ? 'myVisitors.noApprovals' : 'myVisitors.empty')}</p>
          </div>
        ) : (
          items.map((v) => {
            const canDecide = tab === 'approvals' && v.status === 'pending' && perm.canApprove;
            return (
              <article key={v.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><UserCheck className="h-5 w-5 text-primary" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-extrabold">{v.name}</div>
                    <div className="truncate text-xs capitalize text-muted-foreground">{v.category}{v.purpose ? ` · ${v.purpose}` : ''}</div>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize', STATUS_CLASS[v.status] ?? 'bg-muted text-muted-foreground')}>{v.status}</span>
                </div>
                {canDecide ? (
                  <div className="flex gap-2 border-t border-border pt-3">
                    <button type="button" disabled={busyId === v.id} onClick={() => decide(v.id, false)} className="flex flex-1 items-center justify-center gap-1 rounded-xl border-2 border-destructive/30 py-2 text-sm font-bold text-destructive disabled:opacity-50">
                      <X className="h-4 w-4" /> {t('myVisitors.reject')}
                    </button>
                    <button type="button" disabled={busyId === v.id} onClick={() => decide(v.id, true)} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                      <Check className="h-4 w-4" /> {t('myVisitors.approve')}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </PageLayout>
  );
}
