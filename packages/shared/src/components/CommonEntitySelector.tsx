import { useEffect, useMemo, useState } from 'react';
import { Building2, Layers, Home } from 'lucide-react';
import { useScope } from '@shared/lib/useScope';
import { useAuth } from '@shared/store/AuthContext';
import { organizations, communities, units as unitsApi } from '@shared/services';
import { useAsync } from '@shared/lib/useAsync';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';

export interface EntitySelection {
  orgId: string | null;
  communityId: string | null;
  unitId: string | null;
}

export interface CommonEntitySelectorProps {
  /**
   * 1 = Society (Organization) only
   * 2 = Society + Wing (Community)
   * 3 = Society + Wing + Flat (Unit)
   */
  level?: 1 | 2 | 3;
  selectedOrgId?: string | null;
  selectedCommunityId?: string | null;
  selectedUnitId?: string | null;
  onOrgChange?: (orgId: string | null) => void;
  onCommunityChange?: (communityId: string | null) => void;
  onUnitChange?: (unitId: string | null) => void;
  onChange?: (selection: EntitySelection) => void;
  className?: string;
  size?: 'sm' | 'default';
  showLabels?: boolean;
}

const CACHE_KEYS = {
  org: 'aanganos_selected_org',
  community: 'aanganos_selected_community',
  unit: 'aanganos_selected_unit',
};

