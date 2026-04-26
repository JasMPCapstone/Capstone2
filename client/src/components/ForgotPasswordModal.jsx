import { useEffect, useState } from 'react';
import { postForgotPassword } from '../lib/api';
import Spinner from './Spinner';

const inputClass =
  'w-full rounded-md border border-[#e2e8f0] bg-[#e8eff6] px-3.5 py-2.5 text-base text-[#1a2332] placeholder:text-slate-400 focus:border-[#00684a] focus:outline-none focus:ring-2 focus:ring-[#d1f0e8]';

/** Line illustration: signpost + grass (reference layout, neutral strokes). */
function ForgotPasswordIllustration({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="60" cy="88" rx="44" ry="5" fill="#86efac" fillOpacity="0.35" />
      <path d="M60 82V24" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M60 30h42l7 9-7 9H60V30z"
        fill="#f8fafc"
        stroke="#1e293b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M68 39h22M79 34v10" stroke="#00684a" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M60 52H26l-7 9 7 9h34V52z"
        fill="#f8fafc"
        stroke="#1e293b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M33 61h20" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @param {{ open: boolean, onClose: () => void, defaultEmail?: string }} props
 */
export default function ForgotPasswordModal({ open, onClose, defaultEmail = '' }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setEmail((defaultEmail || '').trim());
    setSent(false);
    setError(null);
  }, [open, defaultEmail]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await postForgotPassword(email);
      if (result.kind === 'ok') {
        setSent(true);
        return;
      }
      if (result.kind === 'error') {
        setError(result.error);
        return;
      }
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#00684a]/20 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200/90 bg-white px-8 py-8 shadow-[0_4px_24px_rgba(15,23,42,0.12)] sm:px-10 sm:py-9">
        <div className="mb-5 flex justify-center">
          <ForgotPasswordIllustration className="h-[4.5rem] w-auto text-slate-800" />
        </div>

        <h2 id="forgot-password-title" className="text-center text-xl font-bold tracking-tight text-[#1a2332]">
          Forgot your password?
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-[#5f6b7a]">
          Enter your email so we can send you a link to reset your password. The link expires in 1 hour.
        </p>

        {sent ? (
          <div
            className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-950"
            role="status"
          >
            If that email is registered and active, check your inbox and spam folder for reset instructions.
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-950" role="alert">
            {error}
          </div>
        ) : null}

        {!sent ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="forgot-email" className="mb-1 block text-[0.9rem] font-semibold text-[#1a2332]">
                Email
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. name@yourcompany.com"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full cursor-pointer items-center justify-center rounded-md border-0 bg-[#00684a] py-3 text-base font-semibold text-white hover:bg-[#00523c] disabled:opacity-60"
            >
              {submitting ? <Spinner className="h-5 w-5 border-t-white" /> : 'Send reset link'}
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-center">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#00684a] hover:underline"
          >
            <span aria-hidden className="text-base leading-none">
              ‹
            </span>
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}
