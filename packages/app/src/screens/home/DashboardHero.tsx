import { Bell, Home, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HERO, greetingKey, initialsOf } from './dashboardHelpers';

export function DashboardHero({
  userName,
  unitLabel,
  societyName,
  unreadCount,
  onNotifications,
  onOpenProfile,
  onSos,
}: {
  userName: string;
  unitLabel: string | null;
  societyName: string;
  unreadCount: number;
  onNotifications: () => void;
  onOpenProfile: () => void;
  onSos: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="safe-top relative min-h-[230px] overflow-hidden">
      <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#081812]/80 via-[#0b261d]/85 to-background" />

      <div className="relative flex flex-col gap-3.5 px-5 pb-5 pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
            <span>Aangan</span><span className="text-[#8ef0c0]">OS</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSos}
              aria-label="SOS Alert"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/90 text-white shadow-sm active:scale-95 transition-transform"
            >
              <ShieldAlert className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onNotifications}
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#0b261d] active:scale-95 transition-transform"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-destructive" />
              ) : null}
            </button>
            <button
              type="button"
              onClick={onOpenProfile}
              aria-label="Profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm font-extrabold text-primary active:scale-95 transition-transform"
            >
              {initialsOf(userName)}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-white/80 uppercase">{t(greetingKey())}</p>
          <h1 className="text-2xl font-black text-white">{userName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {unitLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
                <Home className="h-3.5 w-3.5 text-[#8ef0c0]" /> {unitLabel}
              </span>
            ) : null}
            {societyName ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                {societyName}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReqStat({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <span className="text-lg font-black" style={{ color: tint }}>{value}</span>
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    </div>
  );
}
