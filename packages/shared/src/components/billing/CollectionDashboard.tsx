import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, THead, TBody, TR, TH, TD } from '@shared/components/ui/table';
import { maintenanceBilling } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { formatAmount } from './billingConstants';

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
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{st.label}</div>
            <div className={`mt-0.5 text-base font-bold tabular-nums ${st.color}`}>₹{formatAmount(st.value)}</div>
          </div>
        ))}
      </div>

      {/* Summary Table */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <THead>
              <TR>
                {showOrg ? <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.colOrganization')}</TH> : null}
                <TH className="py-1.5 px-2 text-[10.5px]">{t('billing.colCommunity')}</TH>
                <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.colCollected')}</TH>
                <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.colReceived', { defaultValue: 'Credits / Other' })}</TH>
                <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.colSpent')}</TH>
                <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.colBalance')}</TH>
                <TH className="text-right py-1.5 px-2 text-[10.5px]">{t('billing.colOutstanding')}</TH>
              </TR>
            </THead>
            <TBody>
              {s.byCommunity.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    {t('billing.empty')}
                  </TD>
                </TR>
              ) : (
                s.byCommunity.map((c) => (
                  <TR key={c.communityId}>
                    {showOrg ? <TD className="text-[11px] text-muted-foreground py-1 px-2">{c.organizationName || '—'}</TD> : null}
                    <TD className="text-xs font-semibold py-1 px-2">{c.communityName}</TD>
                    <TD className="text-right text-xs tabular-nums text-emerald-600 font-semibold py-1 px-2">₹{formatAmount(c.collected)}</TD>
                    <TD className="text-right text-xs tabular-nums text-emerald-600 font-semibold py-1 px-2">₹{formatAmount(c.received ?? 0)}</TD>
                    <TD className="text-right text-xs tabular-nums text-rose-600 font-semibold py-1 px-2">₹{formatAmount(c.spent ?? 0)}</TD>
                    <TD className="text-right text-xs tabular-nums font-bold py-1 px-2">
                      ₹{formatAmount(c.collected + (c.received ?? 0) - (c.spent ?? 0))}
                    </TD>
                    <TD className="text-right text-xs tabular-nums text-amber-600 font-semibold py-1 px-2">₹{formatAmount(c.outstanding)}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-border/60">
          {s.byCommunity.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">{t('billing.empty')}</div>
          ) : (
            s.byCommunity.map((c) => (
              <div key={c.communityId} className="p-2.5 flex flex-col gap-1.5">
                <div className="text-xs font-bold text-foreground">{c.communityName}</div>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Collected: </span>
                    <span className="font-semibold text-emerald-600">₹{formatAmount(c.collected)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Spent: </span>
                    <span className="font-semibold text-rose-600">₹{formatAmount(c.spent ?? 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Balance: </span>
                    <span className="font-bold">₹{formatAmount(c.collected + (c.received ?? 0) - (c.spent ?? 0))}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dues: </span>
                    <span className="font-semibold text-amber-600">₹{formatAmount(c.outstanding)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
