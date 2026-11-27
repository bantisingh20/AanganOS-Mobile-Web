import { ApiClient } from '@shared/api/client';
import { AuthService } from '@shared/api/auth';
import { OnboardingClient } from '@shared/api/onboarding';
import { ResidentsClient } from '@shared/api/residents';
import { NotificationsClient } from '@shared/api/notifications';
import { AnnouncementsClient } from '@shared/api/announcements';
import { MyTasksClient } from '@shared/api/myTasks';
import { MenuClient } from '@shared/api/menu';
import { OrganizationsClient } from '@shared/api/organizations';
import { SubscriptionsClient } from '@shared/api/subscriptions';
import { CommunitiesClient } from '@shared/api/communities';
import { UnitsClient } from '@shared/api/units';
import { MasterDataClient } from '@shared/api/masterData';
import { AdminUsersClient } from '@shared/api/adminUsers';
import { TicketsClient } from '@shared/api/tickets';
import { AmenitiesClient } from '@shared/api/amenities';
import { MaintenanceBillingClient } from '@shared/api/maintenanceBilling';
import { GateClient } from '@shared/api/gate';
import { SecurityOpsClient } from '@shared/api/securityOps';
import { ParcelsClient } from '@shared/api/parcels';
import { FilesClient } from '@shared/api/files';
import { NotificationTemplatesClient } from '@shared/api/notificationTemplates';
import { NotificationLogsClient } from '@shared/api/notificationLogs';
import { UsersClient } from '@shared/api/users';
import { MenuItemsClient } from '@shared/api/menuItems';
import { ConfigClient } from '@shared/api/config';
import { RolesClient } from '@shared/api/roles';
import { PermissionsClient } from '@shared/api/permissions';
import { CommunicationTestClient } from '@shared/api/communicationTest';
import { ErrorLogsClient } from '@shared/api/errorLogs';
import { WebTokenStore } from '@shared/api/tokenStore';

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5272';

export const tokenStore = new WebTokenStore();

export const api = new ApiClient({
  baseUrl,
  tokenStore,
  // Stay signed in until the user logs out or the server ends the session (e.g. login on another
  // device). Only a real rejection from /auth/refresh signs the user out. A temporary problem — no
  // network, timeout, server restarting, 5xx — keeps the tokens and fails just this request, so the
  // next call or app resume can refresh again. (Previously ANY failure cleared the session, which
  // logged Android users out whenever they opened the app on a bad connection.)
  refreshToken: async (store) => {
    const refreshToken = store.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const result = await rawRefresh(baseUrl, refreshToken);
      store.setFromLogin(result);
      return result.accessToken;
    } catch (err) {
      if (err instanceof SessionRejectedError) {
        store.clear();
        return null;
      }
      throw err;
    }
  },
});

/** /auth/refresh said no (expired, revoked by another login, or logged out): the session is over. */
class SessionRejectedError extends Error {}

export const auth = new AuthService(api, tokenStore);
export const onboarding = new OnboardingClient(api);
export const residents = new ResidentsClient(api);
export const notifications = new NotificationsClient(api);
export const announcements = new AnnouncementsClient(api);
export const myTasks = new MyTasksClient(api);
export const menu = new MenuClient(api);
export const organizations = new OrganizationsClient(api);
export const subscriptions = new SubscriptionsClient(api);
export const communities = new CommunitiesClient(api);
export const units = new UnitsClient(api);
export const masterData = new MasterDataClient(api);
export const adminUsers = new AdminUsersClient(api);
export const tickets = new TicketsClient(api);
export const amenities = new AmenitiesClient(api);
export const maintenanceBilling = new MaintenanceBillingClient(api);
export const gate = new GateClient(api);
export const securityOps = new SecurityOpsClient(api);
export const parcels = new ParcelsClient(api);
export const files = new FilesClient(baseUrl, tokenStore);
export const notificationTemplates = new NotificationTemplatesClient(api);
export const notificationLogs = new NotificationLogsClient(api);
export const users = new UsersClient(api);
export const menuItems = new MenuItemsClient(api);
export const appConfig = new ConfigClient(api);
export const roles = new RolesClient(api);
export const permissions = new PermissionsClient(api);
export const communicationTest = new CommunicationTestClient(api);
export const errorLogs = new ErrorLogsClient(api);

async function rawRefresh(base: string, refreshToken: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/+$/, '')}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  // 400/401/403 = the server rejected this refresh token → session is over.
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new SessionRejectedError('session ended');
  // Anything else that isn't a valid success (5xx, proxy error page, non-JSON) is temporary.
  const envelope = await res.json().catch(() => null);
  if (!res.ok || !envelope?.success || !envelope.data?.accessToken) throw new Error(`refresh unavailable (HTTP ${res.status})`);
  return envelope.data as { accessToken: string; refreshToken: string; expiresAtUtc: string; user?: unknown };
}
