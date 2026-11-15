import type { ReactNode } from 'react';
import { AdaptiveShell } from '@shared/components/layout/AdaptiveShell';
import { useAuth } from '@shared/store/AuthContext';

export interface AdminPageWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AdminPageWrapper({ title, subtitle, children }: AdminPageWrapperProps) {
  const { user } = useAuth();
  return (
    <AdaptiveShell
      title={title}
      subtitle={subtitle}
      showBack
      hideDesktopSubHeader
      societyName={user?.organizationName}
    >
      <div className="space-y-4">
        {children}
      </div>
    </AdaptiveShell>
  );
}

export default AdminPageWrapper;