export function CommonEntitySelector({
  level = 2,
  selectedOrgId,
  selectedCommunityId,
  selectedUnitId,
  onOrgChange,
  onCommunityChange,
  onUnitChange,
  onChange,
  className = '',
  size = 'sm',
  showLabels = true,
}: CommonEntitySelectorProps) {
  const scope = useScope();
  const { user } = useAuth();

  // Internal state initialized from props or cached localStorage
  const [internalOrgId, setInternalOrgId] = useState<string | null>(() => {
    return selectedOrgId ?? scope.organizationId ?? localStorage.getItem(CACHE_KEYS.org) ?? null;
  });

  const [internalCommunityId, setInternalCommunityId] = useState<string | null>(() => {
    return selectedCommunityId ?? scope.scopedCommunityId ?? localStorage.getItem(CACHE_KEYS.community) ?? null;
  });

  const [internalUnitId, setInternalUnitId] = useState<string | null>(() => {
    return selectedUnitId ?? localStorage.getItem(CACHE_KEYS.unit) ?? null;
  });

  // Sync external controlled props
  useEffect(() => {
    if (selectedOrgId !== undefined) setInternalOrgId(selectedOrgId);
  }, [selectedOrgId]);

  useEffect(() => {
    if (selectedCommunityId !== undefined) setInternalCommunityId(selectedCommunityId);
  }, [selectedCommunityId]);

  useEffect(() => {
    if (selectedUnitId !== undefined) setInternalUnitId(selectedUnitId);
  }, [selectedUnitId]);

  // If user is locked to an org, enforce it
  const effectiveOrgId = scope.organizationId ?? internalOrgId;
  // If user is locked to a community (e.g. community admin), enforce it
  const effectiveCommunityId = scope.scopedCommunityId ?? internalCommunityId;

  // 1. Fetch Organizations (Societies) for Superadmin
  const orgsQuery = useAsync(
    (signal) => (scope.isPowerUser ? organizations.list({ pageSize: 100 }, { signal }).catch(() => null) : Promise.resolve(null)),
    [scope.isPowerUser]
  );

  const orgOptions = useMemo(() => {
    if (!scope.isPowerUser && scope.organizationId) {
      return [{ value: scope.organizationId, label: user?.organizationName || 'My Society' }];
    }
    return (orgsQuery.data?.items ?? []).map((o) => ({ value: o.id, label: o.name }));
  }, [scope.isPowerUser, scope.organizationId, user?.organizationName, orgsQuery.data]);

  // 2. Fetch Communities (Wings) for selected Organization
  const commsQuery = useAsync(
    (signal) => {
      if (level < 2) return Promise.resolve(null);
      const params = effectiveOrgId ? { organizationId: effectiveOrgId } : {};
      return communities.list({ pageSize: 150 }, params, { signal }).catch(() => null);
    },
    [level, effectiveOrgId]
  );

  const commOptions = useMemo(() => {
    if (scope.scopedCommunityId) {
      return [{ value: scope.scopedCommunityId, label: user?.communityName || 'My Wing' }];
    }
    return (commsQuery.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));
  }, [scope.scopedCommunityId, user?.communityName, commsQuery.data]);

  // 3. Fetch Units (Flats/Rooms) for selected Community
  const unitsQuery = useAsync(
    (signal) => {
      if (level < 3 || !effectiveCommunityId) return Promise.resolve(null);
      return unitsApi.list({ pageSize: 250 }, { communityId: effectiveCommunityId }, { signal }).catch(() => null);
    },
    [level, effectiveCommunityId]
  );

  const unitOptions = useMemo(() => {
    const raw = unitsQuery.data?.items ?? [];
    return [...raw]
      .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true, sensitivity: 'base' }))
      .map((u) => ({
        value: u.id,
        label: u.floor ? `Flat ${u.unitNumber} (${u.floor}F)` : `Flat ${u.unitNumber}`,
      }));
  }, [unitsQuery.data]);

  // Change handlers with cache persistence
  const handleOrg = (val: string) => {
    const next = val === '__all__' ? null : val;
    setInternalOrgId(next);
    setInternalCommunityId(null);
    setInternalUnitId(null);
    if (next) localStorage.setItem(CACHE_KEYS.org, next);
    else localStorage.removeItem(CACHE_KEYS.org);
    localStorage.removeItem(CACHE_KEYS.community);
    localStorage.removeItem(CACHE_KEYS.unit);
    onOrgChange?.(next);
    onCommunityChange?.(null);
    onUnitChange?.(null);
    onChange?.({ orgId: next, communityId: null, unitId: null });
  };

  const handleCommunity = (val: string) => {
    const next = val === '__all__' ? null : val;
    setInternalCommunityId(next);
    setInternalUnitId(null);
    if (next) localStorage.setItem(CACHE_KEYS.community, next);
    else localStorage.removeItem(CACHE_KEYS.community);
    localStorage.removeItem(CACHE_KEYS.unit);
    onCommunityChange?.(next);
    onUnitChange?.(null);
    onChange?.({ orgId: effectiveOrgId ?? null, communityId: next, unitId: null });
  };

  const handleUnit = (val: string) => {
    const next = val === '__all__' ? null : val;
    setInternalUnitId(next);
    if (next) localStorage.setItem(CACHE_KEYS.unit, next);
    else localStorage.removeItem(CACHE_KEYS.unit);
    onUnitChange?.(next);
    onChange?.({ orgId: effectiveOrgId ?? null, communityId: effectiveCommunityId ?? null, unitId: next });
  };

  const hClass = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Level 1: Society (Organization) */}
      {scope.isPowerUser ? (
        <div className="flex flex-col gap-0.5 min-w-[150px]">
          {showLabels ? <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><Building2 className="h-3 w-3" /> Society</span> : null}
          <Select value={effectiveOrgId ?? '__all__'} onValueChange={handleOrg}>
            <SelectTrigger className={`${hClass} rounded-[4px] border-border/80 bg-background`}>
              <SelectValue placeholder="All Societies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Societies</SelectItem>
              {orgOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : scope.organizationId && showLabels ? (
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-muted/60 border border-border/50 text-xs font-semibold text-foreground">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span>{user?.organizationName || 'Society'}</span>
        </div>
      ) : null}

      {/* Level 2: Wing (Community) */}
      {level >= 2 ? (
        <div className="flex flex-col gap-0.5 min-w-[140px]">
          {showLabels ? <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><Layers className="h-3 w-3" /> Wing / Tower</span> : null}
          {scope.scopedCommunityId ? (
            <div className={`flex items-center gap-1.5 px-2.5 ${hClass} rounded-[4px] bg-muted/60 border border-border/50 font-semibold text-foreground`}>
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              <span>{user?.communityName || 'Assigned Wing'}</span>
            </div>
          ) : (
            <Select value={effectiveCommunityId ?? '__all__'} onValueChange={handleCommunity}>
              <SelectTrigger className={`${hClass} rounded-[4px] border-border/80 bg-background`}>
                <SelectValue placeholder="All Wings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Wings</SelectItem>
                {commOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : null}

      {/* Level 3: Flat / Room (Unit) */}
      {level >= 3 && effectiveCommunityId ? (
        <div className="flex flex-col gap-0.5 min-w-[130px]">
          {showLabels ? <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1"><Home className="h-3 w-3" /> Flat / Room</span> : null}
          <Select value={internalUnitId ?? '__all__'} onValueChange={handleUnit}>
            <SelectTrigger className={`${hClass} rounded-[4px] border-border/80 bg-background`}>
              <SelectValue placeholder="All Flats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Flats</SelectItem>
              {unitOptions.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
