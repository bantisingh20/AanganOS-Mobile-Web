import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { Input } from './ui/input';
import { AVAILABLE_MENU_ICONS, menuIcon, type MenuIconOption } from './menuIcons';

interface MenuIconPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

const QUICK_SUGGESTIONS = [
  { name: 'MailOutlined', label: 'Notification Templates' },
  { name: 'Wallet', label: 'Maintenance & Billing' },
  { name: 'NotificationOutlined', label: 'Announcements' },
  { name: 'ToolOutlined', label: 'Help Desk' },
  { name: 'AppstoreOutlined', label: 'Dashboard' },
  { name: 'HomeOutlined', label: 'Home' },
  { name: 'TeamOutlined', label: 'Residents' },
];

export function MenuIconPicker({
  value,
  onChange,
  label = 'Menu Icon',
  placeholder = 'Select or type an icon...',
}: MenuIconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');

  const categories = ['All', 'General', 'Operations', 'Finance', 'Communication', 'Admin & Security'] as const;

  const filteredIcons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AVAILABLE_MENU_ICONS.filter((item: MenuIconOption) => {
      const matchCat = category === 'All' || item.category === category;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [search, category]);

  const SelectedIcon = menuIcon(value.trim() || null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          {isOpen ? 'Hide Icon Picker' : 'Browse All Icons'}
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Main input with preview & quick controls */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-emerald-50/70 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <SelectedIcon className="h-5 w-5" />
        </div>
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={100}
            className="h-9 pr-8 text-xs font-mono"
          />
          {value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Clear icon"
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Quick suggestions */}
      {!isOpen && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-muted-foreground mr-1">Suggestions:</span>
          {QUICK_SUGGESTIONS.map((sug) => {
            const SugIcon = menuIcon(sug.name);
            const isCurrent = value.trim().toLowerCase() === sug.name.toLowerCase();
            return (
              <button
                key={sug.name}
                type="button"
                onClick={() => onChange(sug.name)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] border transition-colors ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'border-border/70 bg-muted/40 text-muted-foreground hover:border-emerald-300 hover:text-foreground'
                }`}
              >
                <SugIcon className="h-3 w-3 shrink-0" />
                <span>{sug.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Expanded visual icon picker */}
      {isOpen && (
        <div className="rounded-xl border border-border bg-card/60 p-3 shadow-sm space-y-2.5 mt-2">
          {/* Search bar inside picker */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons (e.g. Mail, Templates, Billing, Wallet, User)..."
              className="h-8 pl-8 text-xs"
              autoFocus
            />
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  category === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid of icons */}
          <div className="max-h-52 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {filteredIcons.length === 0 ? (
              <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
                No matching icons found.
              </div>
            ) : (
              filteredIcons.map((item) => {
                const ItemIcon = item.icon;
                const isSelected = value.trim().toLowerCase() === item.name.toLowerCase();
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      onChange(item.name);
                    }}
                    className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100 ring-1 ring-emerald-500'
                        : 'border-border/50 hover:border-emerald-300 hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-background border-border text-foreground'
                      }`}
                    >
                      <ItemIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] truncate font-medium">{item.label}</div>
                      <div className="text-[9px] text-muted-foreground truncate font-mono">{item.name}</div>
                    </div>
                    {isSelected ? <Check className="h-3 w-3 text-emerald-600 shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
