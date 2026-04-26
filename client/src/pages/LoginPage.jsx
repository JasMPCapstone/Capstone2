import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

/** Matches legacy EJS login split + auth-card. */
export default function LoginPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const urlMessage = useMemo(() => {
    const p = new URLSearchParams(location.search);
    return (p.get('message') || '').trim();
  }, [location.search]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(() => urlMessage || null);
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    if (urlMessage) setError(urlMessage);
  }, [urlMessage]);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-full w-full flex-col overflow-y-auto bg-[#f3f4f6] md:flex-row">
      {/* Left: brand panel — same structure as .login-sidebar */}
      <aside
        className="flex max-w-none shrink-0 flex-col justify-between bg-[#00684a] px-8 py-10 text-white md:max-w-[520px] md:basis-[42%]"
        aria-label="MedSupply Innovations"
      >
        <div className="min-h-0 flex-1">
          <h1 className="m-0 text-[clamp(1.35rem,2.5vw,1.85rem)] font-bold uppercase leading-tight tracking-tight">
            MEDSUPPLY INNOVATIONS
          </h1>
          <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-white/90">
            Your Australian trusted medical consumables &amp; equipment supplier. Sourcing, manufacturing and supply of
            all consumables and medical devices.
          </p>
        </div>
        <ul className="mt-8 list-none space-y-3.5 p-0 text-[0.9rem] leading-snug md:mt-8">
          {[
            'Client Onboarding Questionnaire Portal',
            'Med Supply Portal',
            'Certified',
          ].map((label) => (
            <li key={label} className="relative pl-4 before:absolute before:left-0 before:top-[0.2em] before:bottom-[0.2em] before:w-0.5 before:rounded-sm before:bg-white/55">
              <a href="#" className="text-inherit no-underline opacity-95 hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </aside>

      {/* Right: form — .login-main + .login-wrap */}
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-4 py-8 md:px-6 md:py-8">
        <div className="w-full max-w-[420px]">
          {error ? (
            <div
              className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200/80 bg-white p-9 text-left shadow-[0_4px_24px_rgba(15,23,42,0.08)]">
            {/* .auth-logo — circle + cross + MEDSUPPLY */}
            <div className="mb-5 text-center">
              <div className="mb-1 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#00684a]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    fill="#ffffff"
                    d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"
                  />
                </svg>
              </div>
              <span className="mt-1 block text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#00684a]">
                MEDSUPPLY
              </span>
            </div>

            <p className="mb-6 text-center text-[0.95rem] text-[#5f6b7a]">Secure Document Portal</p>

            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <form
                method="post"
                action="/login"
                onSubmit={() => {
                  setError(null);
                  setSubmitting(true);
                }}
              >
                <label htmlFor="email" className="mb-1 block text-[0.9rem] font-semibold text-[#1a2332]">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mb-4 w-full rounded-md border border-[#e2e8f0] bg-[#e8eff6] px-3.5 py-2.5 text-base text-[#1a2332] placeholder:text-slate-400 focus:border-[#00684a] focus:outline-none focus:ring-2 focus:ring-[#d1f0e8]"
                />

                <label htmlFor="password" className="mb-1 block text-[0.9rem] font-semibold text-[#1a2332]">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="mb-4 w-full rounded-md border border-[#e2e8f0] bg-[#e8eff6] px-3.5 py-2.5 text-base text-[#1a2332] placeholder:text-slate-400 focus:border-[#00684a] focus:outline-none focus:ring-2 focus:ring-[#d1f0e8]"
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 flex w-full cursor-pointer items-center justify-center rounded-md border-0 bg-[#00684a] py-2.5 text-base font-semibold text-white hover:bg-[#00523c] disabled:opacity-60"
                >
                  {submitting ? <Spinner className="h-5 w-5 border-t-white" /> : 'Sign in'}
                </button>
              </form>
            )}

            <p className="mb-2 mt-5 text-center">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-sm font-medium text-[#00684a] hover:underline"
              >
                Forgot password?
              </button>
            </p>

            <p className="m-0 mt-5 rounded-md border border-[#e2e8f0] bg-[#f9fafb] px-4 py-3.5 text-center text-[0.875rem] leading-relaxed text-[#5f6b7a]">
              Accounts are created by your organization. Contact your client admin if you need access.
            </p>
          </div>
        </div>
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} defaultEmail={email} />
    </div>
  );
}
