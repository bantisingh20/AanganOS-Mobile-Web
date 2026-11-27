import { useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { ForgotPassword } from '@shared/features/auth/ForgotPassword';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  return (
    <AuthLayout>
      <ForgotPassword onExit={() => navigate('/login')} onDone={() => navigate('/login')} />
    </AuthLayout>
  );
}
