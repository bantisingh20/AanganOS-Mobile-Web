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
import { WebTokenStore } from '@shared/api/tokenStore';

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5272';

export const tokenStore = new WebTokenStore();

export const api = new ApiClient({
  baseUrl,
  tokenStore,
  refreshToken: async (store) => {
    const refreshToken = store.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const result = await rawRefresh(baseUrl, refreshToken);
      store.setFromLogin(result);
      return result.accessToken;
    } catch {
      store.clear();
      return null;
    }
  },
});

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

async function rawRefresh(base: string, refreshToken: string) {
  const res = await fetch(`${base.replace(/\/+$/, '')}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const envelope = await res.json();
  if (!res.ok || !envelope?.success) throw new Error('refresh failed');
  return envelope.data as { accessToken: string; refreshToken: string; expiresAtUtc: string; user?: unknown };
}
