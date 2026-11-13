export function hasAdminRole(roles: readonly string[]): boolean {
  return roles.some((role) => {
    const r = role.toLowerCase();
    return (
      r.includes('admin') ||
      r.includes('manager') ||
      r.includes('management') ||
      r.includes('staff') ||
      r.includes('operator') ||
      r.includes('committee')
    );
  });
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
  if (hasAdminRole(roles) && !hasResidentRole(roles)) return 'admin';
  return 'resident';
}
