import { useEffect, useId } from 'react';

/** @type {Record<string, { iconWrap: string, cancel: string, confirm: string, middle: string }>} */
const tones = {
  rose: {
    iconWrap: 'bg-rose-100 text-rose-600 ring-rose-200/80 shadow-[0_8px_24px_-8px_rgba(225,29,72,0.35)]',
    cancel:
      'border-2 border-rose-500 bg-white text-rose-600 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500',
    confirm: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600',
    middle:
      'border-2 border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
  },
  amber: {
    iconWrap: 'bg-amber-100 text-amber-700 ring-amber-200/80 shadow-[0_8px_24px_-8px_rgba(217,119,6,0.3)]',
    cancel:
      'border-2 border-amber-500 bg-white text-amber-800 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
    confirm:
      'bg-amber-500 text-white hover:bg-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
    middle:
      'border-2 border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
  },
  emerald: {
    iconWrap: 'bg-emerald-100 text-emerald-700 ring-emerald-200/80 shadow-[0_8px_24px_-8px_rgba(5,150,105,0.3)]',
    cancel:
      'border-2 border-emerald-600 bg-white text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
    confirm:
      'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
    middle:
      'border-2 border-emerald-500 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
  },
};

const btnBase =
  'inline-flex min-h-[2.75rem] items-center justify-center rounded-xl px-5 text-sm font-semibold transition-colors disabled:opacity-50';

function IconTrash({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

function IconUserMinus({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" />
      <path d="M22 11h-6" strokeLinecap="round" />
    </svg>
  );
}

function IconUserPlus({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" />
      <path d="M19 8v6M22 11h-6" strokeLinecap="round" />
    </svg>
  );
}

function IconShieldOff({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM2 2l20 20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * In-app confirmation modal (replaces window.confirm). Centered icon, bold title, description, rounded card; Cancel outline + solid confirm.
 *
 * @param {{
 *   open: boolean
 *   title: string
 *   message: import('react').ReactNode
 *   confirmLabel?: string
 *   cancelLabel?: string
 *   tone?: 'rose' | 'amber' | 'emerald'
 *   icon?: 'auto' | 'trash' | 'user-minus' | 'user-plus' | 'shield-off' | 'none'
 *   middleAction?: { label: string, onClick: () => void } | null
 *   onConfirm: () => void
 *   onCancel: () => void
 * }} props
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'rose',
  icon = 'auto',
  middleAction = null,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descId = useId();
  const t = tones[tone] || tones.rose;

  let Icon = null;
  if (icon === 'none') Icon = null;
  else if (icon === 'trash') Icon = IconTrash;
  else if (icon === 'user-minus') Icon = IconUserMinus;
  else if (icon === 'user-plus') Icon = IconUserPlus;
  else if (icon === 'shield-off') Icon = IconShieldOff;
  else if (icon === 'auto') {
    if (tone === 'rose') Icon = IconTrash;
    else if (tone === 'amber') Icon = IconUserMinus;
    else Icon = IconUserPlus;
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const hasMiddle = middleAction != null && middleAction.label;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white px-8 pb-8 pt-10 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80">
        {Icon ? (
          <div
            className={`mx-auto mb-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl ring-1 ring-inset ${t.iconWrap}`}
          >
            <Icon className="h-9 w-9 shrink-0" />
          </div>
        ) : null}

        <h2 id={titleId} className="text-center text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        <div id={descId} className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          {message}
        </div>

        {hasMiddle ? (
          <div className="mt-8 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className={`${btnBase} flex-1 ${t.cancel}`} onClick={onCancel}>
                {cancelLabel}
              </button>
              <button type="button" className={`${btnBase} flex-1 ${t.middle}`} onClick={middleAction.onClick}>
                {middleAction.label}
              </button>
            </div>
            <button type="button" className={`${btnBase} w-full ${t.confirm}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button type="button" className={`${btnBase} flex-1 ${t.cancel}`} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={`${btnBase} flex-1 ${t.confirm}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
