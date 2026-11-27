import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Drawer } from '@shared/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { menuItems } from '@shared/services';
import type { MenuItem, MenuItemBody } from '@shared/api/menuItems';
import { tryToast } from '@shared/lib/withToast';
import { MenuIconPicker } from '@shared/components/menu/MenuIconPicker';
import { cn } from '@shared/lib/utils';

export type Option = { value: string; label: string };

const SURFACE_APP = 0;
const SURFACE_ADMIN = 1;
const SURFACE_COMMON = 2;

const ACTIONS: Option[] = [
  { value: '0', label: 'View' },
  { value: '1', label: 'Create' },
  { value: '2', label: 'Edit' },
  { value: '3', label: 'Delete' },
  { value: '4', label: 'Approve' },
  { value: '5', label: 'Export' },
  { value: '6', label: 'Assign' },
  { value: '7', label: 'Access' },
];

const DEFAULT_ACTIONS = [0, 1, 2, 3, 7];

function SearchableSelect({
  label, value, options, placeholder = 'Select…', searchPlaceholder = 'Search parent menu...',
  emptyText = 'No matching parent menu found', onChange, disabled = false, className,
}: {
  label: string; value: string; options: Option[]; placeholder?: string; searchPlaceholder?: string;
  emptyText?: string; onChange: (value: string) => void; disabled?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery('');
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
      <button
        type="button" disabled={disabled} onClick={() => setOpen((p) => !p)}
        className={cn(
          'flex h-8.5 w-full items-center justify-between rounded-md border border-input bg-background px-2.5 text-left text-xs transition-colors hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary',
          disabled && 'cursor-not-allowed opacity-50',
          open && 'ring-1 ring-primary border-primary',
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn('ml-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[220px] rounded-md border border-border bg-card p-1.5 shadow-lg animate-in fade-in-50 zoom-in-95">
          <div className="relative mb-1.5">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-7 w-full rounded bg-muted/60 pl-7 pr-6 text-xs outline-none placeholder:text-muted-foreground focus:bg-background focus:ring-1 focus:ring-primary"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filtered.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">{emptyText}</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted',
                    opt.value === value ? 'bg-primary/10 font-medium text-primary' : 'text-foreground',
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.value === value && <Check className="ml-1.5 h-3 w-3 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MenuItemFormDrawer({
  open, item, parentOptions, onClose, onSaved,
}: {
  open: boolean; item?: MenuItem | null; parentOptions: Option[]; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!item;
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [surface, setSurface] = useState(String(SURFACE_COMMON));
  const [parentId, setParentId] = useState('');
  const [route, setRoute] = useState('');
  const [icon, setIcon] = useState('');
  const [requiresPermission, setRequiresPermission] = useState(false);
  const [actions, setActions] = useState<number[]>([]);
  const [resource, setResource] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [showInSidebar, setShowInSidebar] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKey(item?.key ?? '');
    setLabel(item?.label ?? '');
    setSurface(String(item?.surface ?? SURFACE_COMMON));
    setParentId(item?.parentId ?? '');
    setRoute(item?.route ?? '');
    setIcon(item?.icon ?? '');
    const isNew = !item;
    setRequiresPermission(isNew ? true : (item?.requiredPermissionActions?.length ?? 0) > 0);
    setActions(isNew ? DEFAULT_ACTIONS : (item?.requiredPermissionActions ?? []));
    setResource(item?.requiredPermissionResource ?? '');
    setSortOrder(String(item?.sortOrder ?? 0));
    setIsActive(item?.isActive ?? true);
    setShowInSidebar(item?.showInSidebar ?? true);
  }, [open, item]);

  const sortNum = Number.parseInt(sortOrder, 10);
  const sortValid = Number.isInteger(sortNum) && sortNum >= 0;
  const canSubmit = !!label.trim() && sortValid && (isEdit || !!key.trim()) && (!requiresPermission || (actions.length > 0 && !!resource.trim()));

  const toggleAction = (v: number) => {
    setActions((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)));
  };

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    try {
      const body: MenuItemBody = {
        parentId: parentId || null,
        label: label.trim(),
        icon: icon.trim() || null,
        route: route.trim() || null,
        surface: Number.parseInt(surface, 10),
        requiredPermissionActions: requiresPermission ? actions : [],
        requiredPermissionResource: requiresPermission ? resource.trim() : null,
        sortOrder: sortNum,
        isActive,
        showInSidebar,
      };
      const ok = await tryToast(
        () => (isEdit ? menuItems.update(item!.id, body) : menuItems.create({ ...body, key: key.trim() })),
        isEdit ? t('menuMgmt.updated') : t('menuMgmt.created'),
      );
      if (ok) onSaved();
    } finally { setBusy(false); }
  };

  const parentSelectOptions: Option[] = [{ value: '', label: t('menuMgmt.topLevel') }, ...parentOptions];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      className="w-full sm:max-w-lg md:max-w-xl"
      title={isEdit ? (item?.label || item?.key) : t('menuMgmt.addTitle')}
      extra={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="h-7.5 px-3 rounded-[4px] text-xs border-border/80">{t('common.cancel')}</Button>
          <Button size="sm" onClick={submit} disabled={busy || !canSubmit} className="h-7.5 px-3 rounded-[4px] text-xs">
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {isEdit ? t('menuMgmt.saveChanges') : t('menuMgmt.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col min-h-full justify-between pt-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('menuMgmt.keyLabel')} *</label>
            <Input value={key} disabled={isEdit} onChange={(e) => setKey(e.target.value)} placeholder={t('menuMgmt.keyPlaceholder')} maxLength={100} className="h-8.5 rounded-[4px] text-xs font-mono" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('menuMgmt.labelLabel')} *</label>
            <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('menuMgmt.labelPlaceholder')} maxLength={200} className="h-8.5 rounded-[4px] text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('menuMgmt.colSurface')}</label>
            <Select value={surface} onValueChange={setSurface}>
              <SelectTrigger className="h-8.5 w-full rounded-[4px] text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={String(SURFACE_COMMON)}>Common (Web & Mobile)</SelectItem>
                <SelectItem value={String(SURFACE_ADMIN)}>Web (Admin)</SelectItem>
                <SelectItem value={String(SURFACE_APP)}>Mobile (App)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <SearchableSelect label={t('menuMgmt.parentLabel')} value={parentId} options={parentSelectOptions} placeholder={t('menuMgmt.topLevel')} onChange={setParentId} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">{t('menuMgmt.colRoute')}</label>
            <Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder={t('menuMgmt.routePlaceholder')} maxLength={200} className="h-8.5 rounded-[4px] text-xs font-mono" />
          </div>
          <div className="sm:col-span-2">
            <MenuIconPicker value={icon} onChange={setIcon} label={t('menuMgmt.colIcon')} placeholder={t('menuMgmt.iconPlaceholder')} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-foreground">{t('menuMgmt.requiresPermission')}</label>
            <div className="flex gap-1 rounded-[4px] bg-muted/60 p-0.5 border border-border/70 w-52">
              <button type="button" onClick={() => setRequiresPermission(false)} className={cn('flex-1 rounded-[3px] px-2 py-0.5 text-xs font-medium transition-colors', !requiresPermission ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground')}>{t('menuMgmt.permEveryone')}</button>
              <button type="button" onClick={() => setRequiresPermission(true)} className={cn('flex-1 rounded-[3px] px-2 py-0.5 text-xs font-medium transition-colors', requiresPermission ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground')}>{t('menuMgmt.permRestricted')}</button>
            </div>
          </div>
          {requiresPermission && (
            <>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-foreground">{t('menuMgmt.resourceLabel')} *</label>
                <Input value={resource} onChange={(e) => setResource(e.target.value)} placeholder={t('menuMgmt.resourcePlaceholder')} maxLength={128} className="h-8.5 rounded-[4px] text-xs font-mono" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-foreground">{t('menuMgmt.requiredActions')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIONS.map((a) => {
                    const on = actions.includes(Number(a.value));
                    return (
                      <button key={a.value} type="button" onClick={() => toggleAction(Number(a.value))}
                        className={cn('h-6.5 px-2.5 rounded-[4px] border text-[11px] font-medium transition-colors', on ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border/80 text-muted-foreground hover:border-border hover:text-foreground')}>
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('menuMgmt.sortOrderLabel')}</label>
            <Input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-8.5 rounded-[4px] text-xs" />
          </div>
          <div className="flex items-center gap-4 pt-4">
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-3.5 w-3.5 rounded border-input accent-primary" />
              {t('menuMgmt.activeLabel')}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
              <input type="checkbox" checked={showInSidebar} onChange={(e) => setShowInSidebar(e.target.checked)} className="h-3.5 w-3.5 rounded border-input accent-primary" />
              {t('menuMgmt.sidebarLabel')}
            </label>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
