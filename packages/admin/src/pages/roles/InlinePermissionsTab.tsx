import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Shield, Check, Search, X, RotateCcw, KeyRound } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { menuItems, roles } from '@shared/services';
import type { Role, PermissionGrant } from '@shared/api/roles';
import type { MenuItem } from '@shared/api/menuItems';
import { useAsync } from '@shared/lib/useAsync';
import { toFormError } from '@shared/api/errors';
import {
  ACTION_VIEW, ACTION_DELETE, ACTION_EDIT,
  SCOPE_PLATFORM, SURFACE_ADMIN, SURFACE_APP,
  DEFAULT_ADMIN_ACTIONS, DEFAULT_APP_ACTIONS,
  CORE_ACTION_META, EXTRA_ACTION_LABELS,
  permKey, getCategoryForModule, type CoreActionMeta,
} from './roleConstants';

export interface MenuPermRow {
  id: string;
  label: string;
  resource: string;
  actions: number[];
  category: string;
  surface: number;
}

export function InlinePermissionsTab({
  allRolesList,
  selectedRoleId,
  onSelectRole,
  onRoleUpdated,
}: {
  allRolesList: Role[];
  selectedRoleId: string | null;
  onSelectRole: (id: string) => void;
  onRoleUpdated: () => void;
  isSmall?: boolean;
}) {
  const { t } = useTranslation();
  const currentRole = useMemo(
    () => allRolesList.find((r) => r.id === selectedRoleId) ?? allRolesList[0] ?? null,
    [allRolesList, selectedRoleId],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [currentGrants, setCurrentGrants] = useState<PermissionGrant[]>([]);
  const [filter, setFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [permSurface, setPermSurface] = useState<number>(SURFACE_ADMIN);
  const [savingBusy, setSavingBusy] = useState(false);

  const catalog = useAsync((signal) => menuItems.list(undefined, { signal }).catch(() => [] as MenuItem[]), []);

  const canonicalMap = useMemo(() => {
    const map = new Map<string, string>();
    (catalog.data ?? []).forEach((m) => {
      const res = m.requiredPermissionResource?.trim() || m.key?.trim();
      if (res) map.set(res.toLowerCase(), res);
    });
    return map;
  }, [catalog.data]);

  useEffect(() => {
    if (!currentRole) return;
    let active = true;
    const initial = currentRole.permissions ?? [];
    setCurrentGrants(initial);
    initial.forEach((p) => canonicalMap.set(p.resourceType.trim().toLowerCase(), p.resourceType.trim()));
    const initialKeys = new Set(initial.map((p) => permKey(p.resourceType, p.action)));
    setSelected(initialKeys);
    setSavedKeys(initialKeys);

    roles.get(currentRole.id).then((fresh) => {
      if (!active || !fresh) return;
      const fg = fresh.permissions ?? [];
      setCurrentGrants(fg);
      fg.forEach((p) => canonicalMap.set(p.resourceType.trim().toLowerCase(), p.resourceType.trim()));
      const fk = new Set(fg.map((p) => permKey(p.resourceType, p.action)));
      setSelected(fk);
      setSavedKeys(fk);
    }).catch(() => {});
    return () => { active = false; };
  }, [currentRole?.id, canonicalMap]);

  const allSurfaceRows = useMemo<MenuPermRow[]>(() => {
    const items = (catalog.data ?? []).filter((m) => m.surface === permSurface);
    const byParent = new Map<string | null, MenuItem[]>();
    for (const m of items) {
      const list = byParent.get(m.parentId ?? null) ?? [];
      list.push(m);
      byParent.set(m.parentId ?? null, list);
    }
    const rows: MenuPermRow[] = [];
    const seenResources = new Set<string>();

    const walk = (parentId: string | null) => {
      for (const m of (byParent.get(parentId) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
        const resource = m.requiredPermissionResource?.trim() || m.key?.trim();
        if (resource) {
          const lowerRes = resource.toLowerCase();
          canonicalMap.set(lowerRes, resource);
          const defaultActions = m.surface === SURFACE_ADMIN ? DEFAULT_ADMIN_ACTIONS : DEFAULT_APP_ACTIONS;
          const mergedActions = Array.from(new Set([...defaultActions, ...(m.requiredPermissionActions ?? [])])).sort((a, b) => a - b);
          rows.push({
            id: m.id, label: m.label, resource,
            actions: mergedActions, category: getCategoryForModule(m.label, resource), surface: m.surface,
          });
          seenResources.add(lowerRes);
        }
        walk(m.id);
      }
    };
    walk(null);

    if (currentGrants.length > 0) {
      const extraResources = new Map<string, number[]>();
      for (const p of currentGrants) {
        const lowerRes = p.resourceType.trim().toLowerCase();
        if (!seenResources.has(lowerRes)) {
          const acts = extraResources.get(lowerRes) ?? [...DEFAULT_ADMIN_ACTIONS];
          if (!acts.includes(p.action)) acts.push(p.action);
          extraResources.set(lowerRes, acts);
          canonicalMap.set(lowerRes, p.resourceType.trim());
        }
      }
      extraResources.forEach((acts, lowerRes) => {
        const canonical = canonicalMap.get(lowerRes) ?? lowerRes;
        rows.push({
          id: `extra-${lowerRes}`, label: canonical, resource: canonical,
          actions: acts.sort((a, b) => a - b), category: getCategoryForModule(canonical, canonical), surface: permSurface,
        });
      });
    }
    return rows;
  }, [catalog.data, permSurface, canonicalMap, currentGrants]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    allSurfaceRows.forEach((r) => s.add(r.category));
    return ['All', ...Array.from(s).sort()];
  }, [allSurfaceRows]);

  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return allSurfaceRows.filter((r) => {
      if (activeCategory !== 'All' && r.category !== activeCategory) return false;
      return !q || r.label.toLowerCase().includes(q) || r.resource.toLowerCase().includes(q);
    });
  }, [allSurfaceRows, activeCategory, filter]);

  const hasUnsavedChanges = useMemo(() => {
    if (selected.size !== savedKeys.size) return true;
    for (const k of selected) { if (!savedKeys.has(k)) return true; }
    return false;
  }, [selected, savedKeys]);

  const togglePerm = (k: string) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const toggleRow = (row: MenuPermRow) => {
    const keys = row.actions.map((a) => permKey(row.resource, a));
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const n = new Set(prev);
      keys.forEach((k) => (allOn ? n.delete(k) : n.add(k)));
      return n;
    });
  };

  const toggleColumnAction = (act: number) => {
    const keys = visibleRows.filter((r) => r.actions.includes(act)).map((r) => permKey(r.resource, act));
    if (keys.length === 0) return;
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const n = new Set(prev);
      keys.forEach((k) => (allOn ? n.delete(k) : n.add(k)));
      return n;
    });
  };

  const applyPreset = (mode: 'full' | 'operator' | 'view' | 'clear') => {
    if (mode === 'clear') {
      const keys = new Set(allSurfaceRows.flatMap((r) => r.actions.map((a) => permKey(r.resource, a))));
      setSelected((prev) => { const n = new Set(prev); keys.forEach((k) => n.delete(k)); return n; });
      return;
    }
    const target = allSurfaceRows.flatMap((r) =>
      r.actions.filter((a) => mode === 'full' || (mode === 'view' ? a === ACTION_VIEW : a <= ACTION_EDIT)).map((a) => permKey(r.resource, a)),
    );
    setSelected((prev) => { const n = new Set(prev); target.forEach((k) => n.add(k)); return n; });
  };

  const saveRolePermissions = async () => {
    if (!currentRole || savingBusy) return;
    setSavingBusy(true);
    try {
      const perms = Array.from(selected).map((k) => {
        const idx = k.lastIndexOf(':');
        const lowerRes = k.slice(0, idx);
        return { resourceType: canonicalMap.get(lowerRes) ?? lowerRes, action: Number(k.slice(idx + 1)) };
      });
      await roles.update(currentRole.id, {
        name: currentRole.name, scope: currentRole.scope,
        communityId: currentRole.communityId, permissions: perms,
      });
      setSavedKeys(new Set(selected));
      toast.success(t('roles.permissionsSaved'));
      onRoleUpdated();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setSavingBusy(false); }
  };

  if (!currentRole) return <div className="p-8 text-center text-xs text-muted-foreground">{t('roles.noRoles')}</div>;

  return (
    <div className="space-y-2">
      {/* 1. Role Selection Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar rounded-md border border-border/80 bg-card p-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground shrink-0 px-1">{t('roles.roleLabel')}:</span>
        {allRolesList.map((r) => {
          const isSel = r.id === currentRole.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectRole(r.id)}
              className={`flex items-center gap-1 h-6.5 px-2.5 rounded-[4px] text-[11px] font-medium border transition-colors shrink-0 ${
                isSel ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border/80 text-foreground hover:bg-muted/50'
              }`}
            >
              <span>{r.name}</span>
              <span className="font-mono text-[9px] opacity-70">({r.scope === SCOPE_PLATFORM ? 'P' : 'C'})</span>
              {isSel && <Check className="h-3 w-3 stroke-[2.5]" />}
            </button>
          );
        })}
      </div>

      {/* 2. Active Role Summary Bar with Save Action */}
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/80 bg-card p-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <KeyRound className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-xs text-foreground truncate">{currentRole.name}</span>
          <Badge tone={currentRole.scope === SCOPE_PLATFORM ? 'info' : 'default'} className="text-[10px] px-1.5 py-0 rounded">
            {currentRole.scope === SCOPE_PLATFORM ? t('roles.platformScope') : t('roles.communityScope')}
          </Badge>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">({selected.size} {t('roles.permsSelected')})</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasUnsavedChanges && (
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set(savedKeys))} className="h-7 px-2 rounded-[4px] text-[11px]">
              <RotateCcw className="h-3 w-3 mr-1" />{t('orgs.reset')}
            </Button>
          )}
          <Button size="sm" onClick={saveRolePermissions} disabled={savingBusy} className="h-7 px-3 rounded-[4px] text-[11px] font-medium">
            <Check className="h-3 w-3 stroke-[2.5] mr-1" />{savingBusy ? t('common.saving') : hasUnsavedChanges ? t('units.saveChanges') : t('common.saved')}
          </Button>
        </div>
      </div>

      {/* 3. Surface & Preset Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card p-1.5 text-xs">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPermSurface(SURFACE_ADMIN)} className={`h-6.5 px-2.5 rounded-[4px] text-[11px] font-medium transition-colors ${permSurface === SURFACE_ADMIN ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('roles.surfaceAdmin')}</button>
          <button type="button" onClick={() => setPermSurface(SURFACE_APP)} className={`h-6.5 px-2.5 rounded-[4px] text-[11px] font-medium transition-colors ${permSurface === SURFACE_APP ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('roles.surfaceApp')}</button>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-muted-foreground font-semibold mr-0.5">{t('roles.presets')}:</span>
          <button type="button" onClick={() => applyPreset('full')} className="h-6 px-2 rounded-[4px] text-[10px] font-medium border border-border/80 hover:bg-muted/50">{t('roles.presetFull')}</button>
          <button type="button" onClick={() => applyPreset('operator')} className="h-6 px-2 rounded-[4px] text-[10px] font-medium border border-border/80 hover:bg-muted/50">{t('roles.presetOperator')}</button>
          <button type="button" onClick={() => applyPreset('view')} className="h-6 px-2 rounded-[4px] text-[10px] font-medium border border-border/80 hover:bg-muted/50">{t('roles.presetView')}</button>
          <button type="button" onClick={() => applyPreset('clear')} className="h-6 px-2 rounded-[4px] text-[10px] font-medium border border-border/80 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">{t('roles.presetClear')}</button>
        </div>
      </div>

      {/* 4. Filter & Search */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button key={cat} type="button" onClick={() => setActiveCategory(cat)} className={`h-6 px-2 rounded-[4px] text-[10px] font-medium border transition-colors shrink-0 ${activeCategory === cat ? 'bg-primary text-primary-foreground border-primary' : 'border-border/80 text-muted-foreground hover:text-foreground'}`}>{cat}</button>
          ))}
        </div>
        <div className="relative w-44">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('roles.searchModules')} className="h-7 w-full pl-7 pr-6 text-[11px] rounded-[4px]" />
          {filter && <button type="button" onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}
        </div>
      </div>

      {/* 5. Matrix Table */}
      <div className="rounded-md border border-border/80 bg-card overflow-hidden">
        {catalog.loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">{t('common.loading')}</div>
        ) : visibleRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">{t('roles.noMatchingModules')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="py-1.5 px-3 text-[10.5px] font-semibold">{t('roles.moduleFeature')}</th>
                  {CORE_ACTION_META.map((meta: CoreActionMeta) => (
                    <th key={meta.action} className="py-1.5 px-2 text-center text-[10.5px] font-semibold w-16">
                      <button type="button" onClick={() => toggleColumnAction(meta.action)} className="hover:text-primary transition-colors">{meta.label}</button>
                    </th>
                  ))}
                  <th className="py-1.5 px-3 text-[10.5px] font-semibold">{t('roles.extraPermissions')}</th>
                  <th className="py-1.5 px-3 text-right text-[10.5px] font-semibold w-20">{t('roles.rowAll')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visibleRows.map((row) => {
                  const rowKeys = row.actions.map((a) => permKey(row.resource, a));
                  const isAllRow = rowKeys.length > 0 && rowKeys.every((k) => selected.has(k));
                  return (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <span className="font-semibold text-xs text-foreground leading-none">{row.label}</span>
                            <span className="block font-mono text-[9px] text-muted-foreground leading-none mt-0.5">{row.resource} • {row.category}</span>
                          </div>
                        </div>
                      </td>
                      {CORE_ACTION_META.map((meta: CoreActionMeta) => {
                        const hasAct = row.actions.includes(meta.action);
                        if (!hasAct) return <td key={meta.action} className="py-1.5 px-2 text-center text-muted-foreground/30 text-xs">—</td>;
                        const k = permKey(row.resource, meta.action);
                        const isChk = selected.has(k);
                        return (
                          <td key={meta.action} className="py-1.5 px-2 text-center">
                            <button type="button" onClick={() => togglePerm(k)} className={`h-5 w-5 inline-flex items-center justify-center rounded-[3px] border transition-colors ${isChk ? 'bg-primary text-primary-foreground border-primary' : 'border-border/80 hover:border-primary/50'}`}>
                              {isChk && <Check className="h-3 w-3 stroke-[2.5]" />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="py-1.5 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {row.actions.filter((a) => a > ACTION_DELETE).map((a) => {
                            const k = permKey(row.resource, a);
                            const isChk = selected.has(k);
                            return (
                              <button key={k} type="button" onClick={() => togglePerm(k)} className={`h-5 px-1.5 rounded-[3px] text-[10px] font-medium border transition-colors ${isChk ? 'bg-primary/10 text-primary border-primary/50' : 'border-border/80 text-muted-foreground hover:text-foreground'}`}>
                                {EXTRA_ACTION_LABELS[a] ?? `#${a}`}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <button type="button" onClick={() => toggleRow(row)} className={`h-5 px-2 rounded-[3px] text-[10px] font-medium border transition-colors ${isAllRow ? 'bg-primary text-primary-foreground border-primary' : 'border-border/80 text-muted-foreground hover:text-foreground'}`}>
                          {isAllRow ? t('roles.allOn') : t('roles.toggle')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
