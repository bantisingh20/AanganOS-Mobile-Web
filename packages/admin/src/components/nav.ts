import type { MenuNode } from '@shared/api/menu';

function node(key: string, label: string, route: string | null, icon: string | null, children: MenuNode[] = []): MenuNode {
  return { key, label, route, icon, children };
}

export const ADMIN_FALLBACK_MENU: MenuNode[] = [
  node('admin.group.overview', 'Overview', null, null, [
    node('admin.dashboard', 'Dashboard', '/dashboard', 'AppstoreOutlined'),
  ]),
  node('admin.group.community', 'Community', null, null, [
    node('admin.organizations', 'Organizations', '/organizations', 'BankOutlined'),
    node('admin.communities', 'Communities', '/communities', 'ApartmentOutlined'),
    node('admin.units', 'Towers & Units', '/units', 'HomeOutlined'),
    node('admin.residents', 'Residents', '/residents', 'TeamOutlined'),
  ]),
  node('admin.group.operations', 'Operations', null, null, [
    node('admin.announcements', 'Announcements', '/announcements', 'NotificationOutlined'),
    node('admin.maintenance', 'Maintenance', '/maintenance', 'ToolOutlined'),
    node('admin.visitors', 'Visitors', '/visitors', 'IdcardOutlined'),
    node('admin.amenities', 'Amenities', '/amenities', 'CoffeeOutlined'),
    node('admin.notifications', 'Notifications', '/notifications', 'MessageOutlined'),
  ]),
  node('admin.group.administration', 'Administration', null, null, [
    node('admin.users', 'Manage People', '/users', 'UserOutlined'),
    node('admin.adminusers', 'Admin Users', '/admin-users', 'SafetyOutlined'),
    node('admin.roles', 'Roles & Permissions', '/roles', 'KeyRound'),
    node('admin.menu', 'Menu Management', '/menu-management', 'MenuOutlined'),
    node('admin.config', 'Configuration', '/config', 'SettingOutlined'),
  ]),
];
