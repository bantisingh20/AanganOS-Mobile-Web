import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Car, Phone, User } from 'lucide-react';
import { gate } from '@shared/services';
import type { VehicleLookupMatch } from '@shared/api/gate';
import { useAsync } from '@shared/lib/useAsync';
import { cn } from '@shared/lib/utils';
import { PageLayout } from '@app/components/PageLayout';
import { TextField } from '@shared/components/TextField';
import { PrimaryButton } from '@shared/components/PrimaryButton';

function humanize(code: string): string {
  return code
    .split(/[_\s]+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function matchTint(type: string): string {
  return type === 'resident' ? '#05b872' : '#cf5500';
}

export function VehicleLookupScreen() {
  const { t } = useTranslation();
  const [plate, setPlate] = useState('');
  const [query, setQuery] = useState('');

  const result = useAsync(
    (signal) => (query ? gate.lookupVehicle(query, { signal }) : Promise.resolve(null)),
    [query],
  );

  const matches = result.data?.matches ?? [];
  const submit = () => setQuery(plate.trim());

  return (
    <PageLayout title={t('vehicleLookup.title')} subtitle={t('vehicleLookup.subtitle')}>
      <div className="flex flex-col gap-3 px-4 py-4">
        <TextField
          label={t('vehicleLookup.plateLabel')}
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder={t('vehicleLookup.platePlaceholder')}
          icon={Car}
          autoCapitalize="characters"
          onEnter={submit}
        />
        <PrimaryButton label={t('vehicleLookup.lookup')} arrow={false} onClick={submit} disabled={plate.trim().length === 0} />

        {query ? (
          result.loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : matches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('vehicleLookup.empty', { plate: query })}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {matches.map((m, i) => (
                <MatchCard key={`${m.matchType}-${i}`} match={m} />
              ))}
            </div>
          )
        ) : null}
      </div>
    </PageLayout>
  );
}

function MatchCard({ match }: { match: VehicleLookupMatch }) {
  const { t } = useTranslation();
  const tint = matchTint(match.matchType);
  const label =
    match.matchType === 'resident'
      ? t('vehicleLookup.matchResident')
      : match.matchType === 'visit_pass'
        ? t('vehicleLookup.matchVisitPass')
        : t('vehicleLookup.matchWalkIn');

  return (
    <article className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${tint}1f` }}>
          {match.matchType === 'resident' ? <Car className="h-6 w-6" style={{ color: tint }} /> : <User className="h-6 w-6" style={{ color: tint }} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-extrabold">{match.personName}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {label}
            {match.unitNumber ? ` · ${t('vehicleLookup.unit', { unit: match.unitNumber })}` : ''}
            {match.vehicleType ? ` · ${humanize(match.vehicleType)}` : ''}
          </p>
          {match.personPhone ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              {match.personPhone}
            </p>
          ) : null}
        </div>
        {match.status ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{humanize(match.status)}</span>
        ) : null}
      </div>

      {match.matchType !== 'resident' && match.hostResidents.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <p className="text-xs font-bold">{match.hostResidents.length > 1 ? t('vehicleLookup.unitContacts') : t('vehicleLookup.unitContact')}</p>
          {match.hostResidents.map((h, hi) => (
            <p key={hi} className={cn('truncate text-xs text-muted-foreground')}>
              {h.name}
              {h.phone ? ` · ${h.phone}` : ''}
              {h.residentType ? ` · ${humanize(h.residentType)}` : ''}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
