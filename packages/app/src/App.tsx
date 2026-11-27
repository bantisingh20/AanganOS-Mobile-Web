import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeProvider } from '@shared/lib/hooks/useTheme';
import { AuthProvider, useAuth } from '@shared/store/AuthContext';
import { Toaster } from '@shared/components/ui/sonner';
import { WelcomeScreen } from '@app/screens/auth/WelcomeScreen';
import { SplashScreen, hasSeenSplash } from '@app/screens/auth/SplashScreen';
import { LoginScreen } from '@app/screens/auth/LoginScreen';
import { ForgotPasswordPage, RegisterAccountPage, RegisterSocietyPage } from '@shared/features/auth';
import { PublicPassScreen } from '@app/screens/auth/PublicPassScreen';
import { HomeScreen } from '@app/screens/home/HomeScreen';
import { useBackButton } from '@app/lib/useBackButton';
import { AnnouncementsPage } from '@shared/features/announcements/AnnouncementsPage';
import { NotificationsScreen } from '@app/screens/profile/NotificationsScreen';
import { MyProfileScreen } from '@app/screens/profile/MyProfileScreen';
import { TicketsListPage, SubmitTicketPage, TicketDetailsPage } from '@shared/features/helpdesk';
import { SurfaceProvider } from '@shared/lib/surface';
import { RedirectTo } from '@shared/lib/routing';
import { AppUpdateGate } from '@app/components/AppUpdateGate';
import { MyHouseholdScreen } from '@app/screens/profile/MyHouseholdScreen';
import { MaintenanceScreen } from '@app/screens/maintenance/MaintenanceScreen';
import { MaintenanceBillingView } from '@shared/features/billing/MaintenanceBillingView';
import { MyVisitorsScreen } from '@app/screens/visitors/MyVisitorsScreen';
import { InviteVisitorScreen } from '@app/screens/visitors/InviteVisitorScreen';
import { ParcelsScreen } from '@app/screens/visitors/ParcelsScreen';
import { RecurringVisitorsScreen } from '@app/screens/visitors/RecurringVisitorsScreen';
import { MyTasksScreen } from '@app/screens/profile/MyTasksScreen';
import { VehicleLookupScreen } from '@app/screens/security/VehicleLookupScreen';
import { VerifyPassScreen } from '@app/screens/security/VerifyPassScreen';
import { RegisterWalkinScreen } from '@app/screens/security/RegisterWalkinScreen';
import { EntryExitScreen } from '@app/screens/security/EntryExitScreen';
import { WatchlistScreen } from '@app/screens/security/WatchlistScreen';
import { SosScreen } from '@app/screens/security/SosScreen';
import { PeopleManagementView } from '@shared/features/people/PeopleManagementView';

import type { ReactElement } from 'react';

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

/** Resident Approvals menu entry — the shared People page, opened on the Pending KYC tab. */
function ResidentApprovalsRoute() {
  const { t } = useTranslation();
  return (
    <PeopleManagementView
      initialStatusTab="pending"
      title={t('residentApprovals.title', 'Resident Approvals')}
      subtitle={t('residentApprovals.subtitle', 'Review and verify pending resident KYC')}
    />
  );
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
    <ThemeProvider>
      <AuthProvider>
        <SurfaceProvider value="app">
        <BrowserRouter>
          <BackButtonHandler />
          <AppUpdateGate />
          <Routes>
          <Route path="/" element={<Entry />} />
          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/forgot" element={<ForgotPasswordPage />} />
          <Route path="/register" element={<RegisterAccountPage />} />
          <Route path="/register-society" element={<RegisterSocietyPage />} />
          <Route path="/pass/:token" element={<PublicPassScreen />} />
          <Route path="/home" element={<RequireAuth><HomeScreen /></RequireAuth>} />
          <Route path="/announcements" element={<RequireAuth><AnnouncementsPage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsScreen /></RequireAuth>} />
          <Route path="/my-profile" element={<RequireAuth><MyProfileScreen /></RequireAuth>} />
          {/* Help Desk — same shared pages and URLs as admin */}
          <Route path="/helpdesk" element={<RequireAuth><TicketsListPage /></RequireAuth>} />
          <Route path="/helpdesk/new" element={<RequireAuth><SubmitTicketPage /></RequireAuth>} />
          <Route path="/helpdesk/:id" element={<RequireAuth><TicketDetailsPage /></RequireAuth>} />
          {/* Old Help Desk URLs (links in older builds, notifications) */}
          <Route path="/my-tickets" element={<RedirectTo to="/helpdesk" />} />
          <Route path="/my-tickets/:id" element={<RedirectTo to="/helpdesk/:id" />} />
          <Route path="/raise-ticket" element={<RedirectTo to="/helpdesk/new" />} />
          <Route path="/my-household" element={<RequireAuth><MyHouseholdScreen /></RequireAuth>} />
          <Route path="/maintenance" element={<RequireAuth><MaintenanceScreen /></RequireAuth>} />
          <Route path="/billing" element={<RequireAuth><MaintenanceBillingView /></RequireAuth>} />
          <Route path="/maintenance-billing" element={<RequireAuth><MaintenanceBillingView /></RequireAuth>} />
          <Route path="/my-visitors" element={<RequireAuth><MyVisitorsScreen /></RequireAuth>} />
          <Route path="/visitors" element={<RequireAuth><MyVisitorsScreen /></RequireAuth>} />
          <Route path="/invite-visitor" element={<RequireAuth><InviteVisitorScreen /></RequireAuth>} />
          <Route path="/approvals" element={<RequireAuth><MyVisitorsScreen initialTab="approvals" /></RequireAuth>} />
          <Route path="/parcels" element={<RequireAuth><ParcelsScreen /></RequireAuth>} />
          <Route path="/recurring-visitors" element={<RequireAuth><RecurringVisitorsScreen /></RequireAuth>} />
          <Route path="/my-tasks" element={<RequireAuth><MyTasksScreen /></RequireAuth>} />
          <Route path="/vehicle-lookup" element={<RequireAuth><VehicleLookupScreen /></RequireAuth>} />
          <Route path="/verify-pass" element={<RequireAuth><VerifyPassScreen /></RequireAuth>} />
          <Route path="/register-walkin" element={<RequireAuth><RegisterWalkinScreen /></RequireAuth>} />
          <Route path="/entry-exit" element={<RequireAuth><EntryExitScreen /></RequireAuth>} />
          <Route path="/users" element={<RequireAuth><PeopleManagementView /></RequireAuth>} />
          <Route path="/residents" element={<RequireAuth><PeopleManagementView /></RequireAuth>} />
          {/* "Manage Residents" tile route — was missing, so the catch-all sent users to /home */}
          <Route path="/manage-residents" element={<RequireAuth><PeopleManagementView /></RequireAuth>} />
          <Route path="/resident-approvals" element={<RequireAuth><ResidentApprovalsRoute /></RequireAuth>} />
          <Route path="/watchlist" element={<RequireAuth><WatchlistScreen /></RequireAuth>} />
          <Route path="/sos" element={<RequireAuth><SosScreen /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
        </SurfaceProvider>
      <Toaster position="top-center" richColors />
    </AuthProvider>
    </ThemeProvider>
  );
}
