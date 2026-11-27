import { useAuth } from '@shared/store/AuthContext';

export interface Scope {
  isPowerUser: boolean;
  isOrgAdmin: boolean;
  organizationId: string | undefined;
  scopedCommunityId: string | undefined;
  canViewOrg: boolean;
  canViewCommunity: boolean;
  showOrgFilter: boolean;
  showCommunityFilter: boolean;
}

export function useScope(): Scope {
  const { user, roles } = useAuth();
  const perms = user?.permissions ?? [];

  const isPowerUser = roles.some((r) => /^(poweruser|superadmin)$/i.test(r));
  const isOrgAdmin = !isPowerUser && roles.some((r) => /organizationadmin/i.test(r));

  const canViewOrg = isPowerUser || perms.includes('Organization:0');
  const canViewCommunity = isPowerUser || isOrgAdmin || perms.includes('Community:0');

  const scopedCommunityId = !isPowerUser && !isOrgAdmin ? user?.communityId ?? undefined : undefined;

  return {
    isPowerUser,
    isOrgAdmin,
    organizationId: user?.organizationId ?? undefined,
    scopedCommunityId,
    canViewOrg,
    canViewCommunity,
    showOrgFilter: isPowerUser && canViewOrg,
    showCommunityFilter: (isPowerUser || isOrgAdmin) && canViewCommunity,
  };
}
