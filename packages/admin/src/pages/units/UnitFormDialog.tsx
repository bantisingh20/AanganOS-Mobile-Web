import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { units } from '@shared/services';
import { fetchCommunityPage, resolveCommunityLabel } from '@shared/lib/entityFetchers';
import type { Unit } from '@shared/api/units';
import { tryToast } from '@shared/lib/withToast';

export type Option = { value: string; label: string };

export function UnitFormDialog({
  open,
  unit,
  presetCommunityId,
  typeOptions,
  statusOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  unit?: Unit | null;
  presetCommunityId?: string;
  typeOptions: Option[];
  statusOptions: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!unit;
  const [communityId, setCommunityId] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [unitType, setUnitType] = useState('');
  const [unitStatus, setUnitStatus] = useState('vacant');
  const [floor, setFloor] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCommunityId(presetCommunityId ?? '');
    setUnitNumber(unit?.unitNumber ?? '');
    setUnitType(unit?.unitType ?? typeOptions[0]?.value ?? '');
    setUnitStatus(unit?.unitStatus ?? 'vacant');
    setFloor(unit?.floor ?? '');
    setBedrooms(unit?.bedrooms != null ? String(unit.bedrooms) : '');
  }, [open, unit, presetCommunityId, typeOptions]);

  const submit = async () => {
    if (busy || !unitNumber.trim() || !unitType) return;
    if (!isEdit && !communityId) {
      toast.error(t('units.needCommunity'));
      return;
    }
    setBusy(true);
    try {
      const ok = await tryToast(() => (isEdit
        ? units.update(unit!.id, {
          unitNumber: unitNumber.trim(),
          unitType,
          unitStatus,
          floor: floor.trim() ? floor.trim() : null,
          updateFloor: true,
          bedrooms: bedrooms.trim() ? Number(bedrooms) : null,
          updateBedrooms: true,
        })
        : units.create({
          communityId,
          unitNumber: unitNumber.trim(),
          unitType,
          unitStatus,
          floor: floor.trim() ? floor.trim() : null,
          bedrooms: bedrooms.trim() ? Number(bedrooms) : null,
        })), isEdit ? t('units.updated') : t('units.created'));
      if (ok) onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md p-5 rounded-lg">
      <DialogHeader title={isEdit ? t('units.editTitle') : t('units.addTitle')} />
      <div className="flex flex-col gap-3 pt-1">
        {!isEdit && !presetCommunityId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.community')} *</label>
            <EntitySelect
              value={communityId || null}
              onChange={(v) => setCommunityId(v ?? '')}
              fetchPage={fetchCommunityPage}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('units.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('units.unitNumber')} *</label>
          <Input
            autoFocus
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            placeholder={t('units.unitNumberPlaceholder')}
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="h-9 text-xs rounded-[4px]"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.type')} *</label>
            <Select value={unitType} onValueChange={setUnitType}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue placeholder={t('units.type')} />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.status')} *</label>
            <Select value={unitStatus} onValueChange={setUnitStatus}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.floorLabel')}</label>
            <Input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="e.g. 4"
              className="h-9 text-xs rounded-[4px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.bedrooms')}</label>
            <Input
              type="number"
              min={0}
              max={20}
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              placeholder="e.g. 2"
              className="h-9 text-xs rounded-[4px]"
            />
          </div>
        </div>
      </div>

      {/* Footer with clean breathing room, rectangular buttons with subtle curve */}
      <div className="mt-5 pt-3.5 border-t border-border/70 flex items-center justify-end gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium border-border/80"
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={busy || !unitNumber.trim()}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
        >
          {isEdit ? t('units.saveChanges') : t('units.createUnit')}
        </Button>
      </div>
    </Dialog>
  );
}
