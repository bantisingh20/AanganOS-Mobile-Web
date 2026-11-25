import { useState } from 'react';
import { Receipt, Plus, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@shared/components/ui/button';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Toaster } from '@shared/components/ui/sonner';
import { HelpDeskHeader } from '@shared/help-desk/HelpDeskHeader';

import { maintenanceBilling } from '@shared/services';
import type { MaintenanceBill } from '@shared/api/maintenanceBilling';
import { useScope } from '@shared/lib/useScope';
import { usePermission } from '@shared/lib/usePermission';
import { toFormError } from '@shared/api/errors';
import { cn } from '@shared/lib/utils';

import {
  type Tab,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  formatAmount,
} from './billing/billingConstants';
import { BillsTab } from './billing/BillsTab';
import { ChargesTab } from './billing/ChargesTab';
import { ExpensesTab } from './billing/ExpensesTab';
import { CollectionDashboard } from './billing/CollectionDashboard';
import { GenerateBillsDialog } from './billing/GenerateBillsDialog';
import { RecordPaymentDialog } from './billing/RecordPaymentDialog';
import { SetChargeDialog } from './billing/SetChargeDialog';
import { BulkSetChargeDialog } from './billing/BulkSetChargeDialog';
import { ApprovalsDialog } from './billing/ApprovalsDialog';

export interface MaintenanceBillingViewProps {
  mode?: 'admin' | 'mobile';
  permKey?: string;
  onBack?: () => void;
}

export function MaintenanceBillingView({ mode = 'admin', permKey, onBack }: MaintenanceBillingViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scope = useScope();
  const isMobile = mode === 'mobile';
  const handleBack = onBack ?? (() => navigate(-1));

  // Permissions
  const effectivePermKey = permKey || 'billing';
  const perm = usePermission(effectivePermKey);
  const chargePerm = usePermission('MaintenanceCharge');
  const expensePerm = usePermission('MaintenanceExpense');
  const paymentPerm = usePermission('MaintenancePayment');

  const isAdmin = perm.isAdmin || scope.isPowerUser || scope.isOrgAdmin;
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

  // Active Tab & Filters
  const [tab, setTab] = useState<Tab>('bills');
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
    { key: 'bills', label: t('billing.tabBills') },
    { key: 'charges', label: t('billing.tabCharges') },
    { key: 'expenses', label: t('billing.tabExpenses') },
    { key: 'dashboard', label: t('billing.tabDashboard') },
  ];

  const doWaive = async () => {
    if (!confirmWaive) return;
    setConfirmBusy(true);
    try {
      await maintenanceBilling.waiveBill(confirmWaive.id);
      toast.success(t('billing.waived'));
      setConfirmWaive(null);
      setRefreshSeed((s) => s + 1);
    } catch (err) {
      toast.error(toFormError(err).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const commonDialogs = (
    <>
      <GenerateBillsDialog
        open={generating}
        presetCommunityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        onClose={() => setGenerating(false)}
        onDone={() => {
          setGenerating(false);
          setRefreshSeed((s) => s + 1);
        }}
      />

      <RecordPaymentDialog
        bill={payingBill}
        methodOptions={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] ?? m }))}
        onClose={() => setPayingBill(null)}
        onDone={() => {
          setPayingBill(null);
          setRefreshSeed((s) => s + 1);
        }}
      />

      <SetChargeDialog
        open={charging}
        communityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        onClose={() => setCharging(false)}
        onDone={() => {
          setCharging(false);
          setRefreshSeed((s) => s + 1);
        }}
      />

      <BulkSetChargeDialog
        open={bulkCharging}
        communityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        onClose={() => setBulkCharging(false)}
        onDone={() => {
          setBulkCharging(false);
          setRefreshSeed((s) => s + 1);
        }}
      />

      <ApprovalsDialog
        communityId={approvalsCommunityId}
        organizationId={effectiveOrgId}
        canApprove={canApprovePayment}
        onClose={() => setApprovalsCommunityId(null)}
        onDone={() => {
          setApprovalsCommunityId(null);
          setRefreshSeed((s) => s + 1);
        }}
      />

      <ConfirmDialog
        open={!!confirmWaive}
        tone="danger"
        title={t('billing.waiveConfirmTitle')}
        description={
          confirmWaive
            ? t('billing.waiveConfirmDesc', {
                unit: confirmWaive.unitNumber ?? confirmWaive.unitId,
                amount: formatAmount(confirmWaive.amountDue),
              })
            : ''
        }
        confirmLabel={t('billing.waive')}
        cancelLabel={t('orgs.cancel')}
        busy={confirmBusy}
        onConfirm={doWaive}
        onClose={() => setConfirmWaive(null)}
      />
      <Toaster position="top-center" richColors />
    </>
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
          onPayBill={(b) => setPayingBill(b)}
          onWaiveBill={(b) => setConfirmWaive(b)}
          onReviewApprovals={(commId) => setApprovalsCommunityId(commId)}
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

  // MOBILE APP LAYOUT
  if (isMobile) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
        <HelpDeskHeader
          title={t('billing.title')}
          mode="mobile"
          showBack
          onBack={handleBack}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-2.5">
          {/* Mobile Tabs Switcher */}
          <div className="flex gap-1 rounded-[4px] bg-muted/60 p-0.5 border border-border/70">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  'flex-1 rounded-[3px] py-1 text-xs font-semibold transition-colors',
                  tab === tb.key
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tabContent}
        </div>
        {commonDialogs}
      </div>
    );
  }

  // ADMIN DESKTOP & WEB LAYOUT
  return (
    <div className="space-y-2.5">
      {/* Top Page Header Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-0.5">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-primary" />
            {t('billing.title')}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{t('billing.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          {canApprovePayment ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setApprovalsCommunityId(effectiveCommunityId ?? '')}
              className="h-7 px-2.5 rounded-[4px] text-[11px] font-medium border-border/80"
            >
              <ShieldCheck className="mr-1 h-3 w-3" />
              {t('billing.reviewApproval')}
            </Button>
          ) : null}

          {canAddCharge ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkCharging(true)}
                className="h-7 px-2.5 rounded-[4px] text-[11px] font-medium border-border/80"
              >
                {t('billing.bulkSet')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCharging(true)}
                className="h-7 px-2.5 rounded-[4px] text-[11px] font-medium border-border/80"
              >
                <Plus className="mr-1 h-3 w-3" />
                {t('billing.setCharge')}
              </Button>
            </>
          ) : null}

          {canAddBill ? (
            <Button
              type="button"
              onClick={() => setGenerating(true)}
              className="h-7 px-2.5 rounded-[4px] text-[11px] font-medium"
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('billing.generate')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-1 border-b border-border/70 pb-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={cn(
              'h-7 px-3 text-xs font-semibold rounded-[4px] transition-colors',
              tab === tb.key
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Tab Body */}
      {tabContent}

      {commonDialogs}
    </div>
  );
}

export { MaintenanceBillingView as MaintenanceBillingPage };
export default MaintenanceBillingView;
