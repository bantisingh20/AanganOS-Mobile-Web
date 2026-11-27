import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { EntitySelect } from '@shared/components/form/EntitySelect';
import { communities as communitiesApi, units } from '@shared/services';
import type { Community } from '@shared/api/communities';
import { useScope } from '@shared/lib/hooks/useScope';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { fetchOrgPage, resolveOrgLabel } from '@shared/lib/entityFetchers';
import type { Option } from './UnitFormDialog';

/**
 * Bulk-create units in one or more communities (wings / towers): Organization (society), then a
 * multi-select of its communities, then floors × rooms per floor. Unit numbers are saved as
 * {community code}{separator}{floor+room}, the same as the old tower flow: A-101, B-101 …
 */
export function BulkUnitsDialog({
  open,
  presetCommunityId,
  presetOrgId,
  typeOptions,
  statusOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  presetCommunityId?: string;
  presetOrgId?: string;
  typeOptions: Option[];
  statusOptions: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const scope = useScope();
  const [orgId, setOrgId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [floors, setFloors] = useState('5');
  const [rooms, setRooms] = useState('4');
  const [startFloor, setStartFloor] = useState('1');
  const [unitType, setUnitType] = useState('');
  const [unitStatus, setUnitStatus] = useState('vacant');
  const [bedrooms, setBedrooms] = useState('2');
  const [separator, setSeparator] = useState('-');
  const [busy, setBusy] = useState(false);

  // Only platform users pick the organization; org admins are fixed to their own, and community
  // admins (or a page already scoped to one community) get the community preset.
  const showOrgSelect = scope.showOrgFilter;
  const effectiveOrgId = showOrgSelect ? orgId : scope.organizationId ?? '';

  useEffect(() => {
    if (!open) return;
    setOrgId(presetOrgId ?? '');
    setSelectedIds(presetCommunityId ? [presetCommunityId] : []);
    setProgress(null);
    setUnitType(typeOptions[0]?.value ?? '');
  }, [open, presetCommunityId, presetOrgId, typeOptions]);

  // The organization's communities (a society has a handful of wings, so one page is enough).
  // With a preset community we still load it, for its code in the preview.
  const needOrg = showOrgSelect && !presetCommunityId;
  const communitiesQuery = useAsync(
    (signal) => {
      if (!open) return Promise.resolve(null);
      if (presetCommunityId) {
        return communitiesApi.get(presetCommunityId, { signal }).then((c) => ({ items: [c] })).catch(() => null);
      }
      if (needOrg && !orgId) return Promise.resolve(null);
      return communitiesApi
        .list({ pageSize: 200, sort: 'name' }, effectiveOrgId ? { organizationId: effectiveOrgId } : {}, { signal })
        .catch(() => null);
    },
    [open, presetCommunityId, needOrg, orgId, effectiveOrgId],
  );
  const communityList: Community[] = useMemo(() => communitiesQuery.data?.items ?? [], [communitiesQuery.data]);
  const selectedCommunities = useMemo(
    () => communityList.filter((c) => selectedIds.includes(c.id)),
    [communityList, selectedIds],
  );
  const allSelected = communityList.length > 0 && selectedCommunities.length === communityList.length;
  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () => setSelectedIds(allSelected ? [] : communityList.map((c) => c.id));

  const generated = useMemo(() => {
    const nFloors = Math.max(1, Number(floors) || 0);
    const nRooms = Math.max(1, Number(rooms) || 0);
    const start = Math.max(0, Number(startFloor) || 0);
    const pad = nRooms >= 100 ? 3 : 2;
    const out: string[] = [];
    for (let f = start; f < start + nFloors; f++) {
      for (let r = 1; r <= nRooms; r++) {
        out.push(`${f}${String(r).padStart(pad, '0')}`);
      }
    }
    return out;
  }, [floors, rooms, startFloor]);

  // Saved unit number, same as the old flow: {code}{separator}{floor+room}, e.g. A-101.
  // A community without a code gets the plain number (101).
  const storedNumber = (c: Community, n: string) => (c.code?.trim() ? `${c.code.trim()}${separator}${n}` : n);
  const missingCode = selectedCommunities.filter((c) => !c.code?.trim());

  const totalCount = generated.length * selectedCommunities.length;
  const preview = useMemo(() => {
    const out: string[] = [];
    for (const c of selectedCommunities) {
      for (const n of generated.slice(0, 3)) out.push(storedNumber(c, n));
      if (out.length >= 6) break;
    }
    return out.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommunities, generated, separator]);

  const run = async () => {
    if (busy || !unitType || generated.length === 0) return;
    if (selectedCommunities.length === 0) {
      toast.error(t('units.needCommunity'));
      return;
    }
    setBusy(true);
    let done = 0;
    let failed = 0;
    setProgress({ done: 0, total: totalCount });
    for (const community of selectedCommunities) {
      for (const n of generated) {
        try {
          await units.create({
            communityId: community.id,
            unitNumber: storedNumber(community, n),
            unitType,
            unitStatus,
            bedrooms: bedrooms.trim() ? Number(bedrooms) : null,
          });
          done++;
        } catch {
          // Most often the unit already exists in that community (unique number per community).
          failed++;
        }
        setProgress({ done: done + failed, total: totalCount });
      }
    }
    setBusy(false);
    setProgress(null);
    toast.success(t('units.bulkDone', { done, failed }));
    onSaved();
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg p-5 rounded-lg">
      <DialogHeader title={t('units.bulkTitle')} description={t('units.bulkSubtitle')} />
      <div className="flex flex-col gap-3 pt-1">
        {!presetCommunityId && (
          <>
            {showOrgSelect && (
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('units.organization')} *</label>
                <EntitySelect
                  value={orgId || null}
                  onChange={(v) => { setOrgId(v ?? ''); setSelectedIds([]); }}
                  fetchPage={fetchOrgPage}
                  resolveLabel={resolveOrgLabel}
                  placeholder={t('units.selectOrganization')}
                  className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:text-xs [&>button]:px-3"
                />
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-foreground">{t('units.communities')} *</label>
                {communityList.length > 1 && (
                  <button type="button" onClick={toggleAll} className="text-[11px] font-medium text-primary hover:underline">
                    {allSelected ? t('common.clearAll', 'Clear all') : t('common.selectAll', 'Select all')}
                  </button>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto rounded-[4px] border border-border bg-background">
                {needOrg && !orgId ? (
                  <p className="px-3 py-2.5 text-xs text-muted-foreground">{t('units.selectOrganizationFirst')}</p>
                ) : communitiesQuery.loading && communityList.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-muted-foreground">{t('common.loading')}</p>
                ) : communityList.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-muted-foreground">{t('units.selectCommunities')}</p>
                ) : (
                  communityList.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggle(c.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span className="flex-1 truncate text-foreground">{c.name}</span>
                      {c.code ? (
                        <span className="rounded-[3px] bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{c.code}</span>
                      ) : null}
                    </label>
                  ))
                )}
              </div>
            </div>
          </>
        )}

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
            <Select value={separator === '' ? 'none' : separator} onValueChange={(v) => setSeparator(v === 'none' ? '' : v)}>
              <SelectTrigger className="h-9 w-full rounded-[4px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-" className="text-xs">A-101</SelectItem>
                <SelectItem value="none" className="text-xs">A101</SelectItem>
                <SelectItem value="/" className="text-xs">A/101</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {missingCode.length > 0 ? (
          <p className="rounded-[4px] border border-amber-300/60 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            {t('units.noCodeWarning', {
              names: missingCode.map((c) => c.name).join(', '),
              defaultValue: 'No code set for {{names}}: units there are saved as plain numbers (101). Add a code in Communities to get A-101.',
            })}
          </p>
        ) : null}

        <div className="rounded-[4px] border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
          {t('units.bulkPreview', { count: totalCount })}
          {selectedCommunities.length > 1 ? (
            <> ({t('units.bulkPerCommunity', { count: generated.length, communities: selectedCommunities.length })})</>
          ) : null}
          {preview.length > 0 ? (
            <>
              :{' '}
              <span className="font-mono text-foreground font-medium">
                {preview.join(', ')}
                {totalCount > preview.length ? '…' : ''}
              </span>
            </>
          ) : null}
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
          onClick={run}
          disabled={busy || totalCount === 0}
          className="h-8.5 px-4 rounded-[4px] text-xs font-medium"
        >
          {busy
            ? `${t('units.creating')}${progress ? ` ${progress.done}/${progress.total}` : ''}`
            : t('units.createN', { count: totalCount })}
        </Button>
      </div>
    </Dialog>
  );
}
