/**
 * THE rule for "this user has full rights": PowerUser, SuperAdmin, OrganizationAdmin, CommunityAdmin
 * (any role containing "admin"). Used by usePermission, the app tiles and anything else that needs it —
 * do not write another role regex. (Replaces an unused hasAdminRole that also counted staff/managers.)
 */
export function isAdminRole(roles: readonly string[]): boolean {
  return roles.some((r) => /admin|poweruser|superadmin/i.test(r));
}

export function hasSecurityRole(roles: readonly string[]): boolean {
  return roles.some((role) => {
    const r = role.toLowerCase();
    return r.includes('security') || r.includes('guard') || r.includes('watch') || r.includes('gate');
  });
}

export function hasResidentRole(roles: readonly string[]): boolean {
  return roles.some((role) => {
    const r = role.toLowerCase();
    return r.includes('resident') || r.includes('owner') || r.includes('tenant') || r.includes('member') || r.includes('family');
  });
}

export type Persona = 'resident' | 'security' | 'admin';

export function resolvePersona(roles: readonly string[]): Persona {
  if (hasSecurityRole(roles) && !hasResidentRole(roles)) return 'security';
  // Mobile has 2 core profiles: security and resident (normal resident + admin)
  return 'resident';
}
