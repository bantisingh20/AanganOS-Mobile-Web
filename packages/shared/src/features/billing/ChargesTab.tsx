import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { FilterBar, DataList, type FilterLayout } from '@shared/components/layout';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';
import { cn } from '@shared/lib/utils';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { CommonEntitySelector } from '@shared/components/form/CommonEntitySelector';
import { maintenanceBilling } from '@shared/services';
import type { MaintenanceCharge } from '@shared/api/maintenanceBilling';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useScope } from '@shared/lib/hooks/useScope';
import { tryToast } from '@shared/lib/withToast';
import { RefreshButton } from '@shared/components/ui/refresh-button';
import { EMPTY, formatMoney } from '@shared/lib/format';

export function ChargesTab({
  communityId,
  organizationId,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  onOpenSet,
  onOpenBulk,
  onCommunityChange,
  onOrgChange,
}: {
  communityId?: string;
  organizationId?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onOpenSet?: () => void;
  onOpenBulk?: () => void;
  onCommunityChange?: (communityId: string | null) => void;
  onOrgChange?: (orgId: string | null) => void;
}) {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const scope = useScope();
  const [internalOrgId, setInternalOrgId] = useState<string | null>(organizationId ?? scope.organizationId ?? null);
  const [internalCommunityId, setInternalCommunityId] = useState<string | null>(communityId ?? scope.scopedCommunityId ?? null);
  const [internalUnitId, setInternalUnitId] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId !== undefined) setInternalOrgId(organizationId);
  }, [organizationId]);

  useEffect(() => {
    if (communityId !== undefined) setInternalCommunityId(communityId);
  }, [communityId]);

  const effectiveOrgId = internalOrgId || (scope.organizationId ?? undefined);
  const effectiveCommunityId = internalCommunityId || (scope.scopedCommunityId ?? undefined);

  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceCharge | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const query = useAsync(
    (signal) =>
      effectiveCommunityId || effectiveOrgId
        ? maintenanceBilling.listCharges(effectiveCommunityId ?? undefined, effectiveOrgId ?? undefined, { signal }).catch(() => [] as MaintenanceCharge[])
        : Promise.resolve([] as MaintenanceCharge[]),
    [effectiveCommunityId, effectiveOrgId, reloadKey]
  );

  const items = useMemo(() => {
    let raw = query.data ?? [];
    if (internalUnitId) {
      raw = raw.filter((c) => c.unitId === internalUnitId);
    }
    return [...raw].sort((a, b) => {
      const uA = (a.unitNumber ?? a.unitId ?? '').trim();
      const uB = (b.unitNumber ?? b.unitId ?? '').trim();
      return uA.localeCompare(uB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [query.data, internalUnitId]);

  const reload = () => setReloadKey((k) => k + 1);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => maintenanceBilling.deactivateCharge(confirmDelete.id), t('billing.chargeDeactivated'))) {
        setConfirmDelete(null);
        reload();
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const deleteBtn = compact
    ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-300 text-rose-600 dark:border-rose-800'
    : 'ml-auto flex h-6 w-6 items-center justify-center rounded-[3px] border border-rose-300 text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40';

  const renderFilters = (layout: FilterLayout) => (
    <CommonEntitySelector
      level={3}
      selectedOrgId={effectiveOrgId}
      selectedCommunityId={effectiveCommunityId}
      selectedUnitId={internalUnitId}
      onOrgChange={(o) => {
        setInternalOrgId(o);
        setInternalCommunityId(null);
        setInternalUnitId(null);
        onOrgChange?.(o);
        onCommunityChange?.(null);
      }}
      onCommunityChange={(c) => {
        setInternalCommunityId(c);
        setInternalUnitId(null);
        onCommunityChange?.(c);
      }}
      onUnitChange={setInternalUnitId}
      showLabels={layout === 'sheet'}
      size={layout === 'sheet' ? 'default' : 'sm'}
      className={layout === 'sheet' ? 'flex-col !items-stretch [&>div]:w-full' : ''}
    />
  );

  return (
    <div className="space-y-2.5">
      <FilterBar
        filters={renderFilters}
        activeCount={internalUnitId ? 1 : 0}
        onReset={() => setInternalUnitId(null)}
        trailing={(
          <>
            <span className={cn('tabular-nums text-muted-foreground', compact ? 'text-xs' : 'text-[11px]')}>
              {t('billing.chargesFound', { count: items.length, defaultValue: '{{count}} charge(s) found' })}
            </span>
            <div className="flex items-center gap-1.5">
              {canAdd && onOpenBulk ? (
                <Button type="button" variant="outline" onClick={onOpenBulk}
                  className={cn('border-border/80 font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 rounded-[4px] px-2.5 text-[11px]')}>
                  {t('billing.bulkSet')}
                </Button>
              ) : null}
              {canAdd && onOpenSet ? (
                <Button type="button" onClick={onOpenSet}
                  className={cn('font-medium', compact ? 'h-9 px-3 text-sm' : 'h-7 rounded-[4px] px-2.5 text-[11px]')}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('billing.setCharge')}
                </Button>
              ) : null}
              <RefreshButton onClick={reload} loading={query.loading} />
            </div>
          </>
        )}
      />

      <DataList
        items={items}
        keyOf={(c) => c.id}
        loading={query.loading}
        emptyText={!effectiveOrgId && !effectiveCommunityId
          ? t('billing.selectScopeForCharges', { defaultValue: 'Select a society and wing to view charges' })
          : t('billing.empty')}
        renderCard={(c) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{c.unitNumber ?? c.unitId}</span>
                <Badge tone={c.isActive ? 'success' : 'muted'} className="rounded-[3px] px-1.5 py-0 text-[10px]">
                  {c.isActive ? t('billing.active') : t('billing.inactive')}
                </Badge>
              </div>
              {!effectiveCommunityId && c.communityName ? <div className="text-xs text-muted-foreground">{c.communityName}</div> : null}
              <div className="mt-0.5 text-sm font-semibold text-foreground">{formatMoney(c.amount, { decimals: true })} / mo</div>
              {c.label ? <div className="text-xs text-muted-foreground">{c.label}</div> : null}
            </div>
            {canDelete ? (
              <button type="button" onClick={() => setConfirmDelete(c)} aria-label={t('billing.delete')} className={deleteBtn}>
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR>
                {!effectiveCommunityId ? <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.colCommunity')}</TH> : null}
                <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.colUnit')}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.monthlyAmount')}</TH>
                <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.chargeLabel')}</TH>
                <TH className="w-24 px-2 py-1.5 text-[10.5px]">{t('billing.colStatus')}</TH>
                {canDelete || canEdit ? <TH className="w-16 px-2 py-1.5 text-right text-[10.5px]">{t('common.actions')}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {items.map((c) => (
                <TR key={c.id}>
                  {!effectiveCommunityId ? <TD className="px-2 py-1 text-[11px] text-muted-foreground">{c.communityName || EMPTY}</TD> : null}
                  <TD className="px-2 py-1 text-xs font-semibold">{c.unitNumber ?? c.unitId}</TD>
                  <TD className="px-2 py-1 text-right text-xs font-semibold tabular-nums">{formatMoney(c.amount, { decimals: true })}</TD>
                  <TD className="px-2 py-1 text-[11px] text-muted-foreground">{c.label || EMPTY}</TD>
                  <TD className="px-2 py-1">
                    <Badge tone={c.isActive ? 'success' : 'muted'} className="rounded-[3px] px-1.5 py-0 text-[10px]">
                      <span className="mr-1 h-1 w-1 rounded-full bg-current opacity-70" />
                      {c.isActive ? t('billing.active') : t('billing.inactive')}
                    </Badge>
                  </TD>
                  {canDelete || canEdit ? (
                    <TD className="px-2 py-1 text-right">
                      {canDelete ? (
                        <button type="button" onClick={() => setConfirmDelete(c)} aria-label={t('billing.delete')} className={deleteBtn}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : null}
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t('billing.delete')}
        description={t('billing.chargeDeleteConfirm')}
        confirmLabel={t('billing.delete')}
        cancelLabel={t('common.cancel')}
        busy={confirmBusy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default ChargesTab;
