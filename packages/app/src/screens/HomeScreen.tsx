import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdaptiveShell, type BottomTabKey } from '@shared/components/layout/AdaptiveShell';
import { DashboardTab } from '@app/screens/home/DashboardTab';
import { ServicesTab } from '@app/screens/home/ServicesTab';
import { ProfileTab } from '@app/screens/home/ProfileTab';
import { DashboardPage } from '@app/screens/admin/DashboardPage';
import { residents, notifications } from '@shared/services';
import { useAuth } from '@shared/store/AuthContext';
import { useAsync } from '@shared/lib/useAsync';

let lastHomeTab: BottomTabKey = 'home';

export function HomeScreen() {
  const navigate = useNavigate();
  const { displayName, user, roles } = useAuth();

  const [tab, setTabState] = useState<BottomTabKey>(lastHomeTab);
  const setTab = (t: BottomTabKey) => {
    lastHomeTab = t;
    setTabState(t);
  };

  const meQuery = useAsync((signal) => residents.me({ signal }).catch(() => null), []);
  const unreadQuery = useAsync((signal) => notifications.unreadCount({ signal }).catch(() => 0), [tab]);

  const userName = meQuery.data?.resident?.name ?? displayName ?? 'Signed in';
  const unitLabel = meQuery.data?.units?.[0]?.unitNumber ?? null;
  const societyName = user?.organizationName ?? meQuery.data?.resident?.communityName ?? '';
  const unreadCount = unreadQuery.data ?? 0;

  const goNotifications = () => navigate('/notifications');

  const isAdminOrManagement =
    roles.some((r) =>
      ['SuperAdmin', 'CommunityAdmin', 'OrganizationAdmin', 'Admin', 'Manager', 'President', 'Secretary', 'Treasurer'].includes(r),
    ) || !unitLabel;

  // Title and subtitle for the shell
  const shellTitle =
    tab === 'services'
      ? 'Services & Directory'
      : tab === 'profile'
      ? 'My Profile'
      : societyName
      ? societyName
      : 'Society ERP Dashboard';

  const shellSubtitle =
    tab === 'services'
      ? 'Society operations, gate management, and quick utilities'
      : tab === 'profile'
      ? userName
      : unitLabel
      ? `Flat ${unitLabel}`
      : 'Society Operations & Management Dashboard';

  return (
    <AdaptiveShell
      title={shellTitle}
      subtitle={shellSubtitle}
      activeTab={tab}
      onTabChange={setTab}
      hideHeaderOnMobile={tab === 'home'}
      hideDesktopSubHeader={true}
      societyName={societyName}
      unitLabel={unitLabel}
    >
      {/* ---------------------------------------------------------------------
          DESKTOP VIEW (>= 768px): Shows full ERP Dashboard (or Resident Dashboard)
          --------------------------------------------------------------------- */}
      <div className="hidden md:block w-full">
        {isAdminOrManagement ? (
          <DashboardPage />
        ) : (
          <DashboardTab
            userName={userName}
            unitLabel={unitLabel}
            societyName={societyName}
            unreadCount={unreadCount}
            onNotifications={goNotifications}
            onOpenProfile={() => navigate('/my-profile')}
            onOpenServices={() => undefined}
          />
        )}
      </div>

      {/* ---------------------------------------------------------------------
          MOBILE VIEW (< 768px): Shows active tab based on bottom bar
          --------------------------------------------------------------------- */}
      <div className="block md:hidden w-full">
        {tab === 'home' ? (
          <DashboardTab
            userName={userName}
            unitLabel={unitLabel}
            societyName={societyName}
            unreadCount={unreadCount}
            onNotifications={goNotifications}
            onOpenProfile={() => setTab('profile')}
            onOpenServices={() => setTab('services')}
          />
        ) : tab === 'services' ? (
          <ServicesTab unreadCount={unreadCount} onNotifications={goNotifications} />
        ) : (
          <ProfileTab
            userName={userName}
            societyName={societyName}
            unreadCount={unreadCount}
            onNotifications={goNotifications}
          />
        )}
      </div>
    </AdaptiveShell>
  );
}

export default HomeScreen;
