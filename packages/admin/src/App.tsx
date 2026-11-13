import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { AuthProvider, useAuth } from '@shared/store/AuthContext';
import { AdminShell } from '@admin/components/AdminShell';
import { LoginPage } from '@admin/pages/LoginPage';
import { ForgotPasswordPage } from '@admin/pages/ForgotPasswordPage';
import { DashboardPage } from '@admin/pages/DashboardPage';
import { OrganizationsPage } from '@admin/pages/OrganizationsPage';
import { CommunitiesPage } from '@admin/pages/CommunitiesPage';
import { UnitsPage } from '@admin/pages/UnitsPage';
import { ResidentsPage } from '@admin/pages/ResidentsPage';
import { AnnouncementsPage } from '@admin/pages/AnnouncementsPage';
import { AdminUsersPage } from '@admin/pages/AdminUsersPage';
import { TicketsPage } from '@admin/pages/TicketsPage';
import { AmenitiesPage } from '@admin/pages/AmenitiesPage';
import { MaintenanceBillingPage } from '@admin/pages/MaintenanceBillingPage';
import { VisitorsPage } from '@admin/pages/VisitorsPage';
import { NotificationsPage } from '@admin/pages/NotificationsPage';
import { NotificationTemplatesPage } from '@admin/pages/NotificationTemplatesPage';
import { UsersPage } from '@admin/pages/UsersPage';
import { MenuManagementPage } from '@admin/pages/MenuManagementPage';
import { ConfigPage } from '@admin/pages/ConfigPage';
import { RolesPage } from '@admin/pages/RolesPage';
import { PlaceholderPage } from '@admin/pages/PlaceholderPage';

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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="aanganos-admin-theme">
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot" element={<ForgotPasswordPage />} />
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/organizations" element={<RequireAuth><OrganizationsPage /></RequireAuth>} />
          <Route path="/communities" element={<RequireAuth><CommunitiesPage /></RequireAuth>} />
          <Route path="/units" element={<RequireAuth><UnitsPage /></RequireAuth>} />
          <Route path="/residents" element={<RequireAuth><ResidentsPage /></RequireAuth>} />
          <Route path="/announcements" element={<RequireAuth><AnnouncementsPage /></RequireAuth>} />
          <Route path="/admin-users" element={<RequireAuth><AdminUsersPage /></RequireAuth>} />
          <Route path="/maintenance" element={<RequireAuth><TicketsPage /></RequireAuth>} />
          <Route path="/amenities" element={<RequireAuth><AmenitiesPage /></RequireAuth>} />
          <Route path="/maintenance-billing" element={<RequireAuth><MaintenanceBillingPage /></RequireAuth>} />
          <Route path="/visitors" element={<RequireAuth><VisitorsPage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="/notification-templates" element={<RequireAuth><NotificationTemplatesPage /></RequireAuth>} />
          <Route path="/users" element={<RequireAuth><UsersPage /></RequireAuth>} />
          <Route path="/menu-management" element={<RequireAuth><MenuManagementPage /></RequireAuth>} />
          <Route path="/config" element={<RequireAuth><ConfigPage /></RequireAuth>} />
          <Route path="/roles" element={<RequireAuth><RolesPage /></RequireAuth>} />
          {PLACEHOLDERS.map((p) => (
            <Route key={p.path} path={p.path} element={<RequireAuth><PlaceholderPage titleKey={p.titleKey} /></RequireAuth>} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
