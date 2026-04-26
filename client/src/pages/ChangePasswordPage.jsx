import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ChangePasswordForm from '../components/ChangePasswordForm';

export default function ChangePasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const message = useMemo(() => (searchParams.get('message') || '').trim(), [searchParams]);
  const err = searchParams.get('error') === '1';
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    if (!loading && user?.passwordMustChange) setMustChange(true);
  }, [loading, user?.passwordMustChange]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#d4e3d9]">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center overflow-y-auto bg-[#d4e3d9] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <ChangePasswordForm
          mustChange={mustChange}
          errorMessage={err ? message : null}
          showCancel={false}
          headingId="change-password-title"
          describedById="change-password-desc"
          showBackButton={!mustChange}
          onBack={() => navigate('/')}
          titleTag="h1"
        />
      </div>
    </div>
  );
}
