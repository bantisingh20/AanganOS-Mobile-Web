import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@shared/store/AuthContext';
import { WelcomeScreen } from '@app/screens/WelcomeScreen';
import { SplashScreen, hasSeenSplash } from '@app/screens/SplashScreen';
import { LoginScreen } from '@app/screens/LoginScreen';
import { ForgotPasswordScreen } from '@app/screens/ForgotPasswordScreen';
import { RegisterScreen } from '@app/screens/RegisterScreen';
import { RegisterSocietyScreen } from '@app/screens/RegisterSocietyScreen';
import { HomeScreen } from '@app/screens/HomeScreen';
import { useBackButton } from '@app/lib/useBackButton';
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
        <Routes>
          <Route path="/" element={<Entry />} />
          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/forgot" element={<ForgotPasswordScreen />} />
          <Route path="/register" element={<RegisterScreen />} />
          <Route path="/register-society" element={<RegisterSocietyScreen />} />
          <Route path="/home" element={<RequireAuth><HomeScreen /></RequireAuth>} />
          <Route path="/announcements" element={<RequireAuth><AnnouncementsScreen /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsScreen /></RequireAuth>} />
          <Route path="/my-profile" element={<RequireAuth><MyProfileScreen /></RequireAuth>} />
          <Route path="/my-tickets" element={<RequireAuth><MyTicketsScreen /></RequireAuth>} />
          <Route path="/my-tickets/:id" element={<RequireAuth><TicketDetailScreen /></RequireAuth>} />
          <Route path="/raise-ticket" element={<RequireAuth><RaiseTicketScreen /></RequireAuth>} />
          <Route path="/my-household" element={<RequireAuth><MyHouseholdScreen /></RequireAuth>} />
          <Route path="/maintenance" element={<RequireAuth><MaintenanceScreen /></RequireAuth>} />
          <Route path="/billing" element={<RequireAuth><BillingScreen /></RequireAuth>} />
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
          <Route path="/watchlist" element={<RequireAuth><WatchlistScreen /></RequireAuth>} />
          <Route path="/sos" element={<RequireAuth><SosScreen /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
