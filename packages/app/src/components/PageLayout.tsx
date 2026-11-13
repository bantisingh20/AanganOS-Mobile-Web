import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export function PageLayout({
  title,
  subtitle,
  onBack,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const back = onBack ?? (() => navigate(-1));

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-background">
      <header className="safe-top flex shrink-0 items-center gap-2 bg-primary px-3 pb-3 pt-3 text-primary-foreground">
        <button type="button" onClick={back} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/15">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-extrabold leading-tight">{title}</div>
          {subtitle ? <div className="truncate text-sm text-primary-foreground/85">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
