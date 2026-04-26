import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchTwoFactorSettings, postTwoFactorCancel, postTwoFactorStart } from '../lib/api';
import ConfirmDialog from './ui/ConfirmDialog';

const SUBMIT_BTN =
  'w-full rounded-xl bg-[#00684a] py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-[#00523c] focus:outline-none focus:ring-2 focus:ring-[#00684a] focus:ring-offset-2';

const SECONDARY_BTN =
  'w-full rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200/80 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00684a]/25';

const INPUT_CLASS =
  'w-full rounded-xl border-0 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-md ring-1 ring-slate-200/90 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00684a]/35';

const DESTRUCTIVE_BTN =
  'w-full rounded-xl border border-rose-300 bg-rose-50 py-3.5 text-sm font-bold uppercase tracking-wide text-rose-900 shadow-sm transition-colors hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400/40';

function IconBack() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye({ open }) {
  if (open) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" />
      <path d="M1 1l22 22" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M60 12 98 28v36c0 28-38 58-38 58S22 92 22 64V28L60 12z"
        fill="#5fb89a"
        stroke="#00684a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M42 58l14 14 28-28"
        stroke="#00523c"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function errorMessageFromParam(code) {
  switch (code) {
    case 'setup':
      return 'Could not start two-factor setup. Please try again.';
    case 'missing':
      return 'Enter the 6-digit code from your authenticator app.';
    case 'invalid':
      return 'That code was not valid. Check the time on your device and try again.';
    case 'enable':
      return 'Could not enable two-factor authentication. Please try again.';
    case 'password':
      return 'Enter your account password to disable 2FA.';
    case 'wrongpassword':
      return 'That password is not correct.';
    case 'disable':
      return 'Could not disable two-factor authentication. Please try again.';
    default:
      return null;
  }
}

/**
 * @param {{ variant?: 'page' | 'modal', onClose?: () => void, headingId?: string, describedById?: string }} props
 */
export default function TwoFactorSettingsPanel({
  variant = 'page',
  onClose,
  headingId = 'twofactor-settings-title',
  describedById = 'twofactor-settings-desc',
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, payload: null });
  const disableFormRef = useRef(null);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [showDisablePassword, setShowDisablePassword] = useState(false);

  const TitleTag = variant === 'modal' ? 'h2' : 'h1';

  const styleSuffix = searchParams.get('style') === 'required' ? 'required' : '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const first = await fetchTwoFactorSettings(styleSuffix);
      if (cancelled) return;
      if (first.kind === 'redirect' || first.kind === 'unauthorized') {
        setState({ loading: false, error: null, payload: null });
        return;
      }
      if (first.kind === 'error') {
        setState({ loading: false, error: first.error, payload: null });
        return;
      }

      let data = first.data;
      if (!data.twoFactorEnabled && !data.qrDataURL) {
        const started = await postTwoFactorStart(styleSuffix);
        if (cancelled) return;
        if (started.kind !== 'ok') {
          setState({ loading: false, error: started.error || 'Could not start two-factor setup.', payload: null });
          return;
        }
        data = started.data;
      }

      setState({ loading: false, error: null, payload: data });
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams.toString(), styleSuffix]);

  const handleModalBack = useCallback(async () => {
    const p = state.payload;
    if (p && !p.twoFactorEnabled && p.qrDataURL) {
      await postTwoFactorCancel();
    }
    onClose?.();
  }, [onClose, state.payload]);

  const handlePageBackToSettings = useCallback(async () => {
    const p = state.payload;
    if (p && !p.twoFactorEnabled && p.qrDataURL) {
      await postTwoFactorCancel();
    }
    navigate('/settings');
  }, [navigate, state.payload]);

  const urlError = useMemo(() => errorMessageFromParam(searchParams.get('error')), [searchParams]);

  if (state.loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-600" aria-live="polite">
        Preparing two-factor setup…
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="text-slate-900">
        {variant === 'modal' && onClose ? (
          <div className="-mt-1 mb-4">
            <button
              type="button"
              onClick={() => onClose()}
              className="inline-flex items-center gap-1 rounded-lg p-2 text-[#00684a] transition-colors hover:bg-[#00684a]/10"
              aria-label="Go back"
            >
              <IconBack />
            </button>
          </div>
        ) : null}
        <div className="space-y-4 py-4 text-center">
          <p className="text-sm font-medium text-slate-900">Could not load 2FA settings</p>
          <p className="text-sm text-slate-600">{state.error}</p>
          <button type="button" className={SECONDARY_BTN} onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const data = state.payload || {};
  const require2FA = !!data.require2FA;
  const enabled = !!data.twoFactorEnabled;
  const qrDataURL = data.qrDataURL;
  const manualSecret = data.manualSecret;

  return (
    <div className="text-slate-900">
      {variant === 'modal' && onClose ? (
        <div className="-mt-1 mb-2">
          <button
            type="button"
            onClick={() => void handleModalBack()}
            className="inline-flex items-center gap-1 rounded-lg p-2 text-[#00684a] transition-colors hover:bg-[#00684a]/10"
            aria-label="Go back"
          >
            <IconBack />
          </button>
        </div>
      ) : null}

      <div className="mx-auto mb-5 flex w-[6.5rem] justify-center">
        <ShieldIllustration className="h-24 w-auto" />
      </div>

      <TitleTag id={headingId} className="text-center text-xl font-bold tracking-tight text-slate-900">
        Two-factor authentication
      </TitleTag>

      <p id={describedById} className="mt-3 text-center text-sm leading-relaxed text-slate-500">
        Use an authenticator app (such as Microsoft or Google Authenticator) for a second step when you sign in.
      </p>

      {require2FA ? (
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm text-sky-950">
          Your organization requires two-factor authentication. Finish setup below to access the full portal.
        </div>
      ) : null}

      {searchParams.get('enabled') === '1' ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-950">
          Two-factor authentication has been enabled.
        </div>
      ) : null}
      {searchParams.get('disabled') === '1' ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-800">
          Two-factor authentication has been disabled.
        </div>
      ) : null}
      {urlError ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-950">
          {urlError}
        </div>
      ) : null}

      {enabled ? (
        <div className="mt-8 space-y-4">
          <p className="text-center text-sm text-slate-600">
            2FA is on. When you sign in, you’ll enter your password and a 6-digit code from your app.
          </p>
          <form ref={disableFormRef} method="post" action="/settings/2fa/disable" className="space-y-4">
            <div className="relative">
              <input
                id="twofactor-disable-password"
                name="password"
                type={showDisablePassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="Your password"
                aria-label="Enter your password to disable 2FA"
                className={`${INPUT_CLASS} pr-12`}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-[#00684a]/10 hover:text-[#00684a]"
                onClick={() => setShowDisablePassword((s) => !s)}
                aria-label={showDisablePassword ? 'Hide password' : 'Show password'}
              >
                <IconEye open={!showDisablePassword} />
              </button>
            </div>
            <button
              type="button"
              className={DESTRUCTIVE_BTN}
              onClick={() => {
                const f = disableFormRef.current;
                if (!f?.checkValidity()) {
                  f?.reportValidity();
                  return;
                }
                setDisableConfirmOpen(true);
              }}
            >
              Disable 2FA
            </button>
          </form>
          <ConfirmDialog
            open={disableConfirmOpen}
            title="Disable two-factor authentication?"
            message="Your account will be less secure without a second step when you sign in. You can turn 2FA on again anytime from settings."
            confirmLabel="Disable 2FA"
            cancelLabel="Cancel"
            tone="rose"
            icon="shield-off"
            onCancel={() => setDisableConfirmOpen(false)}
            onConfirm={() => {
              setDisableConfirmOpen(false);
              disableFormRef.current?.submit();
            }}
          />
        </div>
      ) : null}

      {!enabled && qrDataURL ? (
        <div className="mt-8 space-y-5">
          <p className="text-center text-sm text-slate-600">
            Add this account in your authenticator app, then enter the 6-digit code to confirm.
          </p>
          <div className="flex justify-center">
            <img src={qrDataURL} alt="" width={220} height={220} className="rounded-xl border border-slate-200/90 shadow-md" />
          </div>
          {manualSecret ? (
            <p className="break-all rounded-xl bg-slate-50 px-4 py-3 text-center font-mono text-xs text-slate-800 ring-1 ring-slate-200/80">
              <span className="text-slate-500">Manual key: </span>
              <span className="select-all">{manualSecret}</span>
            </p>
          ) : null}
          <form method="post" action="/settings/2fa/verify" className="space-y-4">
            <input
              id="twofactor-code"
              name="code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]*"
              required
              placeholder="6-digit code"
              aria-label="6-digit code from authenticator app"
              className={`${INPUT_CLASS} text-center font-mono text-lg tracking-[0.35em]`}
            />
            <button type="submit" className={SUBMIT_BTN}>
              Confirm &amp; enable
            </button>
          </form>
        </div>
      ) : null}

      {variant === 'page' ? (
        <p className="mt-8 text-center text-sm">
          <button
            type="button"
            onClick={() => void handlePageBackToSettings()}
            className="font-medium text-[#00684a] underline decoration-[#00684a]/30 underline-offset-2 hover:text-[#00523c]"
          >
            ← Back to settings
          </button>
        </p>
      ) : null}
    </div>
  );
}
