import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@shared/lib/hooks/useTheme';
import { AuthProvider, useAuth } from '@shared/store/AuthContext';
import { Toaster } from '@shared/components/ui/sonner';
import { AdminShell } from '@admin/components/AdminShell';
import { LoginPage } from '@admin/pages/auth/LoginPage';
import { ForgotPasswordPage, RegisterAccountPage, RegisterSocietyPage } from '@shared/features/auth';
import { DashboardPage } from '@admin/pages/dashboard/DashboardPage';
import { OrganizationsPage } from '@admin/pages/organizations/OrganizationsPage';
import { CommunitiesPage } from '@admin/pages/communities/CommunitiesPage';
import { UnitsPage } from '@admin/pages/units/UnitsPage';

import { AnnouncementsPage } from '@shared/features/announcements/AnnouncementsPage';
import { AdminUsersPage } from '@admin/pages/admin-users/AdminUsersPage';
import { TicketsListPage, SubmitTicketPage, TicketDetailsPage } from '@shared/features/helpdesk';
import { SurfaceProvider } from '@shared/lib/surface';
import { RedirectTo } from '@shared/lib/routing';
import { AmenitiesPage } from '@admin/pages/amenities/AmenitiesPage';
import { MaintenanceBillingView } from '@shared/features/billing/MaintenanceBillingView';
import { VisitorsPage } from '@admin/pages/visitors/VisitorsPage';
import { NotificationsPage } from '@admin/pages/notifications/NotificationsPage';
import { NotificationTemplatesPage } from '@admin/pages/notifications/NotificationTemplatesPage';
import { PeopleManagementView } from '@shared/features/people/PeopleManagementView';
import { MenuManagementPage } from '@admin/pages/menus/MenuManagementPage';
import { MasterDataMenuPage } from '@admin/pages/master-data/MasterDataMenuPage';
import { ConfigPage } from '@admin/pages/config/ConfigPage';
import { RolesPage } from '@admin/pages/roles/RolesPage';
import { CommunicationTestPage } from '@admin/pages/communication-test/CommunicationTestPage';
import { ErrorLogsPage } from '@admin/pages/error-logs/ErrorLogsPage';
import { PlaceholderPage } from '@admin/components/PlaceholderPage';

function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AdminShell>{children}</AdminShell>;
}

const PLACEHOLDERS: { path: string; titleKey: string }[] = [
  { path: '/reports', titleKey: 'admin.nav.reports' },
];

export function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <SurfaceProvider value="admin">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot" element={<ForgotPasswordPage />} />
          <Route path="/register" element={<RegisterAccountPage />} />
          <Route path="/register-society" element={<RegisterSocietyPage />} />
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/organizations" element={<RequireAuth><OrganizationsPage /></RequireAuth>} />
          <Route path="/communities" element={<RequireAuth><CommunitiesPage /></RequireAuth>} />
          <Route path="/units" element={<RequireAuth><UnitsPage /></RequireAuth>} />
          <Route path="/residents" element={<RequireAuth><PeopleManagementView /></RequireAuth>} />
          <Route path="/announcements" element={<RequireAuth><AnnouncementsPage /></RequireAuth>} />
          <Route path="/admin-users" element={<RequireAuth><AdminUsersPage /></RequireAuth>} />
          {/* Help Desk — same shared pages and URLs as the app */}
          <Route path="/helpdesk" element={<RequireAuth><TicketsListPage /></RequireAuth>} />
          <Route path="/helpdesk/new" element={<RequireAuth><SubmitTicketPage /></RequireAuth>} />
          <Route path="/helpdesk/:id" element={<RequireAuth><TicketDetailsPage /></RequireAuth>} />
          {/* Old Help Desk URLs ("/maintenance" now means resident bills in the app) */}
          <Route path="/maintenance" element={<RedirectTo to="/helpdesk" />} />
          <Route path="/maintenance/new" element={<RedirectTo to="/helpdesk/new" />} />
          <Route path="/maintenance/:id" element={<RedirectTo to="/helpdesk/:id" />} />
          <Route path="/tickets" element={<RedirectTo to="/helpdesk" />} />
          <Route path="/tickets/new" element={<RedirectTo to="/helpdesk/new" />} />
          <Route path="/tickets/:id" element={<RedirectTo to="/helpdesk/:id" />} />
          <Route path="/amenities" element={<RequireAuth><AmenitiesPage /></RequireAuth>} />
          <Route path="/billing" element={<RequireAuth><MaintenanceBillingView /></RequireAuth>} />
          <Route path="/visitors" element={<RequireAuth><VisitorsPage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="/notification-templates" element={<RequireAuth><NotificationTemplatesPage /></RequireAuth>} />
          <Route path="/users" element={<RequireAuth><PeopleManagementView /></RequireAuth>} />
          <Route path="/menu-management" element={<RequireAuth><MenuManagementPage /></RequireAuth>} />
          <Route path="/master-data" element={<RequireAuth><MasterDataMenuPage /></RequireAuth>} />
          <Route path="/master-menu" element={<RequireAuth><MasterDataMenuPage /></RequireAuth>} />
          <Route path="/config" element={<RequireAuth><ConfigPage /></RequireAuth>} />
          <Route path="/roles" element={<RequireAuth><RolesPage /></RequireAuth>} />
          <Route path="/communication-test" element={<RequireAuth><CommunicationTestPage /></RequireAuth>} />
          <Route path="/error-logs" element={<RequireAuth><ErrorLogsPage /></RequireAuth>} />
          {PLACEHOLDERS.map((p) => (
            <Route key={p.path} path={p.path} element={<RequireAuth><PlaceholderPage titleKey={p.titleKey} /></RequireAuth>} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </SurfaceProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
