import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, type TabKey } from '@app/components/AppShell';
import { DashboardTab } from '@app/screens/home/DashboardTab';
import { ServicesTab } from '@app/screens/home/ServicesTab';
import { ProfileTab } from '@app/screens/home/ProfileTab';
import { residents } from '@shared/services';
import { useAuth } from '@shared/store/AuthContext';
import { useAsync } from '@shared/lib/hooks/useAsync';
import { useUnreadCount } from '@shared/lib/hooks/useUnreadCount';
import { freshBootstrap } from '@shared/lib/hooks/useBootstrap';
import { cn } from '@shared/lib/utils';
import { unitLabel } from '@shared/lib/unitLabel';

let lastHomeTab: TabKey = 'home';

export function HomeScreen() {
  const navigate = useNavigate();
  const { displayName, user } = useAuth();
  const [tab, setTabState] = useState<TabKey>(lastHomeTab);
  // Tabs stay mounted once opened, so switching Home → Services → Home doesn't reload the dashboard.
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set([lastHomeTab]));
  const setTab = (t: TabKey) => {
    lastHomeTab = t;
    setTabState(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
  };

  // Waits for the startup bootstrap (which fills the profile cache) instead of racing it.
  const meQuery = useAsync((signal) => freshBootstrap().then(() => residents.me({ signal })).catch(() => null), []);
  // Shared app-wide count (one 60 s poll) — no refetch per tab switch.
  const unreadCount = useUnreadCount();

  const userName = meQuery.data?.resident?.name ?? displayName ?? 'Signed in';
  const myUnit = meQuery.data?.units?.[0];
  const unitText = myUnit ? unitLabel(myUnit) : null;
  const societyName = user?.organizationName ?? '';

  const goNotifications = () => navigate('/notifications');
  const pane = (key: TabKey) => cn(tab === key ? 'contents' : 'hidden');

  return (
    <AppShell activeTab={tab} onTabChange={setTab}>
      {visited.has('home') ? (
        <div className={pane('home')}>
          <DashboardTab
            userName={userName}
            unitLabel={unitText}
            societyName={societyName}
            unreadCount={unreadCount}
            onNotifications={goNotifications}
            onOpenProfile={() => setTab('profile')}
            onOpenServices={() => setTab('services')}
          />
        </div>
      ) : null}
      {visited.has('services') ? (
        <div className={pane('services')}>
          <ServicesTab unreadCount={unreadCount} onNotifications={goNotifications} />
        </div>
      ) : null}
      {visited.has('profile') ? (
        <div className={pane('profile')}>
          <ProfileTab userName={userName} societyName={societyName} unreadCount={unreadCount} onNotifications={goNotifications} />
        </div>
      ) : null}
    </AppShell>
  );
}
