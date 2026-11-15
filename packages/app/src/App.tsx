import { lazy, Suspense, type ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@shared/store/AuthContext';
import { WelcomeScreen } from '@app/screens/WelcomeScreen';
import { SplashScreen, hasSeenSplash } from '@app/screens/SplashScreen';
import { LoginScreen } from '@app/screens/LoginScreen';
import { ForgotPasswordScreen } from '@app/screens/ForgotPasswordScreen';
import { RegisterScreen } from '@app/screens/RegisterScreen';
import { RegisterSocietyScreen } from '@app/screens/RegisterSocietyScreen';
import { PublicPassScreen } from '@app/screens/PublicPassScreen';
import { HomeScreen } from '@app/screens/HomeScreen';
import { useBackButton } from '@app/lib/useBackButton';
import { RefreshCw } from 'lucide-react';

// Core Screens
import { AnnouncementsScreen } from '@app/screens/features/AnnouncementsScreen';
import { NotificationsScreen } from '@app/screens/features/NotificationsScreen';
import { MyProfileScreen } from '@app/screens/features/MyProfileScreen';
import { MyTicketsScreen } from '@app/screens/features/MyTicketsScreen';
import { RaiseTicketScreen } from '@app/screens/features/RaiseTicketScreen';
import { TicketDetailScreen } from '@app/screens/features/TicketDetailScreen';
import { MyHouseholdScreen } from '@app/screens/features/MyHouseholdScreen';
import { MaintenanceScreen } from '@app/screens/features/MaintenanceScreen';
import { BillingScreen } from '@app/screens/features/BillingScreen';
import { MyVisitorsScreen } from '@app/screens/features/MyVisitorsScreen';
import { InviteVisitorScreen } from '@app/screens/features/InviteVisitorScreen';
import { ParcelsScreen } from '@app/screens/features/ParcelsScreen';
import { RecurringVisitorsScreen } from '@app/screens/features/RecurringVisitorsScreen';
import { MyTasksScreen } from '@app/screens/features/MyTasksScreen';
import { VehicleLookupScreen } from '@app/screens/features/VehicleLookupScreen';
import { VerifyPassScreen } from '@app/screens/features/VerifyPassScreen';
import { RegisterWalkinScreen } from '@app/screens/features/RegisterWalkinScreen';
import { EntryExitScreen } from '@app/screens/features/EntryExitScreen';
import { WatchlistScreen } from '@app/screens/features/WatchlistScreen';
import { SosScreen } from '@app/screens/features/SosScreen';
import { ManagePeopleScreen } from '@app/screens/features/ManagePeopleScreen';
import { ResidentApprovalsScreen } from '@app/screens/features/ResidentApprovalsScreen';
import { AdminPageWrapper } from '@app/components/AdminPageWrapper';

// Lazy-loaded Admin Pages for maximum performance & lightweight mobile startup
const DashboardPage = lazy(() => import('@app/screens/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const CommunitiesPage = lazy(() => import('@app/screens/admin/CommunitiesPage').then((m) => ({ default: m.CommunitiesPage })));
const UnitsPage = lazy(() => import('@app/screens/admin/UnitsPage').then((m) => ({ default: m.UnitsPage })));
const OrganizationsPage = lazy(() => import('@app/screens/admin/OrganizationsPage').then((m) => ({ default: m.OrganizationsPage })));
const AmenitiesPage = lazy(() => import('@app/screens/admin/AmenitiesPage').then((m) => ({ default: m.AmenitiesPage })));
const AdminUsersPage = lazy(() => import('@app/screens/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const RolesPage = lazy(() => import('@app/screens/admin/RolesPage').then((m) => ({ default: m.RolesPage })));
const MenuManagementPage = lazy(() => import('@app/screens/admin/MenuManagementPage').then((m) => ({ default: m.MenuManagementPage })));
const NotificationTemplatesPage = lazy(() => import('@app/screens/admin/NotificationTemplatesPage').then((m) => ({ default: m.NotificationTemplatesPage })));
const ConfigPage = lazy(() => import('@app/screens/admin/ConfigPage').then((m) => ({ default: m.ConfigPage })));
const PlaceholderPage = lazy(() => import('@app/screens/admin/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })));

function PageLoading() {
  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      <span className="text-xs font-semibold">Loading screen…</span>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function Entry() {
  const { isAuthenticated } = useAuth();
  if (!hasSeenSplash()) return <Navigate to="/splash" replace />;
  if (isAuthenticated) return <Navigate to="/home" replace />;
  return <WelcomeScreen />;
}

function NotFound() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/home' : '/'} replace />;
}

function BackButtonHandler() {
  useBackButton();
  return null;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <BackButtonHandler />
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Public & Authentication */}
            <Route path="/" element={<Entry />} />
            <Route path="/splash" element={<SplashScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/forgot" element={<ForgotPasswordScreen />} />
            <Route path="/register" element={<RegisterScreen />} />
            <Route path="/register-society" element={<RegisterSocietyScreen />} />
            <Route path="/pass/:token" element={<PublicPassScreen />} />

            {/* Core Home */}
            <Route path="/home" element={<RequireAuth><HomeScreen /></RequireAuth>} />

            {/* Society Operations (Universal Screens) */}
            <Route path="/announcements" element={<RequireAuth><AnnouncementsScreen /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><NotificationsScreen /></RequireAuth>} />
            <Route path="/my-profile" element={<RequireAuth><MyProfileScreen /></RequireAuth>} />

            {/* Helpdesk & Complaints */}
            <Route path="/my-tickets" element={<RequireAuth><MyTicketsScreen /></RequireAuth>} />
            <Route path="/helpdesk" element={<RequireAuth><MyTicketsScreen /></RequireAuth>} />
            <Route path="/tickets" element={<RequireAuth><MyTicketsScreen /></RequireAuth>} />
            <Route path="/my-tickets/:id" element={<RequireAuth><TicketDetailScreen /></RequireAuth>} />
            <Route path="/raise-ticket" element={<RequireAuth><RaiseTicketScreen /></RequireAuth>} />

            {/* Household & Maintenance Billing */}
            <Route path="/my-household" element={<RequireAuth><MyHouseholdScreen /></RequireAuth>} />
            <Route path="/maintenance" element={<RequireAuth><MaintenanceScreen /></RequireAuth>} />
            <Route path="/billing" element={<RequireAuth><BillingScreen /></RequireAuth>} />
            <Route path="/maintenance-billing" element={<RequireAuth><BillingScreen /></RequireAuth>} />

            {/* Visitors & Gate Operations */}
            <Route path="/my-visitors" element={<RequireAuth><MyVisitorsScreen /></RequireAuth>} />
            <Route path="/visitors" element={<RequireAuth><MyVisitorsScreen /></RequireAuth>} />
            <Route path="/invite-visitor" element={<RequireAuth><InviteVisitorScreen /></RequireAuth>} />
            <Route path="/approvals" element={<RequireAuth><MyVisitorsScreen initialTab="approvals" /></RequireAuth>} />
            <Route path="/parcels" element={<RequireAuth><ParcelsScreen /></RequireAuth>} />
            <Route path="/recurring-visitors" element={<RequireAuth><RecurringVisitorsScreen /></RequireAuth>} />
            <Route path="/vehicle-lookup" element={<RequireAuth><VehicleLookupScreen /></RequireAuth>} />
            <Route path="/verify-pass" element={<RequireAuth><VerifyPassScreen /></RequireAuth>} />
            <Route path="/register-walkin" element={<RequireAuth><RegisterWalkinScreen /></RequireAuth>} />
            <Route path="/entry-exit" element={<RequireAuth><EntryExitScreen /></RequireAuth>} />

            {/* People & Society Residents */}
            <Route path="/manage-residents" element={<RequireAuth><ManagePeopleScreen /></RequireAuth>} />
            <Route path="/residents" element={<RequireAuth><ManagePeopleScreen /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth><ManagePeopleScreen /></RequireAuth>} />
            <Route path="/resident-approvals" element={<RequireAuth><ResidentApprovalsScreen /></RequireAuth>} />

            {/* Security & Tasks */}
            <Route path="/my-tasks" element={<RequireAuth><MyTasksScreen /></RequireAuth>} />
            <Route path="/watchlist" element={<RequireAuth><WatchlistScreen /></RequireAuth>} />
            <Route path="/sos" element={<RequireAuth><SosScreen /></RequireAuth>} />

            {/* Admin Management Screens (Wrapped in AdaptiveShell, Lazy-loaded) */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="ERP Dashboard" subtitle="Society performance, occupancy, and KPIs">
                    <DashboardPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/communities"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="Communities" subtitle="Housing societies, complexes, and towers">
                    <CommunitiesPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/units"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="Units & Flats" subtitle="Apartment and unit management">
                    <UnitsPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/organizations"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="Organizations" subtitle="Enterprise and builder group management">
                    <OrganizationsPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/amenities"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="Amenities" subtitle="Society clubhouses, gyms, and sports facilities">
                    <AmenitiesPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/admin-users"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="Admin Users" subtitle="System admins, operators, and staff access">
                    <AdminUsersPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/roles"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="Roles & Permissions" subtitle="User roles and granular security access">
                    <RolesPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/menu-management"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="Menu Management" subtitle="Universal navigation structure across platforms">
                    <MenuManagementPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/notification-templates"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="Notification Templates" subtitle="SMS, Push, and Email notice templates">
                    <NotificationTemplatesPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/config"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="System Configuration" subtitle="Global application parameters">
                    <ConfigPage />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireAuth>
                  <AdminPageWrapper title="Reports" subtitle="Society analytics and downloadable statements">
                    <PlaceholderPage titleKey="admin.nav.reports" />
                  </AdminPageWrapper>
                </RequireAuth>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
