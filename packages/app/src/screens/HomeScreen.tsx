import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, type TabKey } from '@app/components/AppShell';
import { DashboardTab } from '@app/screens/home/DashboardTab';
import { ServicesTab } from '@app/screens/home/ServicesTab';
import { ProfileTab } from '@app/screens/home/ProfileTab';
import { residents, notifications } from '@shared/services';
import { useAuth } from '@shared/store/AuthContext';
import { useAsync } from '@shared/lib/useAsync';

let lastHomeTab: TabKey = 'home';

export function HomeScreen() {
  const navigate = useNavigate();
  const { displayName, user } = useAuth();
  console.log('HomeScreen: displayName', displayName, 'user', user);
  const [tab, setTabState] = useState<TabKey>(lastHomeTab);
  const setTab = (t: TabKey) => { lastHomeTab = t; setTabState(t); };

  const meQuery = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const unreadQuery = useAsync((signal) => notifications.unreadCount({ signal }).catch(() => 0), [tab]);

  const userName = meQuery.data?.resident?.name ?? displayName ?? 'Signed in';
  const unitLabel = meQuery.data?.units?.[0]?.unitNumber ?? null;
  const societyName = user?.organizationName ?? '';
  const unreadCount = unreadQuery.data ?? 0;

  const goNotifications = () => navigate('/notifications');

  return (
    <AppShell activeTab={tab} onTabChange={setTab}>
      {tab === 'home' ? (
        <DashboardTab
          userName={userName}
          unitLabel={unitLabel}
          societyName={societyName}
          unreadCount={unreadCount}
          onNotifications={goNotifications}
          onOpenProfile={() => setTab('profile')}
        />
      ) : tab === 'services' ? (
        <ServicesTab unreadCount={unreadCount} onNotifications={goNotifications} />
      ) : (
        <ProfileTab userName={userName} societyName={societyName} unreadCount={unreadCount} onNotifications={goNotifications} />
      )}
    </AppShell>
  );
}
