import { useState } from 'react';
import { Plus, Receipt, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@shared/components/ui/button';
import { PageShell, ResponsiveTabs } from '@shared/components/layout';
import { SurfaceProvider, useResolvedSurface } from '@shared/lib/surface';
import { useIsCompact } from '@shared/lib/hooks/useMediaQuery';

import { maintenanceBilling } from '@shared/services';
import type { MaintenanceBill } from '@shared/api/maintenanceBilling';
import { useScope } from '@shared/lib/hooks/useScope';
import { usePermission } from '@shared/lib/hooks/usePermission';
import { tryToast } from '@shared/lib/withToast';

import {
  type Tab,
} from './billingConstants';
import { BillsTab } from './BillsTab';
import { ChargesTab } from './ChargesTab';
import { ExpensesTab } from './ExpensesTab';
import { CollectionDashboard } from './CollectionDashboard';
import { BillingCommonDialogs } from './BillingCommonDialogs';

export interface MaintenanceBillingViewProps {
  /** @deprecated The host app is set once with <SurfaceProvider>; only pass this to override it. */
  mode?: 'admin' | 'mobile';
  permKey?: string;
  onBack?: () => void;
}

export function MaintenanceBillingView(props: MaintenanceBillingViewProps) {
  const surface = useResolvedSurface(props.mode);
  return <SurfaceProvider value={surface}><MaintenanceBilling {...props} /></SurfaceProvider>;
}

function MaintenanceBilling({ permKey, onBack }: MaintenanceBillingViewProps) {
  const { t } = useTranslation();

  const scope = useScope();
  const surface = useResolvedSurface();
  const compact = useIsCompact();

  // Permissions
  // Page rights from this route's DB menu row (or an explicit resource if a caller passes one).
  // Charges / expenses / payments are sub-resources with no route of their own, so they stay explicit.
  const perm = usePermission(permKey);
  const chargePerm = usePermission('MaintenanceCharge');
  const expensePerm = usePermission('MaintenanceExpense');
  const paymentPerm = usePermission('MaintenancePayment');

  const isAdmin = perm.isAdmin;
  const canAddBill = isAdmin || perm.canAdd;
  const canEditBill = isAdmin || perm.canEdit;
  const canRecordPayment = isAdmin || paymentPerm.canAdd || perm.canEdit;
  const canApprovePayment = isAdmin || paymentPerm.canApprove || perm.canApprove;

  const canAddCharge = isAdmin || chargePerm.canAdd || perm.canAdd;
  const canEditCharge = isAdmin || chargePerm.canEdit || perm.canEdit;
  const canDeleteCharge = isAdmin || chargePerm.canDelete || chargePerm.canEdit || perm.canDelete;

  const canAddExpense = isAdmin || expensePerm.canAdd || perm.canAdd;
  const canEditExpense = isAdmin || expensePerm.canEdit || perm.canEdit;
  const canDeleteExpense = isAdmin || expensePerm.canDelete || perm.canDelete;

  // Active Tab & Filters (Order: Dashboard -> Expenses -> Bills -> Charges)
  const [tab, setTab] = useState<Tab>('dashboard');
  const [filterOrgId, setFilterOrgId] = useState<string | null>(scope.organizationId ?? null);
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(scope.scopedCommunityId ?? null);

  // Dialog state triggers
  const [generating, setGenerating] = useState(false);
  const [charging, setCharging] = useState(false);
  const [bulkCharging, setBulkCharging] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [approvalsCommunityId, setApprovalsCommunityId] = useState<string | null>(null);
  const [payingBill, setPayingBill] = useState<MaintenanceBill | null>(null);
  const [confirmWaive, setConfirmWaive] = useState<MaintenanceBill | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);

  const effectiveCommunityId = filterCommunityId || (scope.scopedCommunityId ?? undefined);
  const effectiveOrgId = filterOrgId || (scope.organizationId ?? undefined);
  const showCommunityCol = !effectiveCommunityId || scope.canViewCommunity;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: t('billing.tabDashboard') },
    { key: 'expenses', label: t('billing.tabExpenses') },
    { key: 'bills', label: t('billing.tabBills') },
    { key: 'charges', label: t('billing.tabCharges') },
  ];

  const doWaive = async () => {
    if (!confirmWaive) return;
    setConfirmBusy(true);
    try {
      if (await tryToast(() => maintenanceBilling.waiveBill(confirmWaive.id), t('billing.waived'))) {
        setConfirmWaive(null);
        setRefreshSeed((s) => s + 1);
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const commonDialogs = (
    <BillingCommonDialogs
      generating={generating}
      charging={charging}
      bulkCharging={bulkCharging}
      approvalsCommunityId={approvalsCommunityId}
      payingBill={payingBill}
      confirmWaive={confirmWaive}
      confirmBusy={confirmBusy}
      canApprovePayment={canApprovePayment}
      effectiveCommunityId={effectiveCommunityId}
      effectiveOrgId={effectiveOrgId}
      onCloseGenerating={() => setGenerating(false)}
      onCloseCharging={() => setCharging(false)}
      onCloseBulkCharging={() => setBulkCharging(false)}
      onCloseApprovals={() => setApprovalsCommunityId(null)}
      onClosePaying={() => setPayingBill(null)}
      onCloseWaive={() => setConfirmWaive(null)}
      onConfirmWaive={doWaive}
      onRefresh={() => setRefreshSeed((s) => s + 1)}
    />
  );

  // Main Tab Content
  const tabContent = (
    <div key={refreshSeed} className="pt-1">
      {tab === 'bills' && (
        <BillsTab
          effectiveCommunityId={effectiveCommunityId}
          effectiveOrgId={effectiveOrgId}
          showCommunityCol={showCommunityCol}
          showOrgFilter={scope.showOrgFilter}
          showCommunityFilter={scope.showCommunityFilter}
          filterOrgId={filterOrgId}
          filterCommunityId={filterCommunityId}
          onOrgChange={(o) => {
            setFilterOrgId(o);
            setFilterCommunityId(null);
          }}
          onCommunityChange={setFilterCommunityId}
          canRecordPayment={canRecordPayment}
          canEditBill={canEditBill}
          canApprovePayment={canApprovePayment}
          canAddBill={canAddBill}
          onPayBill={(b) => setPayingBill(b)}
          onWaiveBill={(b) => setConfirmWaive(b)}
          onReviewApprovals={(commId) => setApprovalsCommunityId(commId)}
          onOpenGenerate={() => setGenerating(true)}
        />
      )}

      {tab === 'charges' && (
        <ChargesTab
          communityId={effectiveCommunityId}
          organizationId={effectiveOrgId}
          canAdd={canAddCharge}
          canEdit={canEditCharge}
          canDelete={canDeleteCharge}
          onOpenSet={() => setCharging(true)}
          onOpenBulk={() => setBulkCharging(true)}
          onCommunityChange={setFilterCommunityId}
          onOrgChange={(o) => {
            setFilterOrgId(o);
            setFilterCommunityId(null);
          }}
        />
      )}

      {tab === 'expenses' && (
        <ExpensesTab
          communityId={effectiveCommunityId}
          organizationId={effectiveOrgId}
          adding={addingExpense}
          canAdd={canAddExpense}
          canEdit={canEditExpense}
          canDelete={canDeleteExpense}
          onCloseAdd={() => setAddingExpense(false)}
          onCommunityChange={setFilterCommunityId}
          onOrgChange={(o) => {
            setFilterOrgId(o);
            setFilterCommunityId(null);
          }}
        />
      )}

      {tab === 'dashboard' && (
        <CollectionDashboard
          communityId={effectiveCommunityId}
          organizationId={effectiveOrgId}
          showOrg={!effectiveCommunityId}
        />
      )}
    </div>
  );

  const headerActions = (
    <>
      {canApprovePayment ? (
        <Button type="button" variant="outline" onClick={() => setApprovalsCommunityId(effectiveCommunityId ?? '')}
          className="h-7 rounded-[4px] border-border/80 px-2.5 text-[11px] font-medium">
          <ShieldCheck className="mr-1 h-3 w-3" />
          {t('billing.reviewApproval')}
        </Button>
      ) : null}
      {canAddCharge ? (
        <>
          <Button type="button" variant="outline" onClick={() => setBulkCharging(true)}
            className="h-7 rounded-[4px] border-border/80 px-2.5 text-[11px] font-medium">
            {t('billing.bulkSet')}
          </Button>
          <Button type="button" variant="outline" onClick={() => setCharging(true)}
            className="h-7 rounded-[4px] border-border/80 px-2.5 text-[11px] font-medium">
            <Plus className="mr-1 h-3 w-3" />
            {t('billing.setCharge')}
          </Button>
        </>
      ) : null}
      {canAddBill ? (
        <Button type="button" onClick={() => setGenerating(true)} className="h-7 rounded-[4px] px-2.5 text-[11px] font-medium">
          <Plus className="mr-1 h-3 w-3" />
          {t('billing.generate')}
        </Button>
      ) : null}
    </>
  );

  return (
    <PageShell
      title={t('billing.title')}
      icon={<Receipt />}
      subtitle={surface === 'admin' ? t('billing.subtitle') : undefined}
      // On phones each tab carries its own Generate / Set charge / Review buttons.
      actions={compact ? undefined : headerActions}
      onBack={onBack}
    >
      <ResponsiveTabs tabs={tabs} value={tab} onChange={setTab} />
      {tabContent}
      {commonDialogs}
    </PageShell>
  );
}

export { MaintenanceBillingView as MaintenanceBillingPage };
export default MaintenanceBillingView;
