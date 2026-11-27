import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { DataList } from '@shared/components/layout';
import { maintenanceBilling } from '@shared/services';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { EMPTY, formatMoney } from '@shared/lib/format';

export function CollectionDashboard({
  communityId,
  organizationId,
  showOrg,
}: {
  communityId?: string;
  organizationId?: string;
  showOrg: boolean;
}) {
  const { t } = useTranslation();
  const query = useAsync(
    (signal) => maintenanceBilling.collectionSummary(communityId, organizationId, { signal }).catch(() => null),
    [communityId, organizationId]
  );
  const s = query.data;

  const totalSpent = useMemo(() => (s ? s.byCommunity.reduce((sum, c) => sum + (c.spent ?? 0), 0) : 0), [s]);
  const totalReceived = useMemo(() => (s ? s.totalReceived ?? s.byCommunity.reduce((sum, c) => sum + (c.received ?? 0), 0) : 0), [s]);

  if (query.loading && !s) {
    return (
      <div className="rounded-md border border-border/80 bg-card p-10 text-center text-xs text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }
  if (!s) {
    return (
      <div className="rounded-md border border-border/80 bg-card p-10 text-center text-xs text-muted-foreground">
        {t('billing.empty')}
      </div>
    );
  }

  const overallInflow = s.totalCollected + totalReceived;
  const netBalance = overallInflow - totalSpent;

  const stats = [
    { label: t('billing.totalCollected', { defaultValue: 'Bill Collection' }), value: s.totalCollected, color: 'text-emerald-600' },
    { label: t('billing.totalReceivedStat', { defaultValue: 'Other Income' }), value: totalReceived, color: 'text-emerald-600' },
    { label: 'Total Inflow', value: overallInflow, color: 'text-primary font-bold' },
    { label: t('billing.totalSpentStat', { defaultValue: 'Total Spent' }), value: totalSpent, color: 'text-rose-600' },
    { label: t('billing.balanceFund', { defaultValue: 'Net Fund' }), value: netBalance, color: netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600' },
    { label: t('billing.totalOutstanding', { defaultValue: 'Outstanding Dues' }), value: s.totalOutstanding, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-3">
      {/* Stat Tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((st) => (
          <div key={st.label} className="rounded-md border border-border/80 bg-card p-2.5">
            <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{st.label}</div>
            <div className={`mt-0.5 text-base font-bold tabular-nums ${st.color}`}>{formatMoney(st.value, { decimals: true })}</div>
          </div>
        ))}
      </div>

      {/* Per-community summary */}
      <DataList
        items={s.byCommunity}
        keyOf={(c) => c.communityId}
        emptyText={t('billing.empty')}
        renderCard={(c) => (
          <>
            <div className="text-sm font-bold text-foreground">{c.communityName}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div><span className="text-muted-foreground">{t('billing.colCollected')}: </span><span className="font-semibold text-emerald-600">{formatMoney(c.collected, { decimals: true })}</span></div>
              <div><span className="text-muted-foreground">{t('billing.colSpent')}: </span><span className="font-semibold text-rose-600">{formatMoney(c.spent ?? 0, { decimals: true })}</span></div>
              <div><span className="text-muted-foreground">{t('billing.colBalance')}: </span><span className="font-bold">{formatMoney(c.collected + (c.received ?? 0) - (c.spent ?? 0), { decimals: true })}</span></div>
              <div><span className="text-muted-foreground">{t('billing.colOutstanding')}: </span><span className="font-semibold text-amber-600">{formatMoney(c.outstanding, { decimals: true })}</span></div>
            </div>
          </>
        )}
        renderTable={() => (
          <Table>
            <THead>
              <TR>
                {showOrg ? <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.colOrganization')}</TH> : null}
                <TH className="px-2 py-1.5 text-[10.5px]">{t('billing.colCommunity')}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.colCollected')}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.colReceived', { defaultValue: 'Credits / Other' })}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.colSpent')}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.colBalance')}</TH>
                <TH className="px-2 py-1.5 text-right text-[10.5px]">{t('billing.colOutstanding')}</TH>
              </TR>
            </THead>
            <TBody>
              {s.byCommunity.map((c) => (
                <TR key={c.communityId}>
                  {showOrg ? <TD className="px-2 py-1 text-[11px] text-muted-foreground">{c.organizationName || EMPTY}</TD> : null}
                  <TD className="px-2 py-1 text-xs font-semibold">{c.communityName}</TD>
                  <TD className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-emerald-600">{formatMoney(c.collected, { decimals: true })}</TD>
                  <TD className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-emerald-600">{formatMoney(c.received ?? 0, { decimals: true })}</TD>
                  <TD className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-rose-600">{formatMoney(c.spent ?? 0, { decimals: true })}</TD>
                  <TD className="px-2 py-1 text-right text-xs font-bold tabular-nums">{formatMoney(c.collected + (c.received ?? 0) - (c.spent ?? 0), { decimals: true })}</TD>
                  <TD className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-amber-600">{formatMoney(c.outstanding, { decimals: true })}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      />
    </div>
  );
}
