import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyRound, Check, Search, X, RotateCcw, ChevronRight, ChevronsUpDown, Shield,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Badge } from '@shared/components/ui/badge';
import { menuItems, roles } from '@shared/services';
import type { Role, PermissionGrant } from '@shared/api/roles';
import type { MenuItem } from '@shared/api/menuItems';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { tryToast } from '@shared/lib/withToast';
import { EMPTY } from '@shared/lib/format';
import { menuIcon } from '@shared/components/menu/menuIcons';
import { cn } from '@shared/lib/utils';
import {
  ACTION_VIEW, ACTION_DELETE, ACTION_EDIT,
  SCOPE_PLATFORM, SURFACE_COMMON,
  CORE_ACTION_META, EXTRA_ACTION_LABELS,
  permKey, getCategoryForModule, type CoreActionMeta,
} from './roleConstants';
import { buildTree, type PermTreeRow, type PermSurfaceFilter } from './roleTreeUtils';

export function InlinePermissionsTab({
  allRolesList, selectedRoleId, onSelectRole, onRoleUpdated,
}: {
  allRolesList: Role[]; selectedRoleId: string | null; onSelectRole: (id: string) => void; onRoleUpdated: () => void; isSmall?: boolean;
}) {
  const { t } = useTranslation();
  const currentRole = useMemo(() => allRolesList.find((r) => r.id === selectedRoleId) ?? allRolesList[0] ?? null, [allRolesList, selectedRoleId]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [currentGrants, setCurrentGrants] = useState<PermissionGrant[]>([]);
  const [filter, setFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [permSurface, setPermSurface] = useState<PermSurfaceFilter>('Web');
  const [savingBusy, setSavingBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const catalog = useAsync((signal) => menuItems.list(undefined, { signal }).catch(() => [] as MenuItem[]), []);

  // Resource names from the menu catalog plus the role's current grants (built here, not mutated in
  // the effect below — mutating it and listing it as a dependency loaded every role twice).
  const canonicalMap = useMemo(() => {
    const map = new Map<string, string>();
    (catalog.data ?? []).filter((m) => m.isActive !== false).forEach((m) => {
      const res = m.requiredPermissionResource?.trim() || m.key?.trim();
      if (res) map.set(res.toLowerCase(), res);
    });
    currentGrants.forEach((p) => map.set(p.resourceType.trim().toLowerCase(), p.resourceType.trim()));
    return map;
  }, [catalog.data, currentGrants]);

  useEffect(() => {
    if (!currentRole) return;
    let active = true;
    const initial = currentRole.permissions ?? [];
    setCurrentGrants(initial);
    const initialKeys = new Set(initial.map((p) => permKey(p.resourceType, p.action)));
    setSelected(initialKeys);
    setSavedKeys(initialKeys);

    roles.get(currentRole.id).then((fresh) => {
      if (!active || !fresh) return;
      const fg = fresh.permissions ?? [];
      setCurrentGrants(fg);
      const fk = new Set(fg.map((p) => permKey(p.resourceType, p.action)));
      setSelected(fk);
      setSavedKeys(fk);
    }).catch(() => {});
    return () => { active = false; };
  }, [currentRole?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allTreeRows = useMemo(
    () => buildTree(catalog.data ?? [], permSurface, currentGrants, canonicalMap),
    [catalog.data, permSurface, currentGrants, canonicalMap],
  );

  const categories = useMemo(() => {
    const s = new Set<string>();
    allTreeRows.forEach((r) => s.add(r.category));
    return ['All', ...Array.from(s).sort()];
  }, [allTreeRows]);

  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const isSearching = q.length > 0;
    const out: PermTreeRow[] = [];
    let skipUntilDepth = -1;

    for (const r of allTreeRows) {
      if (skipUntilDepth !== -1) {
        if (r.depth > skipUntilDepth) continue;
        skipUntilDepth = -1;
      }
      if (!isSearching && collapsed.has(r.id)) {
        skipUntilDepth = r.depth;
      }
      if (activeCategory !== 'All' && r.category !== activeCategory && !r.descendants.some((d) => getCategoryForModule(d.resource, d.resource) === activeCategory)) {
        continue;
      }
      if (isSearching) {
        const matchesSelf = r.label.toLowerCase().includes(q) || r.resource.toLowerCase().includes(q);
        const matchesKids = r.descendants.some((d) => d.resource.toLowerCase().includes(q));
        if (!matchesSelf && !matchesKids) continue;
      }
      out.push(r);
    }
    return out;
  }, [allTreeRows, activeCategory, filter, collapsed]);

  const hasUnsavedChanges = useMemo(() => {
    if (selected.size !== savedKeys.size) return true;
    for (const k of selected) { if (!savedKeys.has(k)) return true; }
    return false;
  }, [selected, savedKeys]);

  const toggleCollapse = (id: string) => setCollapsed((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const toggleActionOnRow = (row: PermTreeRow, action: number) => {
    const targetKeys = row.descendants.filter((d) => d.actions.includes(action)).map((d) => permKey(d.resource, action));
    if (targetKeys.length === 0) return;
    const allOn = targetKeys.every((k) => selected.has(k));
    setSelected((prev) => {
      const n = new Set(prev);
      targetKeys.forEach((k) => (allOn ? n.delete(k) : n.add(k)));
      return n;
    });
  };

  const toggleRow = (row: PermTreeRow) => {
    const allKeys = row.descendants.flatMap((d) => d.actions.map((a) => permKey(d.resource, a)));
    if (allKeys.length === 0) return;
    const allOn = allKeys.every((k) => selected.has(k));
    setSelected((prev) => {
      const n = new Set(prev);
      allKeys.forEach((k) => (allOn ? n.delete(k) : n.add(k)));
      return n;
    });
  };

  const toggleColumnAction = (act: number) => {
    const keys = allTreeRows.flatMap((r) => (r.hasResource && r.actions.includes(act) ? [permKey(r.resource, act)] : []));
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
      const keys = new Set(allTreeRows.filter((r) => r.hasResource).flatMap((r) => r.actions.map((a) => permKey(r.resource, a))));
      setSelected((prev) => { const n = new Set(prev); keys.forEach((k) => n.delete(k)); return n; });
      return;
    }
    const target = allTreeRows.filter((r) => r.hasResource).flatMap((r) =>
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
      const ok = await tryToast(() => roles.update(currentRole.id, {
        name: currentRole.name, scope: currentRole.scope,
        communityId: currentRole.communityId, permissions: perms,
      }), t('roles.permissionsSaved'));
      if (ok) {
        setSavedKeys(new Set(selected));
        onRoleUpdated();
      }
    } finally { setSavingBusy(false); }
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
              key={r.id} type="button" onClick={() => onSelectRole(r.id)}
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

      {/* 2. Active Role Summary Bar */}
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
              <RotateCcw className="h-3 w-3 mr-1" />{t('common.reset')}
            </Button>
          )}
          <Button size="sm" onClick={saveRolePermissions} disabled={savingBusy} className="h-7 px-3 rounded-[4px] text-[11px] font-medium">
            <Check className="h-3 w-3 stroke-[2.5] mr-1" />{savingBusy ? t('common.saving') : hasUnsavedChanges ? t('units.saveChanges') : t('common.saved')}
          </Button>
        </div>
      </div>

      {/* 3. Surface, Presets & Hierarchy Controls */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-border/80 bg-card p-1.5 text-xs">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPermSurface('Web')} className={`h-6.5 px-2.5 rounded-[4px] text-[11px] font-medium transition-colors ${permSurface === 'Web' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('roles.surfaceAdmin')}</button>
          <button type="button" onClick={() => setPermSurface('Mobile')} className={`h-6.5 px-2.5 rounded-[4px] text-[11px] font-medium transition-colors ${permSurface === 'Mobile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('roles.surfaceApp')}</button>
          <button type="button" onClick={() => setPermSurface('Common')} className={`h-6.5 px-2.5 rounded-[4px] text-[11px] font-medium transition-colors ${permSurface === 'Common' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('roles.surfaceCommon')}</button>
          <button type="button" onClick={() => setPermSurface('all')} className={`h-6.5 px-2 rounded-[4px] text-[11px] font-medium transition-colors ${permSurface === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('roles.surfaceAll')}</button>
          <button type="button" onClick={collapsed.size > 0 ? () => setCollapsed(new Set()) : () => setCollapsed(new Set(allTreeRows.filter((r) => r.hasChildren).map((r) => r.id)))} className="h-6.5 px-2 rounded-[4px] text-[10.5px] font-medium border border-border/80 hover:bg-muted/50 ml-1.5 text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronsUpDown className="h-3 w-3" />
            <span>{collapsed.size > 0 ? t('menuMgmt.expandAll', 'Expand All') : t('menuMgmt.collapseAll', 'Collapse All')}</span>
          </button>
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

      {/* 5. Hierarchical Matrix Table */}
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
                  const ItemIcon = row.icon ? menuIcon(row.icon) : Shield;
                  const isSearching = filter.trim().length > 0;
                  const isCollapsed = collapsed.has(row.id);
                  const allKeys = row.descendants.flatMap((d) => d.actions.map((a) => permKey(d.resource, a)));
                  const isAllRow = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

                  return (
                    <tr key={row.id} className={cn('transition-colors', row.depth === 0 && row.hasChildren ? 'bg-muted/20 font-medium' : 'hover:bg-muted/30')}>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5" style={{ paddingLeft: row.depth * 18 }}>
                          {row.hasChildren && !isSearching ? (
                            <button
                              type="button" onClick={() => toggleCollapse(row.id)}
                              className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                            >
                              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-150', !isCollapsed && 'rotate-90')} />
                            </button>
                          ) : (
                            <span className="h-4.5 w-4.5 shrink-0" />
                          )}
                          {row.depth > 0 && <span className="text-muted-foreground/40 font-mono text-[11px] select-none -ml-0.5 mr-0.5">└</span>}
                          <ItemIcon className={cn('h-3.5 w-3.5 shrink-0', row.depth === 0 ? 'text-primary' : 'text-muted-foreground')} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-xs truncate', row.depth === 0 ? 'font-bold text-foreground' : 'font-medium text-foreground')}>
                                {row.label}
                              </span>
                              {row.surface === SURFACE_COMMON && (
                                <Badge tone="success" className="text-[9px] px-1 py-0 rounded-[3px] font-medium">
                                  {t('menuMgmt.surfaceCommon', 'Common')}
                                </Badge>
                              )}
                              {row.hasChildren && (
                                <Badge tone="muted" className="text-[9px] px-1 py-0 rounded-[3px] font-mono">
                                  {row.childCount}
                                </Badge>
                              )}
                            </div>
                            <span className="block font-mono text-[9px] text-muted-foreground leading-tight mt-0.5">
                              {row.resource || (row.hasChildren ? 'Parent Group' : EMPTY)}
                            </span>
                          </div>
                        </div>
                      </td>
                      {CORE_ACTION_META.map((meta: CoreActionMeta) => {
                        if (!row.actions.includes(meta.action)) return <td key={meta.action} className="py-1.5 px-2 text-center text-muted-foreground/30 text-xs">—</td>;
                        const tKeys = row.descendants.filter((d) => d.actions.includes(meta.action)).map((d) => permKey(d.resource, meta.action));
                        const isAll = tKeys.length > 0 && tKeys.every((k) => selected.has(k));
                        const isSome = !isAll && tKeys.some((k) => selected.has(k));
                        return (
                          <td key={meta.action} className="py-1.5 px-2 text-center">
                            <button
                              type="button" onClick={() => toggleActionOnRow(row, meta.action)}
                              className={cn('h-5 w-5 inline-flex items-center justify-center rounded-[3px] border transition-colors', isAll ? 'bg-primary text-primary-foreground border-primary' : isSome ? 'bg-primary/20 text-primary border-primary/50' : 'border-border/80 hover:border-primary/50 text-transparent')}
                            >
                              {isAll && <Check className="h-3 w-3 stroke-[2.5]" />}
                              {isSome && <span className="block h-0.5 w-2 bg-primary rounded-full" />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="py-1.5 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {row.actions.filter((a) => a > ACTION_DELETE).map((a) => {
                            const tKeys = row.descendants.filter((d) => d.actions.includes(a)).map((d) => permKey(d.resource, a));
                            const isAll = tKeys.length > 0 && tKeys.every((k) => selected.has(k));
                            const isSome = !isAll && tKeys.some((k) => selected.has(k));
                            return (
                              <button
                                key={a} type="button" onClick={() => toggleActionOnRow(row, a)}
                                className={cn('h-5 px-1.5 rounded-[3px] text-[10px] font-medium border transition-colors flex items-center gap-1', isAll ? 'bg-primary/10 text-primary border-primary/60 font-semibold' : isSome ? 'bg-muted/80 text-foreground border-border/80' : 'border-border/80 text-muted-foreground hover:text-foreground')}
                              >
                                {isAll && <Check className="h-2.5 w-2.5 stroke-[2.5]" />}
                                {isSome && <span className="block h-0.5 w-1.5 bg-foreground/60 rounded-full" />}
                                <span>{EXTRA_ACTION_LABELS[a] ?? `#${a}`}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        {row.descendants.length > 0 && (
                          <button
                            type="button" onClick={() => toggleRow(row)}
                            className={cn('h-5 px-2 rounded-[3px] text-[10px] font-medium border transition-colors', isAllRow ? 'bg-primary text-primary-foreground border-primary' : 'border-border/80 text-muted-foreground hover:text-foreground')}
                          >
                            {isAllRow ? t('roles.allOn') : t('roles.toggle')}
                          </button>
                        )}
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
