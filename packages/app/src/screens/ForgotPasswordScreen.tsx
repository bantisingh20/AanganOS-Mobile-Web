import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@app/components/AuthLayout';
import { ForgotPassword } from '@shared/components/ForgotPassword';

export function ForgotPasswordScreen() {
  const navigate = useNavigate();
  return (
    <AuthLayout>
      <ForgotPassword onExit={() => navigate('/login')} onDone={() => navigate('/login')} />
    </AuthLayout>
  );
}
