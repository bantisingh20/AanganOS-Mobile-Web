import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect, type EntityPage } from '@shared/components/EntitySelect';
import { units, communities } from '@shared/services';
import type { Option } from './UnitFormDialog';

function makeCommunityFetch(organizationId?: string) {
  return (search: string, page: number, pageSize: number, signal: AbortSignal): Promise<EntityPage> =>
    communities.list({ search: search || undefined, page, pageSize }, organizationId ? { organizationId } : {}, { signal })
      .then((d) => ({ items: d.items.map((c) => ({ value: c.id, label: c.name })), total: d.totalCount }));
}

function resolveCommunityLabel(id: string, signal: AbortSignal) {
  return communities.get(id, { signal }).then((c) => c.name).catch(() => null);
}

export function BulkUnitsDialog({
  open,
  presetCommunityId,
  typeOptions,
  statusOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  presetCommunityId?: string;
  typeOptions: Option[];
  statusOptions: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [communityId, setCommunityId] = useState('');
  const [towers, setTowers] = useState('A, B');
  const [floors, setFloors] = useState('5');
  const [rooms, setRooms] = useState('4');
  const [startFloor, setStartFloor] = useState('1');
  const [unitType, setUnitType] = useState('');
  const [unitStatus, setUnitStatus] = useState('vacant');
  const [bedrooms, setBedrooms] = useState('2');
  const [separator, setSeparator] = useState('-');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCommunityId(presetCommunityId ?? '');
    setUnitType(typeOptions[0]?.value ?? '');
  }, [open, presetCommunityId, typeOptions]);

  const generated = useMemo(() => {
    const towerList = towers.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const nFloors = Math.max(1, Number(floors) || 0);
    const nRooms = Math.max(1, Number(rooms) || 0);
    const start = Math.max(0, Number(startFloor) || 0);
    const pad = nRooms >= 100 ? 3 : 2;
    const out: string[] = [];
    for (const tw of towerList) {
      for (let f = start; f < start + nFloors; f++) {
        for (let r = 1; r <= nRooms; r++) {
          out.push(`${tw}${separator}${f}${String(r).padStart(pad, '0')}`);
        }
      }
    }
    return out;
  }, [towers, floors, rooms, startFloor, separator]);

  const run = async () => {
    if (busy || !communityId || !unitType || generated.length === 0) {
      if (!communityId) toast.error(t('units.needCommunity'));
      return;
    }
    setBusy(true);
    let done = 0;
    let failed = 0;
    for (const unitNumber of generated) {
      try {
        await units.create({
          communityId,
          unitNumber,
          unitType,
          unitStatus,
          bedrooms: bedrooms.trim() ? Number(bedrooms) : null,
        });
        done++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    toast.success(t('units.bulkDone', { done, failed }));
    onSaved();
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg p-5 rounded-lg">
      <DialogHeader title={t('units.bulkTitle')} description={t('units.bulkSubtitle')} />
      <div className="flex flex-col gap-3 pt-1">
        {!presetCommunityId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.community')} *</label>
            <EntitySelect
              value={communityId || null}
              onChange={(v) => setCommunityId(v ?? '')}
              fetchPage={makeCommunityFetch()}
              resolveLabel={resolveCommunityLabel}
              placeholder={t('units.selectCommunity')}
              className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('units.towers')} *</label>
          <Input
            value={towers}
            onChange={(e) => setTowers(e.target.value)}
            placeholder="A, B, C"
            className="h-9 text-xs rounded-[4px]"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.floors')}</label>
            <Input
              type="number"
              min={1}
              value={floors}
              onChange={(e) => setFloors(e.target.value)}
              className="h-9 text-xs rounded-[4px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.roomsPerFloor')}</label>
            <Input
              type="number"
              min={1}
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
              className="h-9 text-xs rounded-[4px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.startFloor')}</label>
            <Input
              type="number"
              min={0}
              value={startFloor}
              onChange={(e) => setStartFloor(e.target.value)}
              className="h-9 text-xs rounded-[4px]"
            />
          </div>
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

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('units.separator')}</label>
            <Select value={separator} onValueChange={setSeparator}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-" className="text-xs">A-101</SelectItem>
                <SelectItem value="" className="text-xs">A101</SelectItem>
                <SelectItem value="/" className="text-xs">A/101</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-[4px] border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
          {t('units.bulkPreview', { count: generated.length })}:{' '}
          <span className="font-mono text-foreground font-medium">
            {generated.slice(0, 6).join(', ')}
            {generated.length > 6 ? '…' : ''}
          </span>
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
          {t('orgs.cancel')}
        </Button>
        <Button
          type="button"
          onClick={run}
          disabled={busy || generated.length === 0}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
        >
          {busy ? t('units.creating') : t('units.createN', { count: generated.length })}
        </Button>
      </div>
    </Dialog>
  );
}
