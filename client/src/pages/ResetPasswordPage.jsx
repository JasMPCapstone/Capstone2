import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

/** @returns {{ bars: number, label: string }} bars 0–4, label for bars > 0 */
function passwordStrength(pw) {
  if (!pw) return { bars: 0, label: '' };
  let c = 0;
  if (pw.length >= 6) c++;
  if (pw.length >= 10) c++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) c++;
  if (/\d/.test(pw)) c++;
  if (/[^A-Za-z0-9]/.test(pw)) c++;
  const bars = c === 0 ? 0 : Math.min(4, c);
  const labels = { 1: 'Weak', 2: 'Fair', 3: 'Good', 4: 'Excellent' };
  return { bars, label: labels[bars] || '' };
}

function MailboxIllustration({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M24 38h72v48H24V38z"
        stroke="#1e293b"
        strokeWidth="2.2"
        strokeLinejoin="round"
        fill="#fafafa"
      />
      <path d="M24 38 60 58l36-20" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M38 52h20M38 62h32"
        stroke="#64748b"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="44" y="46" width="14" height="10" rx="1" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.2" />
      <path d="M60 88V96" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M48 96h24" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="84" cy="54" r="3" fill="#00684a" opacity="0.2" />
      <circle cx="92" cy="62" r="2.5" fill="#00684a" opacity="0.15" />
    </svg>
  );
}

function CheckCircleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#00684a" />
      <path d="M8 12l2.5 2.5L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const inputBase =
  'w-full rounded-xl border bg-[#f8fafc] px-3.5 py-3 pr-11 text-base text-[#1a2332] placeholder:text-slate-400 transition-[border-color,box-shadow] focus:bg-white focus:outline-none';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const location = useLocation();
  const message = useMemo(() => (new URLSearchParams(location.search).get('message') || '').trim(), [location.search]);
  const err = new URLSearchParams(location.search).get('error') === '1';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState(null);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const showPwOk = password.length >= 6 && strength.bars >= 3;
  const borderNew =
    localError && localError.includes('match')
      ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
      : showPwOk
        ? 'border-[#00684a] focus:border-[#00684a] focus:ring-2 focus:ring-[#d1f0e8]'
        : 'border-slate-200 focus:border-[#00684a] focus:ring-2 focus:ring-[#d1f0e8]';

  const borderConfirm =
    confirm.length > 0 && password !== confirm
      ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
      : confirm.length > 0 && password === confirm && password.length >= 6
        ? 'border-[#00684a] focus:border-[#00684a] focus:ring-2 focus:ring-[#d1f0e8]'
        : 'border-slate-200 focus:border-[#00684a] focus:ring-2 focus:ring-[#d1f0e8]';

  function handleSubmit(e) {
    setLocalError(null);
    if (password.length < 6) {
      e.preventDefault();
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      e.preventDefault();
      setLocalError('Passwords do not match. Please re-enter the same password.');
      return;
    }
  }

  const barColor = (i) =>
    strength.bars >= i + 1 ? 'bg-[#00684a]' : 'bg-slate-200';

  return (
    <div className="flex min-h-full items-center justify-center overflow-y-auto bg-[#f3f4f6] px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-200/90 bg-white px-8 py-10 shadow-[0_4px_24px_rgba(15,23,42,0.08)] sm:px-10">
        <div className="mb-6 flex justify-center">
          <MailboxIllustration className="h-[5.5rem] w-auto" />
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight text-[#1a2332]">Reset password</h1>
        <p className="mt-2 text-center text-[0.95rem] leading-relaxed text-[#5f6b7a]">
          Please kindly set your new password.
        </p>

        {message && err ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-sm text-rose-950" role="alert">
            {message}
          </div>
        ) : null}

        {localError ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-sm text-rose-950" role="alert">
            {localError}
          </div>
        ) : null}

        <form
          method="post"
          action={`/reset-password/${encodeURIComponent(token || '')}`}
          className="mt-8 space-y-5"
          onSubmit={handleSubmit}
        >
          <div>
            <label htmlFor="reset-password-new" className="mb-1.5 block text-[0.9rem] font-semibold text-[#1a2332]">
              New password
            </label>
            <div className="relative">
              <input
                id="reset-password-new"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLocalError(null);
                }}
                className={`${inputBase} ${borderNew}`}
                placeholder="Enter new password"
              />
              {showPwOk ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <CheckCircleIcon className="h-6 w-6" />
                </span>
              ) : null}
            </div>
            {password ? (
              <div className="mt-3 space-y-2">
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${barColor(i)}`} />
                  ))}
                </div>
                <p
                  className={`text-sm font-medium ${strength.bars === 0 ? 'text-amber-700' : 'text-[#00684a]'}`}
                >
                  Password strength:{' '}
                  <span className="capitalize">
                    {strength.bars === 0 ? 'Too short (min. 6 characters)' : strength.label}
                  </span>
                </p>
              </div>
            ) : null}
          </div>

          <div>
            <label htmlFor="reset-password-confirm" className="mb-1.5 block text-[0.9rem] font-semibold text-[#1a2332]">
              Re-enter password
            </label>
            <input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setLocalError(null);
              }}
              className={`${inputBase} ${borderConfirm} pr-3.5`}
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full border-0 bg-[#00684a] py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#00523c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00684a] focus-visible:ring-offset-2"
          >
            Reset password
          </button>
        </form>

        <p className="mt-8 text-center text-sm">
          <Link to="/login" className="font-medium text-[#00684a] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
