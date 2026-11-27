import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { residents } from '@shared/services';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { InviteVisitorForm, type InviteVisitorUnit } from '@shared/features/visitors/InviteVisitorForm';
import { PageShell } from '@shared/components/layout';

export function InviteVisitorScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const resident = me.data?.resident ?? null;
  const units: InviteVisitorUnit[] = (me.data?.units ?? []).map((u) => ({ unitId: u.unitId, unitNumber: u.unitNumber, communityId: u.communityId ?? undefined, communityCode: u.communityCode ?? null }));

  return (
    <PageShell title={t('myVisitors.inviteTitle')} subtitle={t('myVisitors.inviteSubtitle')}>
      {me.loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : units.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('myProfile.noUnit')}</p>
      ) : (
        <InviteVisitorForm
          units={units}
          residentId={resident?.id ?? null}
          communityId={resident?.communityId ?? null}
          onDone={() => navigate('/my-visitors')}
        />
      )}
    </PageShell>
  );
}
