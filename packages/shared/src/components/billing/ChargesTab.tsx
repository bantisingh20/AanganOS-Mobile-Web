import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { maintenanceBilling } from '@shared/services';
import type { MaintenanceCharge } from '@shared/api/maintenanceBilling';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import { formatAmount } from './billingConstants';

export function ChargesTab({
  communityId,
  organizationId,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onOpenSet,
  onOpenBulk,
}: {
  communityId?: string;
  organizationId?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onOpenSet?: () => void;
  onOpenBulk?: () => void;
}) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceCharge | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const query = useAsync(
    (signal) =>
      communityId || organizationId
        ? maintenanceBilling.listCharges(communityId, organizationId, { signal }).catch(() => [] as MaintenanceCharge[])
        : Promise.resolve([] as MaintenanceCharge[]),
    [communityId, organizationId, reloadKey]
  );

  const items = useMemo(() => query.data ?? [], [query.data]);
  const reload = () => setReloadKey((k) => k + 1);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await maintenanceBilling.deactivateCharge(confirmDelete.id);
      toast.success(t('billing.chargeDeactivated'));
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  if (!communityId && !organizationId) {
    return (
      <div className="rounded-md border border-border/80 bg-card p-8 text-center text-xs text-muted-foreground">
        {t('billing.selectCommunityCharges')}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">
          {items.length} {t('billing.chargesFound', { defaultValue: 'charges configured' })}
        </span>
        <div className="flex items-center gap-1.5">
          {canAdd && onOpenBulk ? (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenBulk}
              className="h-7 px-2.5 rounded-[4px] text-[11px] font-medium border-border/80"
            >
              {t('billing.bulkSet')}
            </Button>
          ) : null}
          {canAdd && onOpenSet ? (
            <Button
              type="button"
              onClick={onOpenSet}
              className="h-7 px-2.5 rounded-[4px] text-[11px] font-medium"
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('billing.setCharge')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Container: Desktop Table + Mobile Cards */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            {query.loading ? t('common.loading') : t('billing.empty')}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    {!communityId ? <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.colCommunity')}</TH> : null}
                    <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.colUnit')}</TH>
                    <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.monthlyAmount')}</TH>
                    <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.chargeLabel')}</TH>
                    <TH className="w-24 py-1.5 px-2 text-[10.5px]">{t('billing.colStatus')}</TH>
                    {canDelete || canEdit ? <TH className="w-16 py-1.5 px-2 text-right text-[10.5px]">{t('orgs.colActions')}</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {items.map((c) => (
                    <TR key={c.id}>
                      {!communityId ? (
                        <TD className="text-[11px] text-muted-foreground py-1 px-2">{c.communityName || '—'}</TD>
                      ) : null}
                      <TD className="text-xs font-semibold py-1 px-2">{c.unitNumber ?? c.unitId}</TD>
                      <TD className="text-right text-xs tabular-nums font-semibold py-1 px-2">
                        ₹{formatAmount(c.amount)}
                      </TD>
                      <TD className="text-[11px] text-muted-foreground py-1 px-2">{c.label || '—'}</TD>
                      <TD className="py-1 px-2">
                        <Badge tone={c.isActive ? 'success' : 'muted'} className="text-[10px] px-1.5 py-0 rounded-[3px]">
                          <span className="h-1 w-1 rounded-full bg-current opacity-70 mr-1" />
                          {c.isActive ? t('billing.active') : t('billing.inactive')}
                        </Badge>
                      </TD>
                      {canDelete || canEdit ? (
                        <TD className="py-1 px-2 text-right">
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(c)}
                              aria-label={t('billing.delete')}
                              className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 ml-auto transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : null}
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-border/60">
              {items.map((c) => (
                <div key={c.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{c.unitNumber ?? c.unitId}</span>
                      <Badge tone={c.isActive ? 'success' : 'muted'} className="text-[9.5px] px-1 py-0 rounded-[3px]">
                        {c.isActive ? t('billing.active') : t('billing.inactive')}
                      </Badge>
                    </div>
                    {!communityId && c.communityName ? (
                      <div className="text-[10px] text-muted-foreground">{c.communityName}</div>
                    ) : null}
                    <div className="text-[11px] font-semibold text-foreground mt-0.5">₹{formatAmount(c.amount)} / mo</div>
                    {c.label ? <div className="text-[10px] text-muted-foreground">{c.label}</div> : null}
                  </div>
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(c)}
                      aria-label={t('billing.delete')}
                      className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('billing.delete')}
        description={t('billing.chargeDeleteConfirm')}
        confirmLabel={t('billing.delete')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
