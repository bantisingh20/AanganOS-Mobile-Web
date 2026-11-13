import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@shared/components/BrandLogo';
import { useAuth } from '@shared/store/AuthContext';

const SEEN_KEY = 'aanganos.splashSeen';

export function hasSeenSplash(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

function markSplashSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    void 0;
  }
}

export function SplashScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    markSplashSeen();
    const id = setTimeout(() => {
      navigate(isAuthenticated ? '/home' : '/', { replace: true });
    }, 1800);
    return () => clearTimeout(id);
  }, [navigate, isAuthenticated]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[#0b261d] text-white">
      <BrandLogo size="lg" showWordmark={false} />
      <div className="text-center">
        <div className="text-3xl font-extrabold leading-none">
          <span>Aangan</span>
          <span className="text-primary">OS</span>
        </div>
      </div>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    </div>
  );
}
