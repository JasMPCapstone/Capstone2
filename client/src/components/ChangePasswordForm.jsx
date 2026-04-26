import { useId, useState } from 'react';

/** Portal primary — literal Tailwind classes only (JIT scans source text). */
const SUBMIT_BTN =
  'w-full rounded-xl bg-[#00684a] py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-[#00523c] focus:outline-none focus:ring-2 focus:ring-[#00684a] focus:ring-offset-2';

function PadlockIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M38 42V32c0-12 10-22 22-22s22 10 22 22v10"
        stroke="#0f172a"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M28 48h64c4 0 8 4 8 8v32c0 4-4 8-8 8H28c-4 0-8-4-8-8V56c0-4 4-8 8-8z"
        fill="#5fb89a"
        stroke="#00684a"
        strokeWidth="2"
      />
      <circle cx="60" cy="72" r="10" fill="#0f172a" />
      <path
        d="M72 72l18-6v14l-18-6"
        fill="#bbf7d0"
        stroke="#00523c"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
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

function IconLock() {
  return (
    <svg className="h-5 w-5 text-[#00684a]/55" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const inputClass =
  'w-full rounded-xl border-0 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-md ring-1 ring-slate-200/90 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00684a]/35';

/**
 * Shared change-password UI (classic POST to /account/change-password).
 */
export default function ChangePasswordForm({
  mustChange = false,
  errorMessage = null,
  showCancel = false,
  onCancel,
  headingId,
  describedById,
  showBackButton = false,
  onBack,
  titleTag: TitleTag = 'h2',
}) {
  const baseId = useId();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentLabel = mustChange ? 'Current or temporary password' : 'Old password';
  const descId = describedById || `${baseId}-desc`;

  return (
    <div className="text-slate-900">
      {showBackButton && onBack ? (
        <div className="-mt-1 mb-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-lg p-2 text-[#00684a] transition-colors hover:bg-[#00684a]/10"
            aria-label="Go back"
          >
            <IconBack />
          </button>
        </div>
      ) : null}

      <div className="mx-auto mb-6 flex w-[7.5rem] justify-center">
        <PadlockIllustration className="h-24 w-auto" />
      </div>

      <TitleTag id={headingId} className="text-center text-xl font-bold tracking-tight text-slate-900">
        Change password
      </TitleTag>

      {mustChange ? (
        <p id={descId} className="mt-3 text-center text-sm leading-relaxed text-slate-500">
          You must set a new password before continuing. Use at least 6 characters and avoid reuse from other sites.
        </p>
      ) : (
        <p id={descId} className="mt-3 text-center text-sm leading-relaxed text-slate-500">
          Choose a strong password you don’t use elsewhere. You’ll stay signed in on this device after you confirm.
        </p>
      )}

      {errorMessage ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-sm text-rose-950">
          {errorMessage}
        </div>
      ) : null}

      <form method="post" action="/account/change-password" className="mt-8 space-y-4" aria-labelledby={headingId} aria-describedby={descId}>
        <div className="relative">
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrent ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="Old password"
            aria-label={currentLabel}
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-[#00684a]/10 hover:text-[#00684a]"
            onClick={() => setShowCurrent((s) => !s)}
            aria-label={showCurrent ? 'Hide password' : 'Show password'}
          >
            <IconEye open={!showCurrent} />
          </button>
        </div>

        <div className="relative">
          <input
            id="newPassword"
            name="newPassword"
            type={showNew ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password"
            aria-label="New password"
            className={`${inputClass} pr-24`}
          />
          <div className="pointer-events-none absolute right-11 top-1/2 -translate-y-1/2">
            <IconLock />
          </div>
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-[#00684a]/10 hover:text-[#00684a]"
            onClick={() => setShowNew((s) => !s)}
            aria-label={showNew ? 'Hide new password' : 'Show new password'}
          >
            <IconEye open={!showNew} />
          </button>
        </div>

        <div className="relative">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Confirm password"
            aria-label="Confirm new password"
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-[#00684a]/10 hover:text-[#00684a]"
            onClick={() => setShowConfirm((s) => !s)}
            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
          >
            <IconEye open={!showConfirm} />
          </button>
        </div>

        <button type="submit" className={`${SUBMIT_BTN} mt-2`}>
          Confirm change
        </button>
      </form>

      {showCancel && onCancel && !mustChange ? (
        <p className="mt-5 text-center text-sm">
          <button type="button" onClick={onCancel} className="font-medium text-[#00684a] underline decoration-[#00684a]/30 underline-offset-2 hover:text-[#00523c]">
            Cancel
          </button>
        </p>
      ) : null}
    </div>
  );
}
