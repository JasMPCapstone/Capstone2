import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Spinner from '../components/Spinner';

function IconPadlock({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

export default function LoginTwoFactorPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);
  const urlMessage = useMemo(() => {
    const p = new URLSearchParams(location.search);
    return (p.get('message') || '').trim();
  }, [location.search]);
  const [digits, setDigits] = useState(() => ['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(() => urlMessage || null);
  const inputRefs = useRef([]);

  const code = digits.join('');

  useEffect(() => {
    if (urlMessage) setError(urlMessage);
  }, [urlMessage]);

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  useEffect(() => {
    if (!token) return;
    const t = window.setTimeout(() => inputRefs.current[0]?.focus(), 100);
    return () => window.clearTimeout(t);
  }, [token]);

  const setDigit = useCallback((i, char) => {
    const c = char.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = c;
      return next;
    });
    return c;
  }, []);

  const clearDigit = useCallback((i) => {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = '';
      return next;
    });
  }, []);

  const onDigitChange = useCallback(
    (i, e) => {
      const v = e.target.value;
      const c = setDigit(i, v);
      if (c && i < 5) inputRefs.current[i + 1]?.focus();
    },
    [setDigit]
  );

  const onKeyDown = useCallback(
    (i, e) => {
      if (e.key === 'Backspace') {
        if (digits[i]) {
          clearDigit(i);
        } else if (i > 0) {
          clearDigit(i - 1);
          inputRefs.current[i - 1]?.focus();
        }
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowLeft' && i > 0) {
        inputRefs.current[i - 1]?.focus();
        e.preventDefault();
      }
      if (e.key === 'ArrowRight' && i < 5) {
        inputRefs.current[i + 1]?.focus();
        e.preventDefault();
      }
    },
    [digits, clearDigit]
  );

  const onPaste = useCallback((e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const chars = text.split('');
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((ch, j) => {
        if (j < 6) next[j] = ch;
      });
      return next;
    });
    const focusAt = Math.min(chars.length, 5);
    window.requestAnimationFrame(() => inputRefs.current[focusAt]?.focus());
  }, []);

  const digitsLeft = 6 - code.length;
  const canSubmit = code.length === 6 && !!token;

  return (
    <div className="flex min-h-full flex-col overflow-y-auto bg-[#f0f2f5]">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] rounded-2xl border border-slate-200/80 bg-white px-8 pb-8 pt-10 shadow-[0_8px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col items-center text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f5f0] ring-2 ring-[#00684a]/15"
              aria-hidden
            >
              <IconPadlock className="h-8 w-8 text-[#00684a]" />
            </div>
            <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#00684a]/90">
              MedSupply Innovations
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Easy peasy</h1>
            <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-slate-500">
              Enter 6-digit code from your two-factor authenticator app.
            </p>
          </div>

          <form
            method="post"
            action="/login/2fa"
            className="mt-8"
            onSubmit={() => {
              setError(null);
              setSubmitting(true);
            }}
          >
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="code" value={code} readOnly aria-hidden />

            {error ? (
              <div
                className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-center gap-5 sm:gap-6">
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digits[i]}
                    onChange={(e) => onDigitChange(i, e)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    onPaste={onPaste}
                    disabled={!token}
                    aria-label={`Digit ${i + 1} of 6`}
                    className={`h-12 w-10 rounded-xl border text-center text-lg font-semibold tabular-nums text-slate-900 outline-none transition-colors sm:h-14 sm:w-11 sm:text-xl ${
                      !token
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                        : digits[i]
                          ? 'border-slate-200 bg-white focus:border-[#00684a] focus:ring-2 focus:ring-[#00684a]/25'
                          : 'border-slate-200 bg-white focus:border-[#00684a] focus:ring-2 focus:ring-[#00684a]/25'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {[3, 4, 5].map((i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={1}
                    value={digits[i]}
                    onChange={(e) => onDigitChange(i, e)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    onPaste={onPaste}
                    disabled={!token}
                    aria-label={`Digit ${i + 1} of 6`}
                    className={`h-12 w-10 rounded-xl border text-center text-lg font-semibold tabular-nums text-slate-900 outline-none transition-colors sm:h-14 sm:w-11 sm:text-xl ${
                      !token
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                        : 'border-slate-200 bg-white focus:border-[#00684a] focus:ring-2 focus:ring-[#00684a]/25'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className={`mt-8 flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-semibold transition-colors ${
                submitting || canSubmit
                  ? 'bg-[#00684a] text-white shadow-sm hover:bg-[#00523c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00684a] focus-visible:ring-offset-2 disabled:opacity-90'
                  : 'cursor-not-allowed bg-slate-100 text-slate-500'
              }`}
            >
              {submitting ? (
                <Spinner className="h-5 w-5 border-t-white" />
              ) : canSubmit ? (
                'Verify'
              ) : !token ? (
                'Sign in again'
              ) : digitsLeft === 1 ? (
                '1 digit left'
              ) : (
                `${digitsLeft} digits left`
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="font-medium text-[#00684a] hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
