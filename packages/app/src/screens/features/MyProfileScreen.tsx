import { useEffect, useState } from 'react';
import { User, Phone, Mail, BadgeCheck, Home as HomeIcon, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents } from '@shared/services';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import { PageLayout } from '@app/components/PageLayout';
import { TextField } from '@shared/components/TextField';
import { PrimaryButton } from '@shared/components/PrimaryButton';

const STATUS_KEY: Record<string, string> = {
  verified: 'myProfile.statusVerified',
  pending: 'myProfile.statusPending',
  draft: 'myProfile.statusDraft',
  rejected: 'myProfile.statusRejected',
};

export function MyProfileScreen() {
  const { t } = useTranslation();
  const perm = usePermission('my-profile');
  const me = useAsync((signal) => residents.me({ signal }), []);
  const resident = me.data?.resident ?? null;
  const unit = me.data?.units?.[0] ?? null;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (resident) {
      setName(resident.name ?? '');
      setEmail(resident.email ?? '');
    }
  }, [resident]);

  const save = useAsyncAction(async () => {
    if (!resident) return;
    await residents.update(resident.id, { name: name.trim(), email: email.trim() || null, updateEmail: true });
    setEditing(false);
    me.reload();
  });

  const residentTypeLabel = resident?.residentType === 'tenant' ? t('myProfile.tenant') : t('myProfile.owner');
  const statusLabel = resident ? t(STATUS_KEY[resident.verificationStatus] ?? 'myProfile.statusPending') : '';

  return (
    <PageLayout
      title={t('myProfile.title')}
      subtitle={t('myProfile.subtitle')}
      right={
        resident && !editing && perm.canEdit ? (
          <button type="button" onClick={() => setEditing(true)} aria-label={t('myProfile.edit')} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15">
            <Pencil className="h-5 w-5" />
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 px-4 py-4">
        {me.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : !resident ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('myProfile.notProvided')}</p>
        ) : editing ? (
          <div className="flex flex-col gap-3">
            <TextField label={t('myProfile.name')} icon={User} value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label={t('myProfile.email')} icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {save.error ? <p className="text-sm text-destructive">{save.error.message}</p> : null}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setEditing(false); setName(resident.name ?? ''); setEmail(resident.email ?? ''); }} className="h-[52px] flex-1 rounded-xl border-2 border-border text-base font-bold">
                {t('common.cancel')}
              </button>
              <PrimaryButton className="flex-1" label={t('myProfile.save')} arrow={false} loading={save.running} onClick={() => void save.run()} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-card p-5 shadow-sm">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-extrabold text-primary">
                {(resident.name ?? 'U').slice(0, 1).toUpperCase()}
              </div>
              <div className="text-lg font-extrabold">{resident.name}</div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
                <BadgeCheck className="h-3.5 w-3.5" /> {statusLabel}
              </span>
            </div>

            <section>
              <h2 className="mb-2 ml-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t('myProfile.personalInfo')}</h2>
              <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
                <InfoRow icon={Phone} tint="#05b872" label={t('myProfile.phone')} value={resident.phone ?? t('myProfile.notProvided')} first />
                <InfoRow icon={Mail} tint="#0ea5e9" label={t('myProfile.email')} value={resident.email ?? t('myProfile.notProvided')} />
                <InfoRow icon={User} tint="#8250df" label={t('myProfile.residentType')} value={residentTypeLabel} />
                <InfoRow icon={HomeIcon} tint="#d97706" label={t('myProfile.unit')} value={unit ? unit.unitNumber : t('myProfile.noUnit')} />
              </div>
            </section>
          </>
        )}
      </div>
    </PageLayout>
  );
}

function InfoRow({ icon: Icon, tint, label, value, first = false }: { icon: typeof User; tint: string; label: string; value: string; first?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-border'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${tint}1f` }}>
        <Icon className="h-5 w-5" style={{ color: tint }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate text-[15px] font-bold">{value}</span>
      </span>
    </div>
  );
}
