import { useNavigate } from 'react-router-dom';
import { ForgotPassword } from '@shared/components/ForgotPassword';
import { Card } from '@shared/components/ui/card';
import { LanguageSwitcher } from '@shared/components/LanguageSwitcher';
import { useForceLight } from '@shared/lib/useForceLight';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  useForceLight();
  return (
    <div className="force-light flex min-h-[100dvh] flex-col bg-gradient-to-br from-slate-100 via-emerald-50/20 to-teal-100/20">
      <div className="flex items-center justify-end p-4">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-10">
        <Card className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl p-0 shadow-lg">
          <ForgotPassword onExit={() => navigate('/login')} onDone={() => navigate('/login')} />
        </Card>
      </div>
    </div>
  );
}
