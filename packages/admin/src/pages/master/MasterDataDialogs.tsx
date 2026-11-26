import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Dialog, DialogHeader } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { masterData, menuItems } from '@shared/services';
import type { MenuItem, MenuItemBody } from '@shared/api/menuItems';
import { toFormError } from '@shared/api/errors';

export function AddMasterEntryDialog({
  open,
  listKey,
  initialCode = '',
  initialLabel = '',
  initialSortOrder = '0',
  initialIsActive = true,
  onClose,
  onSaved,
}: {
  open: boolean;
  listKey: string;
  initialCode?: string;
  initialLabel?: string;
  initialSortOrder?: string;
  initialIsActive?: boolean;
  onClose: () => void;
  onSaved: (key: string) => void;
}) {
  const [key, setKey] = useState(listKey);
  const [code, setCode] = useState(initialCode);
  const [label, setLabel] = useState(initialLabel);
  const [sortOrder, setSortOrder] = useState(initialSortOrder);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!key.trim()) { toast.error('List key is required'); return; }
    if (!code.trim()) { toast.error('Code is required'); return; }
    if (!label.trim()) { toast.error('Label is required'); return; }

    setBusy(true);
    try {
      await masterData.setEntry(key.trim(), {
        code: code.trim().toLowerCase(),
        label: label.trim(),
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        isActive,
      });
      toast.success('Master data entry saved');
      onSaved(key.trim());
      onClose();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-sm p-4 rounded-lg">
      <DialogHeader title="Add / Edit Master Entry" />
      <div className="space-y-3 pt-2 text-xs">
        <div>
          <label className="mb-1 block font-semibold text-foreground">List Key *</label>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. Resident_Type" className="h-8 text-xs rounded-[4px]" />
        </div>
        <div>
          <label className="mb-1 block font-semibold text-foreground">Code (System key) *</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. resident" className="h-8 text-xs rounded-[4px]" />
        </div>
        <div>
          <label className="mb-1 block font-semibold text-foreground">Label (Display name) *</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Resident" className="h-8 text-xs rounded-[4px]" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block font-semibold text-foreground">Sort Order</label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-8 text-xs rounded-[4px]" />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="m_active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
            <label htmlFor="m_active" className="text-xs font-semibold">Active</label>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="h-8 px-3 rounded-[4px] text-xs">Cancel</Button>
        <Button type="button" onClick={save} disabled={busy} className="h-8 px-3 rounded-[4px] text-xs">Save</Button>
      </div>
    </Dialog>
  );
}

export function MenuItemDialog({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [key, setKey] = useState(item?.key ?? '');
  const [label, setLabel] = useState(item?.label ?? '');
  const [icon, setIcon] = useState(item?.icon ?? '');
  const [route, setRoute] = useState(item?.route ?? '');
  const [surface, setSurface] = useState(String(item?.surface ?? 0));
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 10));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [showInSidebar, setShowInSidebar] = useState(item?.showInSidebar ?? true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!key.trim()) { toast.error('Menu Key is required'); return; }
    if (!label.trim()) { toast.error('Menu Label is required'); return; }

    setBusy(true);
    try {
      const body: MenuItemBody = {
        key: key.trim(),
        label: label.trim(),
        icon: icon.trim() || null,
        route: route.trim() || null,
        surface: Number.parseInt(surface, 10) || 0,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        isActive,
        showInSidebar,
      };

      if (item) {
        await menuItems.update(item.id, body);
        toast.success('Menu item updated');
      } else {
        await menuItems.create(body);
        toast.success('Menu item created');
      }
      onSaved();
      onClose();
    } catch (err) { toast.error(toFormError(err).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md p-4 rounded-lg">
      <DialogHeader title={item ? 'Edit Menu Item' : 'Add Menu Item'} />
      <div className="space-y-3 pt-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block font-semibold text-foreground">Menu Key *</label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. master-data" className="h-8 text-xs rounded-[4px]" />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-foreground">Display Label *</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Master Data" className="h-8 text-xs rounded-[4px]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block font-semibold text-foreground">Icon Name</label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. Database, Users" className="h-8 text-xs rounded-[4px]" />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-foreground">Route</label>
            <Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="e.g. /master-data" className="h-8 text-xs rounded-[4px]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block font-semibold text-foreground">Surface</label>
            <Select value={surface} onValueChange={setSurface}>
              <SelectTrigger className="h-8 text-xs rounded-[4px] bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Admin Web (0)</SelectItem>
                <SelectItem value="1">Mobile App (1)</SelectItem>
                <SelectItem value="2">Gate / Staff (2)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-foreground">Sort Order</label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-8 text-xs rounded-[4px]" />
          </div>
        </div>
        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showInSidebar} onChange={(e) => setShowInSidebar(e.target.checked)} className="rounded" />
            <span className="font-semibold">Show in Sidebar</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
            <span className="font-semibold">Active</span>
          </label>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="h-8 px-3 rounded-[4px] text-xs">Cancel</Button>
        <Button type="button" onClick={save} disabled={busy} className="h-8 px-3 rounded-[4px] text-xs">{item ? 'Update' : 'Create'}</Button>
      </div>
    </Dialog>
  );
}
