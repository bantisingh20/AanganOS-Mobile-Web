import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import type { MaintenanceBill } from '@shared/api/maintenanceBilling';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  formatAmount,
} from './billingConstants';
import { GenerateBillsDialog } from './GenerateBillsDialog';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { SetChargeDialog } from './SetChargeDialog';
import { BulkSetChargeDialog } from './BulkSetChargeDialog';
import { ApprovalsDialog } from './ApprovalsDialog';

export interface BillingCommonDialogsProps {
  generating: boolean;
  charging: boolean;
  bulkCharging: boolean;
  approvalsCommunityId: string | null;
  payingBill: MaintenanceBill | null;
  confirmWaive: MaintenanceBill | null;
  confirmBusy: boolean;
  canApprovePayment: boolean;
  effectiveCommunityId?: string;
  effectiveOrgId?: string;
  onCloseGenerating: () => void;
  onCloseCharging: () => void;
  onCloseBulkCharging: () => void;
  onCloseApprovals: () => void;
  onClosePaying: () => void;
  onCloseWaive: () => void;
  onConfirmWaive: () => void;
  onRefresh: () => void;
}

export function BillingCommonDialogs({
  generating,
  charging,
  bulkCharging,
  approvalsCommunityId,
  payingBill,
  confirmWaive,
  confirmBusy,
  canApprovePayment,
  effectiveCommunityId,
  effectiveOrgId,
  onCloseGenerating,
  onCloseCharging,
  onCloseBulkCharging,
  onCloseApprovals,
  onClosePaying,
  onCloseWaive,
  onConfirmWaive,
  onRefresh,
}: BillingCommonDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <GenerateBillsDialog
        open={generating}
        presetCommunityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        onClose={onCloseGenerating}
        onDone={() => {
          onCloseGenerating();
          onRefresh();
        }}
      />

      <RecordPaymentDialog
        bill={payingBill}
        methodOptions={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] ?? m }))}
        onClose={onClosePaying}
        onDone={() => {
          onClosePaying();
          onRefresh();
        }}
      />

      <SetChargeDialog
        open={charging}
        communityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        onClose={onCloseCharging}
        onDone={() => {
          onCloseCharging();
          onRefresh();
        }}
      />

      <BulkSetChargeDialog
        open={bulkCharging}
        communityId={effectiveCommunityId}
        organizationId={effectiveOrgId}
        onClose={onCloseBulkCharging}
        onDone={() => {
          onCloseBulkCharging();
          onRefresh();
        }}
      />

      <ApprovalsDialog
        communityId={approvalsCommunityId}
        organizationId={effectiveOrgId}
        canApprove={canApprovePayment}
        onClose={onCloseApprovals}
        onDone={() => {
          onCloseApprovals();
          onRefresh();
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
        onConfirm={onConfirmWaive}
        onClose={onCloseWaive}
      />
    </>
  );
}
