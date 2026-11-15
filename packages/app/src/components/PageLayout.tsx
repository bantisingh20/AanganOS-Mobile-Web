import type { ReactNode } from 'react';
import { AdaptiveShell } from '@shared/components/layout/AdaptiveShell';
import { useAuth } from '@shared/store/AuthContext';

export function PageLayout({
  title,
  subtitle,
  onBack,
  right,
  children,
  hideDesktopSubHeader,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  hideDesktopSubHeader?: boolean;
}) {
  const { user } = useAuth();
  return (
    <AdaptiveShell
      title={title}
      subtitle={subtitle}
      showBack
      onBack={onBack}
      rightAction={right}
      hideDesktopSubHeader={hideDesktopSubHeader}
      societyName={user?.organizationName}
    >
      {children}
    </AdaptiveShell>
  );
}

export default PageLayout;
